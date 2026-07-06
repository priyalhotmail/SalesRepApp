import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { RequestContext } from "../common/types/request-context.type";
import { toAuditJson } from "../common/utils/audit-json.util";
import { getPagination, toPaginatedResult } from "../common/utils/pagination.util";
import { PrismaService } from "../prisma/prisma.service";
import { ChequeQueryDto, ReturnChequeDto } from "./dto/cheque.dto";

const chequeInclude = {
  customer: true,
  payment: true,
  salesInvoice: true
} satisfies Prisma.ChequeInclude;

@Injectable()
export class ChequesService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async listCheques(query: ChequeQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.ChequeWhereInput = {
      customerId: query.customerId,
      salesInvoiceId: query.salesInvoiceId,
      status: query.status
    };

    if (query.search) {
      where.OR = [
        { chequeNumber: { contains: query.search } },
        { bankName: { contains: query.search } },
        { customer: { code: { contains: query.search } } },
        { customer: { displayName: { contains: query.search } } },
        { salesInvoice: { invoiceNumber: { contains: query.search } } }
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.cheque.findMany({
        include: chequeInclude,
        orderBy: { receivedDate: "desc" },
        skip,
        take,
        where
      }),
      this.prisma.cheque.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async findChequeById(id: number) {
    const cheque = await this.prisma.cheque.findUnique({
      include: chequeInclude,
      where: { id }
    });
    if (!cheque) {
      throw new NotFoundException("Cheque not found");
    }
    return cheque;
  }

  async depositCheque(id: number, context: RequestContext) {
    const cheque = await this.findChequeById(id);
    if (cheque.status !== "RECEIVED") {
      throw new BadRequestException("Only received cheques can be deposited");
    }

    const depositedCheque = await this.prisma.cheque.update({
      data: {
        depositedAt: new Date(),
        status: "DEPOSITED",
        updatedById: context.actor.id
      },
      include: chequeInclude,
      where: { id }
    });

    await this.auditService.record({
      action: "CHEQUE_DEPOSITED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "cheque",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(depositedCheque),
      oldValues: toAuditJson(cheque),
      userAgent: context.userAgent
    });

    return depositedCheque;
  }

  async realizeCheque(id: number, context: RequestContext) {
    const cheque = await this.findChequeById(id);
    if (!["RECEIVED", "DEPOSITED"].includes(cheque.status)) {
      throw new BadRequestException("Only received or deposited cheques can be realized");
    }
    if (cheque.payment?.status === "CANCELLED") {
      throw new BadRequestException("Cancelled payment cheques cannot be realized");
    }

    const realizedCheque = await this.prisma.$transaction(async (tx) => {
      if (cheque.salesInvoiceId) {
        await this.applyInvoicePayment(
          tx,
          cheque.salesInvoiceId,
          Number(cheque.amount)
        );
      }

      return tx.cheque.update({
        data: {
          realizedAt: new Date(),
          status: "REALIZED",
          updatedById: context.actor.id
        },
        include: chequeInclude,
        where: { id }
      });
    });

    await this.auditService.record({
      action: "CHEQUE_REALIZED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "cheque",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(realizedCheque),
      oldValues: toAuditJson(cheque),
      userAgent: context.userAgent
    });

    return realizedCheque;
  }

  async returnCheque(
    id: number,
    dto: ReturnChequeDto,
    context: RequestContext
  ) {
    const cheque = await this.findChequeById(id);
    if (!["RECEIVED", "DEPOSITED"].includes(cheque.status)) {
      throw new BadRequestException("Only received or deposited cheques can be returned");
    }

    const returnedCheque = await this.prisma.cheque.update({
      data: {
        returnedAt: new Date(),
        returnedReason: dto.returnedReason,
        status: "RETURNED",
        updatedById: context.actor.id
      },
      include: chequeInclude,
      where: { id }
    });

    await this.auditService.record({
      action: "CHEQUE_RETURNED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "cheque",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(returnedCheque),
      oldValues: toAuditJson(cheque),
      userAgent: context.userAgent
    });

    return returnedCheque;
  }

  private async applyInvoicePayment(
    tx: Prisma.TransactionClient,
    invoiceId: number,
    amount: number
  ) {
    const invoice = await tx.salesInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.status === "CANCELLED") {
      throw new BadRequestException("Invoice is invalid");
    }
    if (amount > Number(invoice.balanceAmount)) {
      throw new BadRequestException("Cheque amount exceeds invoice balance");
    }

    const nextPaid = Number(invoice.paidAmount) + amount;
    const nextBalance = Math.max(Number(invoice.balanceAmount) - amount, 0);

    return tx.salesInvoice.update({
      data: {
        balanceAmount: nextBalance,
        paidAmount: nextPaid,
        status: nextBalance === 0 ? "PAID" : "PARTIALLY_PAID"
      },
      where: { id: invoiceId }
    });
  }
}
