import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import {
  CanReturnQuery,
  CanTypeDto,
  CreateCanReturnDto,
} from "./can-return.dto";
import { applyCanCredits } from "./can-credit";

type Line = {
  canTypeId: number;
  quantity: number;
  name: string;
  returnValue: number;
};
@Injectable()
export class CanReturnsService {
  constructor(private readonly prisma: PrismaService) {}
  async officeScope(actor: AuthenticatedUser) {
    if (
      actor.roles.some((r) =>
        ["SUPER_ADMIN", "MAIN_OFFICE_AUTHORIZED_USER"].includes(r),
      )
    )
      return undefined;
    const employee = await this.prisma.employee.findUnique({
      where: { userId: actor.id },
    });
    if (!employee || employee.status !== "ACTIVE") {
      if (actor.roles.includes("SALES_REP")) {
        const rep = await this.prisma.salesRep.findFirst({
          where: { userId: actor.id, status: "ACTIVE" },
        });
        if (rep) return rep.officeId;
      }
      throw new ForbiddenException(
        "An active branch employee assignment is required",
      );
    }
    return employee.branchId ?? employee.officeId;
  }
  async types() {
    return this.prisma.canType.findMany({ orderBy: { capacityLitres: "asc" } });
  }
  async saveType(dto: CanTypeDto, actor: AuthenticatedUser, id?: number) {
    if (!dto.name.trim()) throw new BadRequestException("Can name is required");
    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.productIds }, status: "ACTIVE" },
    });
    if (products.length !== dto.productIds.length)
      throw new BadRequestException("Select active products");
    if (
      products.some(
        (p) =>
          !["L", "ML"].includes(p.unitType) ||
          !p.capacity
            .div(p.unitType === "ML" ? 1000 : 1)
            .equals(dto.capacityLitres),
      )
    ) {
      throw new BadRequestException(
        "Selected products must be liquid products matching this can capacity",
      );
    }
    return this.prisma.$transaction(async (tx) => {
      // Serialize configuration so products cannot be assigned to two can sizes.
      await tx.$queryRaw`SELECT id FROM products WHERE id IN (${Prisma.join(dto.productIds)}) FOR UPDATE`;
      const types = await tx.canType.findMany();
      if (
        types.some(
          (t) =>
            t.id !== id &&
            (t.productIds as number[]).some((p) => dto.productIds.includes(p)),
        )
      )
        throw new BadRequestException(
          "A product is already assigned to another can size",
        );
      if (id) {
        const old = types.find((t) => t.id === id);
        if (!old) throw new BadRequestException("Can size not found");
        if (!old.capacityLitres.equals(dto.capacityLitres))
          throw new BadRequestException(
            "Can capacity cannot change. Products, return value and active status can be edited.",
          );
      }
      const data = { ...dto, name: dto.name.trim() };
      const result = id
        ? await tx.canType.update({ where: { id }, data })
        : await tx.canType.create({ data });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "CAN_TYPE_SAVED",
          entityType: "can_type",
          entityId: String(result.id),
          oldValues: id ? { productIds: types.find(t => t.id === id)!.productIds } : undefined,
          newValues: { productIds: dto.productIds },
        },
      });
      return result;
    });
  }
  async eligibility(
    customerId: number,
    actor: AuthenticatedUser,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const officeId = await this.officeScope(actor);
    const customer = await tx.customer.findFirst({
      where: { id: customerId, officeId, status: "ACTIVE" },
    });
    if (!customer)
      throw new ForbiddenException("Customer is not available in your branch");
    const [types, deliveries, receipts, invoices] = await Promise.all([
      tx.canType.findMany({ where: { active: true } }),
      tx.delivery.findMany({
        where: {
          customerId,
          status: { in: ["DELIVERED", "PARTIALLY_DELIVERED"] },
        },
        include: { items: true, order: { include: { salesInvoice: true } } },
      }),
      tx.canReturn.findMany({
        where: { customerId, status: { in: ["TEMPORARY", "CONFIRMED"] } },
      }),
      tx.salesInvoice.findMany({
        where: {
          customerId,
          deletedAt: null,
          balanceAmount: { gt: 0 },
          status: { in: ["ISSUED", "PARTIALLY_PAID"] },
        },
      }),
    ]);
    const sizes = types.map((t) => {
      const productIds = t.productIds as number[];
      const delivered = deliveries.reduce(
        (sum, d) =>
          sum +
          d.items
            .filter((i) => productIds.includes(i.productId))
            .reduce((n, i) => n + Math.floor(Number(i.deliveredQuantity)), 0),
        0,
      );
      const returned = receipts.reduce(
        (sum, r) =>
          sum +
          (r.items as Line[])
            .filter((i) => i.canTypeId === t.id)
            .reduce((n, i) => n + i.quantity, 0),
        0,
      );
      return {
        ...t,
        delivered,
        returned,
        available: Math.max(0, delivered - returned),
      };
    });
    return {
      customer,
      sizes,
      creditBalance: receipts
        .filter((r) => r.status === "CONFIRMED")
        .reduce((n, r) => n + Number(r.remainingCredit), 0),
      invoices: invoices
        .map((i) => ({
          ...i,
          cans: sizes
            .map((t) => ({
              name: t.name,
              quantity: deliveries
                .filter((d) => d.orderId === i.orderId)
                .reduce(
                  (n, d) =>
                    n +
                    d.items
                      .filter((item) =>
                        (t.productIds as number[]).includes(item.productId),
                      )
                      .reduce(
                        (v, item) =>
                          v + Math.floor(Number(item.deliveredQuantity)),
                        0,
                      ),
                  0,
                ),
            }))
            .filter((t) => t.quantity > 0),
        }))
        .filter((i) => i.cans.length),
    };
  }
  async list(actor: AuthenticatedUser, query: CanReturnQuery = {}) {
    const officeId = await this.officeScope(actor);
    const isManager = actor.roles.some((r) =>
      [
        "SUPER_ADMIN",
        "MAIN_OFFICE_AUTHORIZED_USER",
        "BRANCH_AUTHORIZED_USER",
      ].includes(r),
    );
    return this.prisma.canReturn.findMany({
      where: {
        officeId,
        collectedById: isManager ? query.collectorId : actor.id,
        collectedAt: query.date
          ? {
              gte: new Date(query.date + "T00:00:00Z"),
              lt: new Date(
                new Date(query.date + "T00:00:00Z").getTime() + 86400000,
              ),
            }
          : undefined,
      },
      include: {
        customer: true,
        applications: { include: { salesInvoice: true } },
      },
      orderBy: { collectedAt: "desc" },
      take: 100,
      skip: ((query.page ?? 1) - 1) * 100,
    });
  }
  async create(dto: CreateCanReturnDto, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: dto.customerId },
        data: { canReturnLock: { increment: 1 } },
      });
      const info = await this.eligibility(dto.customerId, actor, tx);
      if (new Set(dto.items.map((i) => i.canTypeId)).size !== dto.items.length)
        throw new BadRequestException("Each can size must appear once");
      const items = dto.items.map((i) => {
        const type = info.sizes.find((t) => t.id === i.canTypeId);
        if (!type || i.quantity > type.available)
          throw new BadRequestException(
            "Returned quantity exceeds delivered cans available for return",
          );
        return { ...i, name: type.name, returnValue: Number(type.returnValue) };
      });
      const totalAmount = items.reduce(
        (sum, i) => sum.plus(new Prisma.Decimal(i.returnValue).mul(i.quantity)),
        new Prisma.Decimal(0),
      );
      const record = await tx.canReturn.create({
        data: {
          customerId: dto.customerId,
          officeId: info.customer.officeId,
          collectedById: actor.id,
          items,
          totalAmount,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "CAN_RETURN_COLLECTED",
          entityType: "can_return",
          entityId: String(record.id),
        },
      });
      return record;
    });
  }
  async confirm(id: number, actor: AuthenticatedUser, reject = false) {
    const officeId = await this.officeScope(actor);
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.canReturn.findFirst({ where: { id, officeId } });
      if (!record)
        throw new ForbiddenException("Can return not available in your branch");
      await tx.customer.update({
        where: { id: record.customerId },
        data: { canReturnLock: { increment: 1 } },
      });
      const changed = await tx.canReturn.updateMany({
        where: { id, status: "TEMPORARY" },
        data: {
          status: reject ? "REJECTED" : "CONFIRMED",
          confirmedAt: new Date(),
          confirmedById: actor.id,
          remainingCredit: reject ? 0 : record.totalAmount,
        },
      });
      if (!changed.count)
        throw new BadRequestException("Only temporary returns can be reviewed");
      if (!reject) await applyCanCredits(tx, record.customerId);
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: reject ? "CAN_RETURN_REJECTED" : "CAN_RETURN_CONFIRMED",
          entityType: "can_return",
          entityId: String(id),
        },
      });
      return tx.canReturn.findUnique({
        where: { id },
        include: { applications: true },
      });
    });
  }
}
