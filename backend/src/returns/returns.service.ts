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
  CreateSalesReturnDto,
  ReceiveSalesReturnDto,
  ReviewSalesReturnDto,
  SalesReturnLineDto,
  SalesReturnQueryDto
} from "./dto/return.dto";

const returnInclude = {
  customer: true,
  items: { include: { product: true } },
  order: true,
  salesInvoice: true
} satisfies Prisma.SalesReturnInclude;

type PreparedReturnLine = {
  lineTotal: number;
  notes?: string;
  productId: number;
  quantity: number;
  unitPrice: number;
};

@Injectable()
export class ReturnsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async listReturns(query: SalesReturnQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.SalesReturnWhereInput = {
      customerId: query.customerId,
      orderId: query.orderId,
      salesInvoiceId: query.salesInvoiceId,
      status: query.status
    };

    if (query.search) {
      where.OR = [
        { returnNumber: { contains: query.search } },
        { customer: { code: { contains: query.search } } },
        { customer: { displayName: { contains: query.search } } },
        { order: { orderNumber: { contains: query.search } } },
        { salesInvoice: { invoiceNumber: { contains: query.search } } }
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.salesReturn.findMany({
        include: returnInclude,
        orderBy: { returnDate: "desc" },
        skip,
        take,
        where
      }),
      this.prisma.salesReturn.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async findReturnById(id: number) {
    const salesReturn = await this.prisma.salesReturn.findUnique({
      include: returnInclude,
      where: { id }
    });

    if (!salesReturn) {
      throw new NotFoundException("Sales return not found");
    }

    return salesReturn;
  }

  async createReturn(dto: CreateSalesReturnDto, context: RequestContext) {
    await this.ensureCustomer(dto.customerId);
    if (dto.orderId) {
      await this.ensureOrder(dto.orderId, dto.customerId);
    }
    if (dto.salesInvoiceId) {
      await this.ensureInvoice(dto.salesInvoiceId, dto.customerId);
    }

    const preparedItems = await this.prepareItems(dto.items);
    const totalAmount = Number(
      preparedItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2)
    );
    const returnNumber = await this.generateReturnNumber();

    const salesReturn = await this.prisma.salesReturn.create({
      data: {
        createdById: context.actor.id,
        customerId: dto.customerId,
        items: {
          create: preparedItems.map((item) => ({
            lineTotal: item.lineTotal,
            notes: item.notes,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice
          }))
        },
        notes: dto.notes,
        orderId: dto.orderId,
        reason: dto.reason,
        returnDate: dto.returnDate ? new Date(dto.returnDate) : new Date(),
        returnNumber,
        salesInvoiceId: dto.salesInvoiceId,
        totalAmount
      },
      include: returnInclude
    });

    await this.auditService.record({
      action: "SALES_RETURN_CREATED",
      actorUserId: context.actor.id,
      entityId: salesReturn.id,
      entityType: "sales_return",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(salesReturn),
      userAgent: context.userAgent
    });

    return salesReturn;
  }

  async approveReturn(
    id: number,
    dto: ReviewSalesReturnDto,
    context: RequestContext
  ) {
    const salesReturn = await this.findReturnById(id);
    if (salesReturn.status !== "REQUESTED") {
      throw new BadRequestException("Only requested returns can be approved");
    }

    const approvedReturn = await this.prisma.salesReturn.update({
      data: {
        reviewedAt: new Date(),
        reviewedById: context.actor.id,
        reviewNote: dto.reviewNote,
        status: "APPROVED"
      },
      include: returnInclude,
      where: { id }
    });

    await this.auditService.record({
      action: "SALES_RETURN_APPROVED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "sales_return",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(approvedReturn),
      oldValues: toAuditJson(salesReturn),
      userAgent: context.userAgent
    });

    return approvedReturn;
  }

  async rejectReturn(
    id: number,
    dto: ReviewSalesReturnDto,
    context: RequestContext
  ) {
    const salesReturn = await this.findReturnById(id);
    if (salesReturn.status !== "REQUESTED") {
      throw new BadRequestException("Only requested returns can be rejected");
    }

    const rejectedReturn = await this.prisma.salesReturn.update({
      data: {
        reviewedAt: new Date(),
        reviewedById: context.actor.id,
        reviewNote: dto.reviewNote,
        status: "REJECTED"
      },
      include: returnInclude,
      where: { id }
    });

    await this.auditService.record({
      action: "SALES_RETURN_REJECTED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "sales_return",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(rejectedReturn),
      oldValues: toAuditJson(salesReturn),
      userAgent: context.userAgent
    });

    return rejectedReturn;
  }

  async receiveReturn(
    id: number,
    dto: ReceiveSalesReturnDto,
    context: RequestContext
  ) {
    const salesReturn = await this.findReturnById(id);
    if (salesReturn.status !== "APPROVED") {
      throw new BadRequestException("Only approved returns can be received");
    }
    await this.ensureWarehouse(dto.warehouseId);
    if (
      salesReturn.salesInvoiceId &&
      Number(salesReturn.totalAmount) > Number(salesReturn.salesInvoice?.balanceAmount)
    ) {
      throw new BadRequestException("Return amount exceeds invoice balance");
    }

    const receivedReturn = await this.prisma.$transaction(async (tx) => {
      for (const item of salesReturn.items) {
        const stock = await this.getOrCreateStock(tx, dto.warehouseId, item.productId);
        const nextOnHand = Number(stock.onHandQuantity) + Number(item.quantity);
        const updatedStock = await tx.inventoryStock.update({
          data: { onHandQuantity: nextOnHand },
          where: { id: stock.id }
        });

        await tx.inventoryMovement.create({
          data: {
            balanceAfter: Number(updatedStock.onHandQuantity),
            createdById: context.actor.id,
            movementType: "RETURN_RECEIPT",
            notes: `Return ${salesReturn.returnNumber} received`,
            productId: item.productId,
            quantity: Number(item.quantity),
            referenceId: String(salesReturn.id),
            referenceType: "sales_return",
            warehouseId: dto.warehouseId
          }
        });
      }

      if (salesReturn.salesInvoiceId) {
        await this.applyReturnToInvoice(
          tx,
          salesReturn.salesInvoiceId,
          Number(salesReturn.totalAmount)
        );
      }

      return tx.salesReturn.update({
        data: {
          reviewedAt: new Date(),
          reviewedById: context.actor.id,
          reviewNote: dto.reviewNote ?? salesReturn.reviewNote,
          status: "RECEIVED"
        },
        include: returnInclude,
        where: { id }
      });
    });

    await this.auditService.record({
      action: "SALES_RETURN_RECEIVED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "sales_return",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(receivedReturn),
      oldValues: toAuditJson(salesReturn),
      userAgent: context.userAgent
    });

    return receivedReturn;
  }

  private async prepareItems(items: SalesReturnLineDto[]) {
    const preparedItems: PreparedReturnLine[] = [];

    for (const item of items) {
      const product = await this.ensureProduct(item.productId);
      const unitPrice = item.unitPrice ?? Number(product.price);
      preparedItems.push({
        lineTotal: Number((item.quantity * unitPrice).toFixed(2)),
        notes: item.notes,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice
      });
    }

    return preparedItems;
  }

  private async applyReturnToInvoice(
    tx: Prisma.TransactionClient,
    invoiceId: number,
    amount: number
  ) {
    const invoice = await tx.salesInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.status === "CANCELLED") {
      throw new BadRequestException("Invoice is invalid");
    }

    const nextReturnTotal = Number(invoice.returnTotal) + amount;
    const nextBalance = Math.max(Number(invoice.balanceAmount) - amount, 0);
    const nextStatus =
      nextBalance === 0
        ? "PAID"
        : Number(invoice.paidAmount) > 0
          ? "PARTIALLY_PAID"
          : "ISSUED";

    return tx.salesInvoice.update({
      data: {
        balanceAmount: nextBalance,
        returnTotal: nextReturnTotal,
        status: nextStatus
      },
      where: { id: invoiceId }
    });
  }

  private async getOrCreateStock(
    tx: Prisma.TransactionClient,
    warehouseId: number,
    productId: number
  ) {
    const existingStock = await tx.inventoryStock.findUnique({
      where: { warehouseId_productId: { productId, warehouseId } }
    });

    if (existingStock) {
      return existingStock;
    }

    return tx.inventoryStock.create({
      data: { productId, warehouseId }
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

  private async ensureOrder(orderId: number, customerId: number) {
    const order = await this.prisma.order.findFirst({
      where: { customerId, deletedAt: null, id: orderId }
    });
    if (!order) {
      throw new BadRequestException("Order is invalid for this customer");
    }
  }

  private async ensureInvoice(invoiceId: number, customerId: number) {
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: { customerId, deletedAt: null, id: invoiceId, status: { not: "CANCELLED" } }
    });
    if (!invoice) {
      throw new BadRequestException("Invoice is invalid for this customer");
    }
  }

  private async ensureProduct(productId: number) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: { not: "DELETED" } }
    });
    if (!product) {
      throw new BadRequestException("Product is invalid");
    }
    return product;
  }

  private async ensureWarehouse(warehouseId: number) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, status: { not: "DELETED" } }
    });
    if (!warehouse) {
      throw new BadRequestException("Warehouse is invalid");
    }
  }

  private async generateReturnNumber() {
    const count = await this.prisma.salesReturn.count();
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `RET-${datePart}-${String(count + 1).padStart(5, "0")}`;
  }
}
