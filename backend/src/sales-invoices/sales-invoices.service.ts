import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { RequestContext } from "../common/types/request-context.type";
import { toAuditJson } from "../common/utils/audit-json.util";
import { isSalesRepScopedActor } from "../common/utils/user-scope.util";
import { getPagination, toPaginatedResult } from "../common/utils/pagination.util";
import { PrismaService } from "../prisma/prisma.service";
import {
  CancelSalesInvoiceDto,
  CreateInvoiceFromOrderDto,
  SalesInvoiceQueryDto
} from "./dto/sales-invoice.dto";

const invoiceInclude = {
  customer: true,
  items: { include: { product: true } },
  order: true,
  payments: true,
  returns: true
} satisfies Prisma.SalesInvoiceInclude;

@Injectable()
export class SalesInvoicesService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async listInvoices(query: SalesInvoiceQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.SalesInvoiceWhereInput = {
      customerId: query.customerId,
      deletedAt: null,
      orderId: query.orderId,
      status: query.status
    };

    if (query.search) {
      where.OR = [
        { invoiceNumber: { contains: query.search } },
        { customer: { code: { contains: query.search } } },
        { customer: { displayName: { contains: query.search } } },
        { order: { orderNumber: { contains: query.search } } }
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.salesInvoice.findMany({
        include: invoiceInclude,
        orderBy: { invoiceDate: "desc" },
        skip,
        take,
        where
      }),
      this.prisma.salesInvoice.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async findInvoiceById(id: number) {
    const invoice = await this.prisma.salesInvoice.findFirst({
      include: invoiceInclude,
      where: { deletedAt: null, id }
    });

    if (!invoice) {
      throw new NotFoundException("Sales invoice not found");
    }

    return invoice;
  }

  async listEligibleOrders(actor: AuthenticatedUser) {
    const salesRepId = isSalesRepScopedActor(actor)
      ? await this.getSalesRepId(actor.id)
      : undefined;

    return this.prisma.order.findMany({
      include: { customer: true },
      orderBy: { orderDate: "desc" },
      where: {
        deletedAt: null,
        salesInvoice: null,
        salesRepId,
        status: { in: ["APPROVED", "RESERVED", "LOADING", "DELIVERED"] }
      }
    });
  }

  async createFromOrder(
    dto: CreateInvoiceFromOrderDto,
    context: RequestContext
  ) {
    const salesRepId = isSalesRepScopedActor(context.actor)
      ? await this.getSalesRepId(context.actor.id)
      : undefined;
    const order = await this.prisma.order.findFirst({
      include: { customer: true, items: true },
      where: { deletedAt: null, id: dto.orderId, salesRepId }
    });

    if (!order) {
      throw new BadRequestException("Order is invalid");
    }
    if (["DRAFT", "SUBMITTED", "CANCELLED"].includes(order.status)) {
      throw new BadRequestException("Order is not ready for invoicing");
    }

    const existingInvoice = await this.prisma.salesInvoice.findFirst({
      where: { orderId: order.id }
    });
    if (existingInvoice) {
      throw new ConflictException("Order already has an active invoice");
    }

    const invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();
    const dueDate =
      dto.dueDate ?? this.calculateDueDate(invoiceDate, order.customer.creditTermsDays);
    const invoiceNumber = await this.generateInvoiceNumber();

    const invoice = await this.prisma.salesInvoice.create({
      data: {
        balanceAmount: Number(order.totalAmount),
        createdById: context.actor.id,
        customerId: order.customerId,
        discountTotal: Number(order.discountTotal),
        dueDate: new Date(dueDate),
        invoiceDate,
        invoiceNumber,
        items: {
          create: order.items.map((item) => ({
            discountAmount: Number(item.discountAmount),
            freeQuantity: Number(item.freeQuantity),
            lineTotal: Number(item.lineTotal),
            productId: item.productId,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice)
          }))
        },
        notes: dto.notes,
        orderId: order.id,
        subtotal: Number(order.subtotal),
        totalAmount: Number(order.totalAmount)
      },
      include: invoiceInclude
    });

    await this.auditService.record({
      action: "SALES_INVOICE_CREATED",
      actorUserId: context.actor.id,
      entityId: invoice.id,
      entityType: "sales_invoice",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(invoice),
      userAgent: context.userAgent
    });

    return invoice;
  }

  async cancelInvoice(
    id: number,
    dto: CancelSalesInvoiceDto,
    context: RequestContext
  ) {
    const invoice = await this.findInvoiceById(id);
    if (invoice.status === "CANCELLED") {
      throw new BadRequestException("Invoice is already cancelled");
    }
    if (Number(invoice.paidAmount) > 0) {
      throw new BadRequestException("Paid invoices cannot be cancelled");
    }

    const cancelledInvoice = await this.prisma.salesInvoice.update({
      data: {
        deletedAt: new Date(),
        deletedById: context.actor.id,
        notes: dto.notes ?? invoice.notes,
        status: "CANCELLED",
        updatedById: context.actor.id
      },
      include: invoiceInclude,
      where: { id }
    });

    await this.auditService.record({
      action: "SALES_INVOICE_CANCELLED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "sales_invoice",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(cancelledInvoice),
      oldValues: toAuditJson(invoice),
      userAgent: context.userAgent
    });

    return cancelledInvoice;
  }

  private calculateDueDate(invoiceDate: Date, termsDays: number) {
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + termsDays);
    return dueDate.toISOString();
  }

  private async getSalesRepId(userId: number) {
    const salesRep = await this.prisma.salesRep.findFirst({
      select: { id: true },
      where: { status: "ACTIVE", userId }
    });

    if (!salesRep) {
      throw new BadRequestException("Authenticated user is not linked to an active sales rep");
    }

    return salesRep.id;
  }

  private async generateInvoiceNumber() {
    const count = await this.prisma.salesInvoice.count();
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `INV-${datePart}-${String(count + 1).padStart(5, "0")}`;
  }
}
