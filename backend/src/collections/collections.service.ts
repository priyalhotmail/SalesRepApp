import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import {
  getPagination,
  toPaginatedResult,
} from "../common/utils/pagination.util";
import {
  CollectionQuery,
  ReviewCollectionDto,
  SendCollectionDto,
} from "./collections.dto";

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}
  isHeadOffice(actor: AuthenticatedUser) {
    return actor.roles.some((r) =>
      ["SUPER_ADMIN", "MAIN_OFFICE_AUTHORIZED_USER"].includes(r),
    );
  }
  async scope(actor: AuthenticatedUser, requested?: number) {
    if (this.isHeadOffice(actor)) return requested;
    if (!actor.roles.includes("BRANCH_AUTHORIZED_USER"))
      throw new ForbiddenException("Branch or head-office access required");
    const employee = await this.prisma.employee.findUnique({
      where: { userId: actor.id },
    });
    if (!employee || employee.status !== "ACTIVE")
      throw new ForbiddenException("Active branch assignment required");
    const office = employee.branchId ?? employee.officeId;
    if (requested && requested !== office)
      throw new ForbiddenException(
        "You can only access your branch collections",
      );
    return office;
  }
  private available(officeId?: number): Prisma.PaymentWhereInput {
    return {
      collectionOfficeId: officeId,
      confirmedAt: { not: null },
      remittanceItem: { is: null },
      OR: [
        { method: "CASH", status: "POSTED" },
        {
          method: "CHEQUE",
          status: "AWAITING_CLEARANCE",
          cheque: { is: { status: "RECEIVED" } },
        },
      ],
    };
  }
  async dashboard(actor: AuthenticatedUser, query: CollectionQuery) {
    const officeId = await this.scope(actor, query.officeId);
    const [offices, available, transfers, pending, previousBank] = await Promise.all([
      this.prisma.office.findMany({
        where: { id: officeId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.payment.groupBy({
        by: ["collectionOfficeId", "method"],
        where: this.available(officeId),
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.collectionRemittance.findMany({
        where: { officeId },
        select: {
          officeId: true,
          destination: true,
          status: true,
          items: { select: { amount: true, method: true } },
        },
      }),
      this.prisma.payment.groupBy({
        by: ["customerId", "method"],
        where: {
          status: "TEMPORARY",
          method: { in: ["CASH", "CHEQUE"] },
          customer: { officeId },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.payment.groupBy({
        by: ["collectionOfficeId", "method"],
        where: {
          collectionOfficeId: officeId,
          confirmedAt: { not: null },
          status: { in: ["POSTED", "AWAITING_CLEARANCE"] },
          method: "CHEQUE",
          remittanceItem: { is: null },
          cheque: { is: { status: { in: ["DEPOSITED", "REALIZED"] } } },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: pending.map((p) => p.customerId) } },
      select: { id: true, officeId: true },
    });
    return {
      canReview: this.isHeadOffice(actor),
      branches: offices.map((office) => {
        const buckets: Record<
          string,
          { cash: number; cheque: number; chequeCount: number }
        > = {};
        const add = (
          key: string,
          method: string,
          amount: number,
          count: number,
        ) => {
          const bucket = (buckets[key] ??= {
            cash: 0,
            cheque: 0,
            chequeCount: 0,
          });
          bucket[method === "CASH" ? "cash" : "cheque"] += Math.round(
            amount * 100,
          );
          if (method === "CHEQUE") bucket.chequeCount += count;
        };
        available
          .filter((p) => p.collectionOfficeId === office.id)
          .forEach((p) =>
            add("AVAILABLE", p.method, Number(p._sum.amount), p._count),
          );
        previousBank.filter(p => p.collectionOfficeId === office.id).forEach(p =>
          add("PREVIOUS_BANK", p.method, Number(p._sum.amount), p._count));
        pending
          .filter(
            (p) =>
              customers.find((c) => c.id === p.customerId)?.officeId ===
              office.id,
          )
          .forEach((p) =>
            add("TEMPORARY", p.method, Number(p._sum.amount), p._count),
          );
        transfers
          .filter((t) => t.officeId === office.id)
          .forEach((t) =>
            t.items.forEach((i) =>
              add(
                `${t.destination}_${t.status}`,
                i.method,
                Number(i.amount),
                1,
              ),
            ),
          );
        Object.values(buckets).forEach((b) => {
          b.cash /= 100;
          b.cheque /= 100;
        });
        return { ...office, buckets };
      }),
    };
  }
  async availablePayments(actor: AuthenticatedUser, query: CollectionQuery) {
    const officeId = await this.scope(actor, query.officeId);
    const { page, limit, skip, take } = getPagination(query);
    const where = this.available(officeId);
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: [{ paymentDate: "asc" }, { id: "asc" }],
        include: { customer: true, cheque: true },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return toPaginatedResult(data, total, page, limit);
  }
  async history(actor: AuthenticatedUser, query: CollectionQuery) {
    const officeId = await this.scope(actor, query.officeId);
    const { page, limit, skip, take } = getPagination(query);
    const [data, total] = await Promise.all([
      this.prisma.collectionRemittance.findMany({
        where: { officeId },
        skip,
        take,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          items: {
            include: { payment: { include: { cheque: true, customer: true } } },
          },
        },
      }),
      this.prisma.collectionRemittance.count({ where: { officeId } }),
    ]);
    return toPaginatedResult(data, total, page, limit);
  }
  async send(dto: SendCollectionDto, actor: AuthenticatedUser) {
    await this.scope(actor, dto.officeId);
    if (
      !dto.reference.trim() ||
      (dto.destination === "BANK" && !dto.bankName?.trim())
    )
      throw new BadRequestException(
        "Reference and bank name for deposits are required",
      );
    const sentAt = new Date(dto.sentAt);
    if (sentAt > new Date())
      throw new BadRequestException("Transfer date cannot be in the future");
    return this.prisma.$transaction(async (tx) => {
      // Lock receipts in a stable order; cancellation and competing transfers cannot race.
      await tx.$queryRaw`SELECT id FROM payments WHERE id IN (${Prisma.join([...dto.paymentIds].sort((a, b) => a - b))}) ORDER BY id FOR UPDATE`;
      const payments = await tx.payment.findMany({
        where: { ...this.available(dto.officeId), id: { in: dto.paymentIds } },
        include: { cheque: true },
      });
      if (payments.length !== dto.paymentIds.length)
        throw new ConflictException(
          "Some receipts are unconfirmed, already transferred, or outside this branch. Refresh and select again.",
        );
      for (const payment of payments) {
        if (payment.cheque) {
          if (
            dto.destination === "BANK" &&
            (!payment.cheque.chequeDate || payment.cheque.chequeDate > sentAt)
          )
            throw new BadRequestException(
              "A post-dated cheque cannot be deposited before its cheque date",
            );
          const changed = await tx.cheque.updateMany({
            where: { id: payment.cheque.id, status: "RECEIVED" },
            data:
              dto.destination === "BANK"
                ? {
                    status: "DEPOSITED",
                    depositedAt: sentAt,
                    updatedById: actor.id,
                  }
                : { updatedById: actor.id },
          });
          if (changed.count !== 1)
            throw new ConflictException(
              "Cheque status changed; refresh and try again",
            );
        }
      }
      const transfer = await tx.collectionRemittance.create({
        data: {
          id: randomUUID(),
          officeId: dto.officeId,
          destination: dto.destination,
          sentAt,
          reference: dto.reference.trim(),
          bankName: dto.destination === "BANK" ? dto.bankName?.trim() : null,
          notes: dto.notes,
          createdById: actor.id,
          items: {
            create: payments.map((p) => ({
              paymentId: p.id,
              amount: p.amount,
              method: p.method,
            })),
          },
        },
        include: { items: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "COLLECTION_SENT",
          entityType: "collection_remittance",
          entityId: transfer.id,
          newValues: {
            destination: dto.destination,
            paymentIds: dto.paymentIds,
            officeId: dto.officeId,
          },
        },
      });
      return transfer;
    });
  }
  async review(id: string, dto: ReviewCollectionDto, actor: AuthenticatedUser) {
    if (!this.isHeadOffice(actor))
      throw new ForbiddenException(
        "Only head office can confirm receipt or verify deposits",
      );
    if (dto.status === "NOT_RECEIVED" && !dto.notes?.trim())
      throw new BadRequestException(
        "Explain what has not been received or verified",
      );
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.collectionRemittance.updateMany({
        where: {
          id,
          status:
            dto.status === "RECEIVED"
              ? { in: ["PENDING", "NOT_RECEIVED"] }
              : "PENDING",
        },
        data: {
          status: dto.status,
          reviewNotes: dto.notes?.trim(),
          reviewedAt: new Date(),
          reviewedById: actor.id,
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          "Transfer was already reviewed; refresh and try again",
        );
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: `COLLECTION_${dto.status}`,
          entityType: "collection_remittance",
          entityId: id,
          newValues: { notes: dto.notes ?? "" },
        },
      });
      return tx.collectionRemittance.findUnique({ where: { id } });
    });
  }
}
