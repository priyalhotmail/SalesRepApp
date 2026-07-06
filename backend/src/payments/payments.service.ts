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
import {
  CancelPaymentDto,
  CreatePaymentDto,
  PaymentQueryDto
} from "./dto/payment.dto";

const paymentInclude = {
  cheque: true,
  customer: true,
  salesInvoice: true
} satisfies Prisma.PaymentInclude;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async listPayments(query: PaymentQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.PaymentWhereInput = {
      customerId: query.customerId,
      method: query.method,
      salesInvoiceId: query.salesInvoiceId,
      status: query.status
    };

    if (query.search) {
      where.OR = [
        { paymentNumber: { contains: query.search } },
        { customer: { code: { contains: query.search } } },
        { customer: { displayName: { contains: query.search } } },
        { salesInvoice: { invoiceNumber: { contains: query.search } } }
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        include: paymentInclude,
        orderBy: { paymentDate: "desc" },
        skip,
        take,
        where
      }),
      this.prisma.payment.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async findPaymentById(id: number) {
    const payment = await this.prisma.payment.findUnique({
      include: paymentInclude,
      where: { id }
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    return payment;
  }

  async createPayment(dto: CreatePaymentDto, context: RequestContext) {
    await this.ensureCustomer(dto.customerId);
    const invoice = dto.salesInvoiceId
      ? await this.ensureInvoice(dto.salesInvoiceId, dto.customerId)
      : undefined;

    if (dto.method === "CHEQUE" && !dto.cheque) {
      throw new BadRequestException("Cheque details are required");
    }
    if (dto.method !== "CHEQUE" && dto.cheque) {
      throw new BadRequestException("Cheque details are only valid for cheque payments");
    }
    if (invoice && Number(dto.amount) > Number(invoice.balanceAmount)) {
      throw new BadRequestException("Payment amount exceeds invoice balance");
    }

    const paymentNumber = await this.generatePaymentNumber();
    const payment = await this.prisma.$transaction(async (tx) => {
      const createdPayment = await tx.payment.create({
        data: {
          amount: dto.amount,
          createdById: context.actor.id,
          customerId: dto.customerId,
          method: dto.method,
          notes: dto.notes,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          paymentNumber,
          salesInvoiceId: dto.salesInvoiceId
        }
      });

      if (dto.method === "CHEQUE" && dto.cheque) {
        await tx.cheque.create({
          data: {
            amount: dto.amount,
            bankName: dto.cheque.bankName.trim(),
            branchName: dto.cheque.branchName,
            chequeDate: new Date(dto.cheque.chequeDate),
            chequeNumber: dto.cheque.chequeNumber.trim(),
            createdById: context.actor.id,
            customerId: dto.customerId,
            paymentId: createdPayment.id,
            receivedDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
            salesInvoiceId: dto.salesInvoiceId
          }
        });
      } else if (dto.salesInvoiceId) {
        await this.applyInvoicePayment(tx, dto.salesInvoiceId, dto.amount);
      }

      return tx.payment.findUnique({
        include: paymentInclude,
        where: { id: createdPayment.id }
      });
    });

    if (!payment) {
      throw new NotFoundException("Created payment could not be loaded");
    }

    await this.auditService.record({
      action: "PAYMENT_CREATED",
      actorUserId: context.actor.id,
      entityId: payment.id,
      entityType: "payment",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(payment),
      userAgent: context.userAgent
    });

    return payment;
  }

  async cancelPayment(
    id: number,
    dto: CancelPaymentDto,
    context: RequestContext
  ) {
    const payment = await this.findPaymentById(id);
    if (payment.status === "CANCELLED") {
      throw new BadRequestException("Payment is already cancelled");
    }

    const cancelledPayment = await this.prisma.$transaction(async (tx) => {
      if (payment.salesInvoiceId && payment.method !== "CHEQUE") {
        await this.reverseInvoicePayment(
          tx,
          payment.salesInvoiceId,
          Number(payment.amount)
        );
      }

      if (payment.cheque) {
        if (payment.cheque.status === "REALIZED" && payment.salesInvoiceId) {
          await this.reverseInvoicePayment(
            tx,
            payment.salesInvoiceId,
            Number(payment.amount)
          );
        }

        await tx.cheque.update({
          data: {
            returnedReason: dto.notes,
            status: "CANCELLED",
            updatedById: context.actor.id
          },
          where: { id: payment.cheque.id }
        });
      }

      return tx.payment.update({
        data: {
          cancelledAt: new Date(),
          cancelledById: context.actor.id,
          notes: dto.notes ?? payment.notes,
          status: "CANCELLED"
        },
        include: paymentInclude,
        where: { id }
      });
    });

    await this.auditService.record({
      action: "PAYMENT_CANCELLED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "payment",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(cancelledPayment),
      oldValues: toAuditJson(payment),
      userAgent: context.userAgent
    });

    return cancelledPayment;
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

  private async reverseInvoicePayment(
    tx: Prisma.TransactionClient,
    invoiceId: number,
    amount: number
  ) {
    const invoice = await tx.salesInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.status === "CANCELLED") {
      throw new BadRequestException("Invoice is invalid");
    }

    const nextPaid = Math.max(Number(invoice.paidAmount) - amount, 0);
    const maxBalance = Math.max(
      Number(invoice.totalAmount) - Number(invoice.returnTotal),
      0
    );
    const nextBalance = Math.min(Number(invoice.balanceAmount) + amount, maxBalance);

    return tx.salesInvoice.update({
      data: {
        balanceAmount: nextBalance,
        paidAmount: nextPaid,
        status: nextPaid === 0 ? "ISSUED" : "PARTIALLY_PAID"
      },
      where: { id: invoiceId }
    });
  }

  private async ensureCustomer(customerId: number) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, status: { not: "DELETED" } }
    });
    if (!customer) {
      throw new BadRequestException("Customer is invalid");
    }
  }

  private async ensureInvoice(invoiceId: number, customerId: number) {
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: { deletedAt: null, id: invoiceId, status: { not: "CANCELLED" } }
    });
    if (!invoice) {
      throw new BadRequestException("Invoice is invalid");
    }
    if (invoice.customerId !== customerId) {
      throw new BadRequestException("Invoice does not belong to the customer");
    }
    return invoice;
  }

  private async generatePaymentNumber() {
    const count = await this.prisma.payment.count();
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `PAY-${datePart}-${String(count + 1).padStart(5, "0")}`;
  }
}
