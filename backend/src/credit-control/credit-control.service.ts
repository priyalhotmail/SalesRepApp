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
  CreateCreditOverrideRequestDto,
  CreditAgingQueryDto,
  CreditCheckDto,
  CreditOverrideRequestQueryDto,
  ReviewCreditOverrideRequestDto,
  UpdateCustomerCreditDto
} from "./dto/credit-control.dto";

@Injectable()
export class CreditControlService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async getCustomerSummary(customerId: number) {
    const customer = await this.ensureCustomer(customerId);
    const outstandingBalance = await this.getOutstandingBalance(customerId);
    const creditLimit = Number(customer.creditLimit);
    const availableCredit =
      creditLimit > 0 ? Number((creditLimit - outstandingBalance).toFixed(2)) : null;

    return {
      availableCredit,
      creditHold: customer.creditHold,
      creditLimit,
      creditTermsDays: customer.creditTermsDays,
      customerId,
      customerName: customer.displayName,
      outstandingBalance
    };
  }

  async updateCustomerSettings(
    customerId: number,
    dto: UpdateCustomerCreditDto,
    context: RequestContext
  ) {
    const customer = await this.ensureCustomer(customerId);
    const updatedCustomer = await this.prisma.customer.update({
      data: {
        creditHold: dto.creditHold,
        creditLimit: dto.creditLimit,
        creditTermsDays: dto.creditTermsDays,
        updatedById: context.actor.id
      },
      where: { id: customerId }
    });

    await this.auditService.record({
      action: "CUSTOMER_CREDIT_SETTINGS_UPDATED",
      actorUserId: context.actor.id,
      entityId: customerId,
      entityType: "customer",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: toAuditJson(customer),
      userAgent: context.userAgent
    });

    return updatedCustomer;
  }

  async checkCredit(dto: CreditCheckDto) {
    const checkInput = await this.resolveCheckInput(dto);
    const customer = await this.ensureCustomer(checkInput.customerId);
    const outstandingBalance = await this.getOutstandingBalance(customer.id);
    const creditLimit = Number(customer.creditLimit);
    const projectedOutstanding = Number(
      (outstandingBalance + checkInput.orderAmount).toFixed(2)
    );
    const hasOverride = checkInput.orderId
      ? await this.hasApprovedOverride(checkInput.orderId, checkInput.orderAmount)
      : false;
    const blockedByHold = customer.creditHold && !hasOverride;
    const blockedByLimit =
      creditLimit > 0 && projectedOutstanding > creditLimit && !hasOverride;

    return {
      allowed: !blockedByHold && !blockedByLimit,
      availableCredit:
        creditLimit > 0 ? Number((creditLimit - outstandingBalance).toFixed(2)) : null,
      blockedByHold,
      blockedByLimit,
      creditHold: customer.creditHold,
      creditLimit,
      customerId: customer.id,
      hasOverride,
      orderAmount: checkInput.orderAmount,
      outstandingBalance,
      projectedOutstanding
    };
  }

  async getAgingReport(query: CreditAgingQueryDto) {
    const invoices = await this.prisma.salesInvoice.findMany({
      include: { customer: true },
      orderBy: { dueDate: "asc" },
      where: {
        balanceAmount: { gt: 0 },
        customerId: query.customerId,
        status: { notIn: ["CANCELLED", "PAID"] }
      }
    });
    const today = new Date();
    const buckets = {
      current: 0,
      days1To30: 0,
      days31To60: 0,
      days61To90: 0,
      over90: 0
    };

    const rows = invoices.map((invoice) => {
      const daysPastDue = Math.floor(
        (today.getTime() - invoice.dueDate.getTime()) / 86400000
      );
      const balanceAmount = Number(invoice.balanceAmount);
      if (daysPastDue <= 0) {
        buckets.current += balanceAmount;
      } else if (daysPastDue <= 30) {
        buckets.days1To30 += balanceAmount;
      } else if (daysPastDue <= 60) {
        buckets.days31To60 += balanceAmount;
      } else if (daysPastDue <= 90) {
        buckets.days61To90 += balanceAmount;
      } else {
        buckets.over90 += balanceAmount;
      }

      return {
        balanceAmount,
        customerCode: invoice.customer.code,
        customerId: invoice.customerId,
        customerName: invoice.customer.displayName,
        daysPastDue,
        dueDate: invoice.dueDate,
        invoiceDate: invoice.invoiceDate,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber
      };
    });

    return {
      buckets: {
        current: Number(buckets.current.toFixed(2)),
        days1To30: Number(buckets.days1To30.toFixed(2)),
        days31To60: Number(buckets.days31To60.toFixed(2)),
        days61To90: Number(buckets.days61To90.toFixed(2)),
        over90: Number(buckets.over90.toFixed(2))
      },
      rows
    };
  }

  async createOverrideRequest(
    dto: CreateCreditOverrideRequestDto,
    context: RequestContext
  ) {
    const customer = await this.ensureCustomer(dto.customerId);
    const order = dto.orderId
      ? await this.ensureOrder(dto.orderId, dto.customerId)
      : undefined;
    const requestedAmount = dto.requestedAmount ?? Number(order?.totalAmount ?? 0);
    if (requestedAmount <= 0) {
      throw new BadRequestException("Requested amount is required");
    }

    const request = await this.prisma.creditOverrideRequest.create({
      data: {
        creditLimit: Number(customer.creditLimit),
        customerId: dto.customerId,
        orderId: dto.orderId,
        outstandingBalance: await this.getOutstandingBalance(dto.customerId),
        reason: dto.reason,
        requestedAmount,
        requestedById: context.actor.id
      },
      include: { customer: true, order: true, requestedBy: true, reviewedBy: true }
    });

    await this.auditService.record({
      action: "CREDIT_OVERRIDE_REQUESTED",
      actorUserId: context.actor.id,
      entityId: request.id,
      entityType: "credit_override_request",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(request),
      userAgent: context.userAgent
    });

    return request;
  }

  async listOverrideRequests(query: CreditOverrideRequestQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.CreditOverrideRequestWhereInput = {
      customerId: query.customerId,
      orderId: query.orderId,
      status: query.status
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.creditOverrideRequest.findMany({
        include: { customer: true, order: true, requestedBy: true, reviewedBy: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
        where
      }),
      this.prisma.creditOverrideRequest.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async approveOverrideRequest(
    id: number,
    dto: ReviewCreditOverrideRequestDto,
    context: RequestContext
  ) {
    return this.reviewOverrideRequest(id, "APPROVED", dto, context);
  }

  async rejectOverrideRequest(
    id: number,
    dto: ReviewCreditOverrideRequestDto,
    context: RequestContext
  ) {
    return this.reviewOverrideRequest(id, "REJECTED", dto, context);
  }

  private async reviewOverrideRequest(
    id: number,
    status: "APPROVED" | "REJECTED",
    dto: ReviewCreditOverrideRequestDto,
    context: RequestContext
  ) {
    const request = await this.prisma.creditOverrideRequest.findFirst({
      where: { id, status: "PENDING" }
    });
    if (!request) {
      throw new NotFoundException("Pending credit override request not found");
    }

    const reviewedRequest = await this.prisma.creditOverrideRequest.update({
      data: {
        reviewedAt: new Date(),
        reviewedById: context.actor.id,
        reviewNote: dto.reviewNote,
        status
      },
      include: { customer: true, order: true, requestedBy: true, reviewedBy: true },
      where: { id }
    });

    await this.auditService.record({
      action:
        status === "APPROVED"
          ? "CREDIT_OVERRIDE_APPROVED"
          : "CREDIT_OVERRIDE_REJECTED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "credit_override_request",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(reviewedRequest),
      oldValues: toAuditJson(request),
      userAgent: context.userAgent
    });

    return reviewedRequest;
  }

  private async resolveCheckInput(dto: CreditCheckDto) {
    if (dto.orderId) {
      const order = await this.prisma.order.findFirst({
        where: { deletedAt: null, id: dto.orderId }
      });
      if (!order) {
        throw new BadRequestException("Order is invalid");
      }
      return {
        customerId: order.customerId,
        orderAmount: Number(order.totalAmount),
        orderId: order.id
      };
    }

    if (!dto.customerId || dto.orderAmount === undefined) {
      throw new BadRequestException("Provide orderId or customerId with orderAmount");
    }

    return {
      customerId: dto.customerId,
      orderAmount: dto.orderAmount,
      orderId: undefined
    };
  }

  private async hasApprovedOverride(orderId: number, amount: number) {
    const override = await this.prisma.creditOverrideRequest.findFirst({
      where: {
        orderId,
        requestedAmount: { gte: amount },
        status: "APPROVED"
      }
    });
    return Boolean(override);
  }

  private async getOutstandingBalance(customerId: number) {
    const aggregate = await this.prisma.salesInvoice.aggregate({
      _sum: { balanceAmount: true },
      where: {
        customerId,
        status: { notIn: ["CANCELLED", "PAID"] }
      }
    });

    return Number(aggregate._sum.balanceAmount ?? 0);
  }

  private async ensureCustomer(customerId: number) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, status: { not: "DELETED" } }
    });
    if (!customer) {
      throw new BadRequestException("Customer is invalid");
    }
    return customer;
  }

  private async ensureOrder(orderId: number, customerId: number) {
    const order = await this.prisma.order.findFirst({
      where: { customerId, deletedAt: null, id: orderId, status: { not: "CANCELLED" } }
    });
    if (!order) {
      throw new BadRequestException("Order is invalid for this customer");
    }
    return order;
  }
}
