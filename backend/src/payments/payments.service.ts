import {
  BadRequestException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { settlePayment, validateAllocations } from "./settle-payment";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { RequestContext } from "../common/types/request-context.type";
import { toAuditJson } from "../common/utils/audit-json.util";
import {
  getPagination,
  toPaginatedResult,
} from "../common/utils/pagination.util";
import { PrismaService } from "../prisma/prisma.service";
import {
  ConfirmPaymentDto,
  CancelPaymentDto,
  CreatePaymentDto,
  PaymentQueryDto,
} from "./dto/payment.dto";

const paymentInclude = {
  cheque: true,
  customer: true,
  salesInvoice: true,
} satisfies Prisma.PaymentInclude;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  async listPayments(query: PaymentQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.PaymentWhereInput = {
      customerId: query.customerId,
      method: query.method,
      salesInvoiceId: query.salesInvoiceId,
      status: query.status,
    };

    if (query.search) {
      where.OR = [
        { paymentNumber: { contains: query.search } },
        { customer: { code: { contains: query.search } } },
        { customer: { displayName: { contains: query.search } } },
        { salesInvoice: { invoiceNumber: { contains: query.search } } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        include: paymentInclude,
        orderBy: { paymentDate: "desc" },
        skip,
        take,
        where,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async findPaymentById(id: number) {
    const payment = await this.prisma.payment.findUnique({
      include: paymentInclude,
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    return payment;
  }

  async createPayment(dto: CreatePaymentDto, context: RequestContext) {
    if (dto.allocations && dto.salesInvoiceId)
      throw new BadRequestException(
        "Use invoice allocations or a single invoice, not both",
      );
    await this.ensureCustomer(dto.customerId);
    const invoice = dto.salesInvoiceId
      ? await this.ensureInvoice(dto.salesInvoiceId, dto.customerId)
      : undefined;

    if (!["CASH", "CHEQUE"].includes(dto.method)) {
      throw new BadRequestException("Collections must be cash or cheque");
    }
    if (dto.method !== "CHEQUE" && dto.cheque) {
      throw new BadRequestException(
        "Cheque details are only valid for cheque payments",
      );
    }
    if (invoice && Number(dto.amount) > Number(invoice.balanceAmount)) {
      throw new BadRequestException("Payment amount exceeds invoice balance");
    }

    const outstanding = await this.customerOutstanding(dto.customerId);
    if (dto.amount > outstanding.totalOutstanding)
      throw new BadRequestException(
        "Payment exceeds customer outstanding balance",
      );
    const paymentNumber = await this.generatePaymentNumber();
    const payment = await this.prisma.$transaction(async (tx) => {
      const allocations = dto.allocations
        ? await validateAllocations(
            tx,
            dto.customerId,
            dto.amount,
            dto.allocations,
          )
        : undefined;
      const createdPayment = await tx.payment.create({
        data: {
          allocations,
          amount: dto.amount,
          status: "TEMPORARY",
          createdById: context.actor.id,
          customerId: dto.customerId,
          method: dto.method,
          notes: dto.notes,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          paymentNumber,
          salesInvoiceId: dto.salesInvoiceId,
        },
      });

      if (dto.method === "CHEQUE") {
        await tx.cheque.create({
          data: {
            amount: dto.amount,
            bankName: dto.cheque?.bankName?.trim() || null,
            branchName: dto.cheque?.branchName,
            chequeDate: dto.cheque?.chequeDate
              ? new Date(dto.cheque.chequeDate)
              : null,
            chequeNumber: dto.cheque?.chequeNumber?.trim() || null,
            createdById: context.actor.id,
            customerId: dto.customerId,
            paymentId: createdPayment.id,
            receivedDate: dto.paymentDate
              ? new Date(dto.paymentDate)
              : new Date(),
            salesInvoiceId: dto.salesInvoiceId,
          },
        });
      }

      return tx.payment.findUnique({
        include: paymentInclude,
        where: { id: createdPayment.id },
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
      userAgent: context.userAgent,
    });

    return payment;
  }

  async cancelPayment(
    id: number,
    dto: CancelPaymentDto,
    context: RequestContext,
  ) {
    const payment = await this.findPaymentById(id);
    if (payment.status === "CANCELLED") {
      throw new BadRequestException("Payment is already cancelled");
    }

    const cancelledPayment = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id, status: payment.status },
        data: { status: "CANCELLED" },
      });
      if (!claimed.count)
        throw new BadRequestException("Payment changed; refresh and try again");
      if (payment.allocations && payment.status === "POSTED") {
        for (const allocation of payment.allocations as {
          invoiceId: number;
          amount: number;
        }[]) {
          await this.reverseInvoicePayment(
            tx,
            allocation.invoiceId,
            allocation.amount,
          );
        }
      } else if (
        payment.status === "POSTED" &&
        payment.salesInvoiceId &&
        payment.method !== "CHEQUE"
      ) {
        await this.reverseInvoicePayment(
          tx,
          payment.salesInvoiceId,
          Number(payment.amount),
        );
      }

      if (payment.cheque) {
        if (
          !payment.allocations &&
          payment.cheque.status === "REALIZED" &&
          payment.salesInvoiceId
        ) {
          await this.reverseInvoicePayment(
            tx,
            payment.salesInvoiceId,
            Number(payment.amount),
          );
        }

        await tx.cheque.update({
          data: {
            returnedReason: dto.notes,
            status: "CANCELLED",
            updatedById: context.actor.id,
          },
          where: { id: payment.cheque.id },
        });
      }

      return tx.payment.update({
        data: {
          cancelledAt: new Date(),
          cancelledById: context.actor.id,
          notes: dto.notes ?? payment.notes,
          status: "CANCELLED",
        },
        include: paymentInclude,
        where: { id },
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
      userAgent: context.userAgent,
    });

    return cancelledPayment;
  }

  async customerOutstanding(customerId: number) {
    await this.ensureCustomer(customerId);
    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        customerId,
        deletedAt: null,
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
        balanceAmount: { gt: 0 },
      },
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    });
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return {
      invoices,
      totalOutstanding: invoices.reduce(
        (sum, i) => sum + Number(i.balanceAmount),
        0,
      ),
      overdueAmount: invoices
        .filter((i) => i.dueDate < today)
        .reduce((sum, i) => sum + Number(i.balanceAmount), 0),
    };
  }

  async confirmPayment(
    id: number,
    dto: ConfirmPaymentDto,
    context: RequestContext,
  ) {
    const payment = await this.findPaymentById(id);
    if (
      context.actor.roles.includes("BRANCH_AUTHORIZED_USER") &&
      !context.actor.roles.some((r) =>
        ["SUPER_ADMIN", "MAIN_OFFICE_AUTHORIZED_USER"].includes(r),
      )
    ) {
      const employee = await this.prisma.employee.findUnique({
        where: { userId: context.actor.id },
      });
      if (
        !employee ||
        employee.status !== "ACTIVE" ||
        (employee.branchId ?? employee.officeId) !== payment.customer.officeId
      ) {
        throw new ForbiddenException(
          "Only payments for your branch can be confirmed",
        );
      }
    }
    const chequeNumber =
      dto.chequeNumber?.trim() || payment.cheque?.chequeNumber;
    const chequeDate = dto.chequeDate
      ? new Date(dto.chequeDate)
      : payment.cheque?.chequeDate;
    if (payment.method === "CHEQUE" && (!chequeNumber || !chequeDate)) {
      throw new BadRequestException(
        "Cheque number and cheque date are required at handover",
      );
    }
    const confirmed = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id, status: "TEMPORARY" },
        data: {
          status: payment.method === "CHEQUE" ? "AWAITING_CLEARANCE" : "POSTED",
          confirmedAt: new Date(),
          confirmedById: context.actor.id,
        },
      });
      if (!claimed.count)
        throw new BadRequestException(
          "Only temporary payments can be confirmed",
        );
      if (payment.method === "CHEQUE") {
        await tx.cheque.update({
          where: { paymentId: id },
          data: {
            chequeNumber,
            chequeDate,
            bankName: dto.bankName?.trim() || payment.cheque?.bankName,
            updatedById: context.actor.id,
          },
        });
      } else {
        await settlePayment(tx, payment);
      }
      return tx.payment.findUnique({ where: { id }, include: paymentInclude });
    });
    await this.auditService.record({
      action: "PAYMENT_HANDOVER_CONFIRMED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "payment",
      oldValues: toAuditJson(payment),
      newValues: toAuditJson(confirmed),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return confirmed;
  }

  private async reverseInvoicePayment(
    tx: Prisma.TransactionClient,
    invoiceId: number,
    amount: number,
  ) {
    const invoice = await tx.salesInvoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice || invoice.status === "CANCELLED") {
      throw new BadRequestException("Invoice is invalid");
    }

    const nextPaid = Math.max(Number(invoice.paidAmount) - amount, 0);
    const maxBalance = Math.max(
      Number(invoice.totalAmount) - Number(invoice.returnTotal),
      0,
    );
    const nextBalance = Math.min(
      Number(invoice.balanceAmount) + amount,
      maxBalance,
    );

    return tx.salesInvoice.update({
      data: {
        balanceAmount: nextBalance,
        paidAmount: nextPaid,
        status: nextPaid === 0 ? "ISSUED" : "PARTIALLY_PAID",
      },
      where: { id: invoiceId },
    });
  }

  private async ensureCustomer(customerId: number) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, status: { not: "DELETED" } },
    });
    if (!customer) {
      throw new BadRequestException("Customer is invalid");
    }
  }

  private async ensureInvoice(invoiceId: number, customerId: number) {
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: { deletedAt: null, id: invoiceId, status: { not: "CANCELLED" } },
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
    return `PAY-${randomUUID()}`;
  }
}
