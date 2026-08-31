import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { DiscountsService } from "../discounts/discounts.service";
import { PriceListsService } from "../price-lists/price-lists.service";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { RequestContext } from "../common/types/request-context.type";
import { toAuditJson } from "../common/utils/audit-json.util";
import { isSalesRepScopedActor } from "../common/utils/user-scope.util";
import { getPagination, toPaginatedResult } from "../common/utils/pagination.util";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateOrderAmendmentRequestDto,
  CreateOrderDto,
  OrderAmendmentRequestQueryDto,
  OrderLineDto,
  OrderQueryDto,
  QuoteOrderItemsDto,
  ReviewOrderAmendmentRequestDto,
  UpdateOrderDto
} from "./dto/order.dto";

const orderInclude = {
  customer: true,
  items: { include: { packagingOption: true, product: true } },
  office: true,
  reservations: true,
  route: true,
  salesRep: true,
  warehouse: true
} satisfies Prisma.OrderInclude;

type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

type PreparedOrderLine = {
  discountAmount: number;
  freeQuantity: number;
  lineTotal: number;
  packagingOptionId?: number;
  productId: number;
  quantity: number;
  unitPrice: number;
};

type PreparedOrder = {
  discountTotal: number;
  items: PreparedOrderLine[];
  subtotal: number;
  totalAmount: number;
};

type AmendmentChanges = {
  items?: OrderLineDto[];
  notes?: string;
  routeId?: number;
  warehouseId?: number;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly auditService: AuditService,
    private readonly discountsService: DiscountsService,
    private readonly priceListsService: PriceListsService,
    private readonly prisma: PrismaService
  ) {}

  async listOrders(query: OrderQueryDto, actor?: AuthenticatedUser) {
    const { limit, page, skip, take } = getPagination(query);
    const salesRepContext = actor && isSalesRepScopedActor(actor)
      ? await this.getSalesRepContext(actor.id)
      : undefined;
    const where: Prisma.OrderWhereInput = {
      customerId: query.customerId,
      deletedAt: null,
      officeId: query.officeId,
      routeId: query.routeId,
      salesRepId: salesRepContext?.id ?? query.salesRepId,
      status: query.status,
      warehouseId: query.warehouseId
    };

    if (query.fromDate || query.toDate) {
      where.orderDate = {
        gte: query.fromDate ? new Date(query.fromDate) : undefined,
        lte: query.toDate ? new Date(query.toDate) : undefined
      };
    }

    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search } },
        { customer: { code: { contains: query.search } } },
        { customer: { displayName: { contains: query.search } } }
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        include: orderInclude,
        orderBy: { orderDate: "desc" },
        skip,
        take,
        where
      }),
      this.prisma.order.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async findOrderById(id: number, actor?: AuthenticatedUser) {
    const salesRepContext = actor && isSalesRepScopedActor(actor)
      ? await this.getSalesRepContext(actor.id)
      : undefined;
    const order = await this.prisma.order.findFirst({
      include: orderInclude,
      where: {
        deletedAt: null,
        id,
        salesRepId: salesRepContext?.id
      }
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return order;
  }

  async createOrder(dto: CreateOrderDto, context: RequestContext) {
    const orderNumber =
      dto.orderNumber?.trim().toUpperCase() ?? (await this.generateOrderNumber());
    await this.ensureUniqueOrderNumber(orderNumber);
    const orderReferences = await this.resolveOrderReferences(dto, context);
    const preparedOrder = await this.prepareOrder(
      dto.items,
      orderReferences.customerId,
      orderReferences.officeId
    );

    const order = await this.prisma.order.create({
      data: {
        createdById: context.actor.id,
        customerId: orderReferences.customerId,
        discountTotal: preparedOrder.discountTotal,
        items: {
          create: preparedOrder.items.map((item) => ({
            discountAmount: item.discountAmount,
            freeQuantity: item.freeQuantity,
            lineTotal: item.lineTotal,
            packagingOptionId: item.packagingOptionId,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice
          }))
        },
        notes: dto.notes,
        officeId: orderReferences.officeId,
        orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
        orderNumber,
        routeId: orderReferences.routeId,
        salesRepId: orderReferences.salesRepId,
        status: dto.status ?? "SUBMITTED",
        subtotal: preparedOrder.subtotal,
        totalAmount: preparedOrder.totalAmount,
        warehouseId: orderReferences.warehouseId
      },
      include: orderInclude
    });

    await this.auditService.record({
      action: "ORDER_CREATED",
      actorUserId: context.actor.id,
      entityId: order.id,
      entityType: "order",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(order),
      userAgent: context.userAgent
    });

    return order;
  }

  async listCatalogueProducts() {
    return this.prisma.product.findMany({
      include: { packagingOptions: true, productGroup: true },
      orderBy: { name: "asc" },
      where: { status: "ACTIVE" }
    });
  }

  async quoteItems(dto: QuoteOrderItemsDto) {
    const customer = await this.ensureCustomer(dto.customerId);
    const prepared = await this.prepareOrder(dto.items, customer.id, customer.officeId);
    return {
      discountTotal: prepared.discountTotal,
      items: prepared.items,
      subtotal: prepared.subtotal,
      totalAmount: prepared.totalAmount
    };
  }

  async updateOrder(
    id: number,
    dto: UpdateOrderDto,
    context: RequestContext
  ) {
    const order = await this.findOrderById(id, context.actor);
    this.ensureOrderEditable(order);
    await this.ensureNoActiveReservations(id);
    if (isSalesRepScopedActor(context.actor) && (dto.routeId || dto.warehouseId)) {
      throw new BadRequestException("Sales reps cannot change order route or warehouse");
    }
    await this.validateOrderPatch(order, dto);
    const preparedOrder = dto.items
      ? await this.prepareOrder(dto.items, order.customerId, order.officeId)
      : undefined;

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      if (preparedOrder) {
        await tx.orderItem.deleteMany({ where: { orderId: id } });
      }

      return tx.order.update({
        data: {
          discountTotal: preparedOrder?.discountTotal,
          items: preparedOrder
            ? {
                create: preparedOrder.items.map((item) => ({
                  discountAmount: item.discountAmount,
                  freeQuantity: item.freeQuantity,
                  lineTotal: item.lineTotal,
                  packagingOptionId: item.packagingOptionId,
                  productId: item.productId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice
                }))
              }
            : undefined,
          notes: dto.notes,
          routeId: dto.routeId,
          status: dto.status,
          subtotal: preparedOrder?.subtotal,
          totalAmount: preparedOrder?.totalAmount,
          updatedById: context.actor.id,
          warehouseId: dto.warehouseId
        },
        include: orderInclude,
        where: { id }
      });
    });

    await this.auditService.record({
      action: "ORDER_UPDATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "order",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: toAuditJson(order),
      userAgent: context.userAgent
    });

    return updatedOrder;
  }

  async approveOrder(id: number, context: RequestContext) {
    const order = await this.findOrderById(id, context.actor);
    if (order.status !== "SUBMITTED") {
      throw new BadRequestException("Only submitted orders can be approved");
    }
    await this.ensureCreditAllowed(order);

    const updatedOrder = await this.prisma.order.update({
      data: { status: "APPROVED", updatedById: context.actor.id },
      include: orderInclude,
      where: { id }
    });

    await this.auditService.record({
      action: "ORDER_APPROVED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "order",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(updatedOrder),
      oldValues: toAuditJson(order),
      userAgent: context.userAgent
    });

    return updatedOrder;
  }

  async reserveOrderStock(id: number, context: RequestContext) {
    const order = await this.findOrderById(id, context.actor);
    if (order.status !== "APPROVED") {
      throw new BadRequestException("Only approved orders can reserve stock");
    }
    if (!order.warehouseId) {
      throw new BadRequestException("Order must have a warehouse before reserving stock");
    }
    await this.ensureNoActiveReservations(id);

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const groupedQuantities = this.groupOrderItemQuantities(order);
      for (const [productId, quantity] of groupedQuantities.entries()) {
        await this.reserveProductForOrder(
          tx,
          order.warehouseId as number,
          productId,
          id,
          quantity,
          context
        );
      }

      return tx.order.update({
        data: { status: "RESERVED", updatedById: context.actor.id },
        include: orderInclude,
        where: { id }
      });
    });

    await this.auditService.record({
      action: "ORDER_STOCK_RESERVED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "order",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(updatedOrder),
      oldValues: toAuditJson(order),
      userAgent: context.userAgent
    });

    return updatedOrder;
  }

  async cancelOrder(id: number, context: RequestContext) {
    const order = await this.findOrderById(id, context.actor);
    if (["CANCELLED", "DELIVERED"].includes(order.status)) {
      throw new BadRequestException("Order cannot be cancelled");
    }

    const cancelledOrder = await this.prisma.$transaction(async (tx) => {
      const activeReservations = await tx.stockReservation.findMany({
        where: { orderId: id, status: "ACTIVE" }
      });

      for (const reservation of activeReservations) {
        await this.releaseReservationInTransaction(
          tx,
          reservation,
          "Order cancelled",
          context
        );
      }

      return tx.order.update({
        data: { status: "CANCELLED", updatedById: context.actor.id },
        include: orderInclude,
        where: { id }
      });
    });

    await this.auditService.record({
      action: "ORDER_CANCELLED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "order",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(cancelledOrder),
      oldValues: toAuditJson(order),
      userAgent: context.userAgent
    });

    return cancelledOrder;
  }

  async createAmendmentRequest(
    orderId: number,
    dto: CreateOrderAmendmentRequestDto,
    context: RequestContext
  ) {
    await this.findOrderById(orderId, context.actor);
    const pendingRequest = await this.prisma.orderAmendmentRequest.findFirst({
      where: { orderId, status: "PENDING" }
    });
    if (pendingRequest) {
      throw new ConflictException("Order already has a pending amendment request");
    }

    const request = await this.prisma.orderAmendmentRequest.create({
      data: {
        orderId,
        reason: dto.reason,
        requestedById: context.actor.id,
        requestedChanges: toAuditJson(dto.requestedChanges)
      },
      include: { order: true, requestedBy: true, reviewedBy: true }
    });

    await this.auditService.record({
      action: "ORDER_AMENDMENT_REQUESTED",
      actorUserId: context.actor.id,
      entityId: request.id,
      entityType: "order_amendment_request",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(request),
      userAgent: context.userAgent
    });

    return request;
  }

  async listAmendmentRequests(query: OrderAmendmentRequestQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.OrderAmendmentRequestWhereInput = {
      orderId: query.orderId,
      status: query.status
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.orderAmendmentRequest.findMany({
        include: { order: true, requestedBy: true, reviewedBy: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
        where
      }),
      this.prisma.orderAmendmentRequest.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async approveAmendmentRequest(
    id: number,
    dto: ReviewOrderAmendmentRequestDto,
    context: RequestContext
  ) {
    const request = await this.findPendingAmendmentRequest(id);
    const order = await this.findOrderById(request.orderId, context.actor);
    if (["CANCELLED", "DELIVERED"].includes(order.status)) {
      throw new BadRequestException("Finalized orders cannot be amended");
    }

    const changes = this.parseAmendmentChanges(request.requestedChanges);
    if (changes.items) {
      await this.ensureNoActiveReservations(order.id);
    }
    await this.validateOrderPatch(order, changes);
    const preparedOrder = changes.items
      ? await this.prepareOrder(changes.items, order.customerId, order.officeId)
      : undefined;

    const result = await this.prisma.$transaction(async (tx) => {
      if (preparedOrder) {
        await tx.orderItem.deleteMany({ where: { orderId: order.id } });
      }

      const updatedOrder = await tx.order.update({
        data: {
          discountTotal: preparedOrder?.discountTotal,
          items: preparedOrder
            ? {
                create: preparedOrder.items.map((item) => ({
                  discountAmount: item.discountAmount,
                  freeQuantity: item.freeQuantity,
                  lineTotal: item.lineTotal,
                  packagingOptionId: item.packagingOptionId,
                  productId: item.productId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice
                }))
              }
            : undefined,
          notes: changes.notes,
          routeId: changes.routeId,
          subtotal: preparedOrder?.subtotal,
          totalAmount: preparedOrder?.totalAmount,
          updatedById: context.actor.id,
          warehouseId: changes.warehouseId
        },
        include: orderInclude,
        where: { id: order.id }
      });

      const reviewedRequest = await tx.orderAmendmentRequest.update({
        data: {
          reviewedAt: new Date(),
          reviewedById: context.actor.id,
          reviewNote: dto.reviewNote,
          status: "APPROVED"
        },
        include: { order: true, requestedBy: true, reviewedBy: true },
        where: { id }
      });

      return { reviewedRequest, updatedOrder };
    });

    await this.auditService.record({
      action: "ORDER_AMENDMENT_APPROVED",
      actorUserId: context.actor.id,
      approvalReference: String(id),
      entityId: order.id,
      entityType: "order",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(result),
      oldValues: toAuditJson({ order, request }),
      userAgent: context.userAgent
    });

    return result;
  }

  async rejectAmendmentRequest(
    id: number,
    dto: ReviewOrderAmendmentRequestDto,
    context: RequestContext
  ) {
    const request = await this.findPendingAmendmentRequest(id);
    const reviewedRequest = await this.prisma.orderAmendmentRequest.update({
      data: {
        reviewedAt: new Date(),
        reviewedById: context.actor.id,
        reviewNote: dto.reviewNote,
        status: "REJECTED"
      },
      include: { order: true, requestedBy: true, reviewedBy: true },
      where: { id }
    });

    await this.auditService.record({
      action: "ORDER_AMENDMENT_REJECTED",
      actorUserId: context.actor.id,
      approvalReference: String(id),
      entityId: request.orderId,
      entityType: "order",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(reviewedRequest),
      oldValues: toAuditJson(request),
      userAgent: context.userAgent
    });

    return reviewedRequest;
  }

  private async resolveOrderReferences(dto: CreateOrderDto, context: RequestContext) {
    const customer = await this.ensureCustomer(dto.customerId);
    const primaryRoute = await this.getPrimaryActiveCustomerRoute(customer.id);

    if (isSalesRepScopedActor(context.actor)) {
      const salesRep = await this.getSalesRepContext(context.actor.id);
      if (!salesRep.warehouseId) {
        throw new BadRequestException("Sales rep does not have a primary warehouse");
      }
      if (customer.officeId !== salesRep.officeId) {
        throw new BadRequestException("Customer does not belong to the sales rep office");
      }
      if (customer.salesRepId && customer.salesRepId !== salesRep.id) {
        throw new BadRequestException("Customer is assigned to another sales rep");
      }
      if (!primaryRoute) {
        throw new BadRequestException("Customer does not have a primary active route");
      }
      if (primaryRoute.route.officeId !== salesRep.officeId) {
        throw new BadRequestException("Customer primary route is not in the sales rep office");
      }

      return {
        customerId: customer.id,
        officeId: salesRep.officeId,
        routeId: primaryRoute.routeId,
        salesRepId: salesRep.id,
        warehouseId: salesRep.warehouseId
      };
    }

    if (!dto.officeId) {
      throw new BadRequestException("Office is required");
    }

    const officeId = dto.officeId;
    const routeId = primaryRoute?.routeId ?? dto.routeId;

    await this.ensureOffice(officeId);
    if (customer.officeId !== officeId) {
      throw new BadRequestException("Customer does not belong to the selected office");
    }
    if (dto.salesRepId) {
      await this.ensureSalesRep(dto.salesRepId, officeId);
    }
    if (routeId) {
      await this.ensureRoute(routeId, officeId);
    }
    if (dto.warehouseId) {
      await this.ensureWarehouse(dto.warehouseId);
    }

    return {
      customerId: customer.id,
      officeId,
      routeId,
      salesRepId: dto.salesRepId,
      warehouseId: dto.warehouseId
    };
  }

  private async validateOrderPatch(
    order: OrderWithDetails,
    dto: Pick<UpdateOrderDto, "items" | "notes" | "routeId" | "warehouseId">
  ) {
    if (dto.routeId) {
      await this.ensureRoute(dto.routeId, order.officeId);
    }
    if (dto.warehouseId) {
      await this.ensureWarehouse(dto.warehouseId);
    }
  }

  private async prepareOrder(
    items: OrderLineDto[],
    customerId: number,
    officeId: number
  ): Promise<PreparedOrder> {
    this.ensureNoDuplicateOrderItems(items);
    const preparedItems: PreparedOrderLine[] = [];
    const pricedLines: { item: OrderLineDto; unitPrice: number }[] = [];

    for (const item of items) {
      await this.ensureProduct(item.productId);
      if (item.packagingOptionId) {
        await this.ensurePackagingOption(item.packagingOptionId, item.productId);
      }

      const price = await this.priceListsService.resolvePrice({
        customerId,
        officeId,
        productId: item.productId
      });
      pricedLines.push({ item, unitPrice: price.unitPrice });
    }

    const discount = await this.discountsService.calculate({
      customerId,
      lines: pricedLines.map(({ item, unitPrice }) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice
      }))
    });

    for (const { item, unitPrice } of pricedLines) {
      const discountLine = discount.lines.find((line) => line.productId === item.productId);
      const discountAmount = Number((discountLine?.totalDiscount ?? 0).toFixed(2));
      const freeQuantity = discountLine?.freeQuantity ?? 0;
      const grossAmount = item.quantity * unitPrice;
      const lineTotal = Number(Math.max(grossAmount - discountAmount, 0).toFixed(2));

      preparedItems.push({
        discountAmount,
        freeQuantity,
        lineTotal,
        packagingOptionId: item.packagingOptionId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice
      });
    }

    const subtotal = Number(
      preparedItems
        .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
        .toFixed(2)
    );
    const discountTotal = Number(
      preparedItems.reduce((sum, item) => sum + item.discountAmount, 0).toFixed(2)
    );
    const totalAmount = Number(
      preparedItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2)
    );

    return {
      discountTotal,
      items: preparedItems,
      subtotal,
      totalAmount
    };
  }

  private ensureNoDuplicateOrderItems(items: OrderLineDto[]) {
    const keys = new Set<string>();
    for (const item of items) {
      const key = String(item.productId);
      if (keys.has(key)) {
        throw new BadRequestException("Duplicate order items are not allowed");
      }
      keys.add(key);
    }
  }

  private ensureOrderEditable(order: OrderWithDetails) {
    if (!["DRAFT", "SUBMITTED"].includes(order.status)) {
      throw new BadRequestException("Only draft or submitted orders can be updated");
    }
  }

  private async ensureNoActiveReservations(orderId: number) {
    const count = await this.prisma.stockReservation.count({
      where: { orderId, status: "ACTIVE" }
    });
    if (count > 0) {
      throw new BadRequestException(
        "Release or cancel active reservations before changing order items"
      );
    }
  }

  private groupOrderItemQuantities(order: OrderWithDetails) {
    const grouped = new Map<number, number>();

    for (const item of order.items) {
      const currentQuantity = grouped.get(item.productId) ?? 0;
      grouped.set(
        item.productId,
        currentQuantity + Number(item.quantity) + Number(item.freeQuantity)
      );
    }

    return grouped;
  }

  private async reserveProductForOrder(
    tx: Prisma.TransactionClient,
    warehouseId: number,
    productId: number,
    orderId: number,
    quantity: number,
    context: RequestContext
  ) {
    const stock = await this.getOrCreateStock(tx, warehouseId, productId);
    const available =
      Number(stock.onHandQuantity) - Number(stock.reservedQuantity);

    if (quantity > available) {
      throw new BadRequestException(
        `Insufficient available stock for product ${productId}`
      );
    }

    const nextReserved = Number(stock.reservedQuantity) + quantity;
    const updatedStock = await tx.inventoryStock.update({
      data: { reservedQuantity: nextReserved },
      where: { id: stock.id }
    });
    const reservation = await tx.stockReservation.create({
      data: {
        createdById: context.actor.id,
        notes: "Reserved for approved order",
        orderId,
        productId,
        quantity,
        warehouseId
      }
    });

    await tx.inventoryMovement.create({
      data: {
        balanceAfter: Number(updatedStock.onHandQuantity),
        createdById: context.actor.id,
        movementType: "RESERVATION",
        notes: "Reserved for approved order",
        productId,
        quantity,
        referenceId: String(orderId),
        referenceType: "order",
        warehouseId
      }
    });

    return reservation;
  }

  private async releaseReservationInTransaction(
    tx: Prisma.TransactionClient,
    reservation: {
      id: number;
      productId: number;
      quantity: Prisma.Decimal;
      warehouseId: number;
    },
    notes: string,
    context: RequestContext
  ) {
    const stock = await this.getOrCreateStock(
      tx,
      reservation.warehouseId,
      reservation.productId
    );
    const nextReserved = Math.max(
      Number(stock.reservedQuantity) - Number(reservation.quantity),
      0
    );

    const updatedStock = await tx.inventoryStock.update({
      data: { reservedQuantity: nextReserved },
      where: { id: stock.id }
    });

    await tx.stockReservation.update({
      data: {
        notes,
        releasedAt: new Date(),
        releasedById: context.actor.id,
        status: "CANCELLED"
      },
      where: { id: reservation.id }
    });

    await tx.inventoryMovement.create({
      data: {
        balanceAfter: Number(updatedStock.onHandQuantity),
        createdById: context.actor.id,
        movementType: "RESERVATION_RELEASE",
        notes,
        productId: reservation.productId,
        quantity: -Number(reservation.quantity),
        referenceId: String(reservation.id),
        referenceType: "stock_reservation",
        warehouseId: reservation.warehouseId
      }
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
      data: {
        productId,
        warehouseId
      }
    });
  }

  private parseAmendmentChanges(value: Prisma.JsonValue): AmendmentChanges {
    if (!value || Array.isArray(value) || typeof value !== "object") {
      throw new BadRequestException("Requested changes must be an object");
    }

    const raw = value as Record<string, unknown>;
    const changes: AmendmentChanges = {};

    if (typeof raw.notes === "string") {
      changes.notes = raw.notes;
    }
    if (typeof raw.routeId === "number") {
      changes.routeId = raw.routeId;
    }
    if (typeof raw.warehouseId === "number") {
      changes.warehouseId = raw.warehouseId;
    }
    if (Array.isArray(raw.items)) {
      changes.items = raw.items.map((rawItem) =>
        this.parseAmendmentOrderLine(rawItem)
      );
    }

    if (
      changes.notes === undefined &&
      changes.routeId === undefined &&
      changes.warehouseId === undefined &&
      changes.items === undefined
    ) {
      throw new BadRequestException("No supported amendment fields were provided");
    }

    return changes;
  }

  private parseAmendmentOrderLine(value: unknown): OrderLineDto {
    if (!value || Array.isArray(value) || typeof value !== "object") {
      throw new BadRequestException("Amendment order items must be objects");
    }

    const raw = value as Record<string, unknown>;
    if (typeof raw.productId !== "number" || typeof raw.quantity !== "number") {
      throw new BadRequestException(
        "Amendment order items require productId and quantity"
      );
    }

    return {
      discountAmount:
        typeof raw.discountAmount === "number" ? raw.discountAmount : undefined,
      freeQuantity:
        typeof raw.freeQuantity === "number" ? raw.freeQuantity : undefined,
      packagingOptionId:
        typeof raw.packagingOptionId === "number"
          ? raw.packagingOptionId
          : undefined,
      productId: raw.productId,
      quantity: raw.quantity,
      unitPrice: typeof raw.unitPrice === "number" ? raw.unitPrice : undefined
    };
  }

  private async findPendingAmendmentRequest(id: number) {
    const request = await this.prisma.orderAmendmentRequest.findFirst({
      include: { order: true, requestedBy: true, reviewedBy: true },
      where: { id, status: "PENDING" }
    });

    if (!request) {
      throw new NotFoundException("Pending order amendment request not found");
    }

    return request;
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

  private async getPrimaryActiveCustomerRoute(customerId: number) {
    return this.prisma.routeCustomer.findFirst({
      include: { route: true },
      orderBy: { assignedAt: "desc" },
      where: {
        customerId,
        isPrimary: true,
        route: { status: { not: "DELETED" } },
        status: "ACTIVE"
      }
    });
  }

  private async getSalesRepContext(userId: number) {
    const salesRep = await this.prisma.salesRep.findFirst({
      include: { warehouse: true },
      where: {
        status: "ACTIVE",
        userId
      }
    });

    if (!salesRep) {
      throw new BadRequestException("Authenticated user is not linked to an active sales rep");
    }

    if (salesRep.warehouseId && salesRep.warehouse?.officeId && salesRep.warehouse.officeId !== salesRep.officeId) {
      throw new BadRequestException("Sales rep primary warehouse is not in the sales rep office");
    }

    return salesRep;
  }

  private async ensureOffice(officeId: number) {
    const office = await this.prisma.office.findFirst({
      where: { id: officeId, status: { not: "DELETED" } }
    });
    if (!office) {
      throw new BadRequestException("Office is invalid");
    }
  }

  private async ensureSalesRep(salesRepId: number, officeId: number) {
    const salesRep = await this.prisma.salesRep.findFirst({
      where: { id: salesRepId, status: { not: "DELETED" } }
    });
    if (!salesRep) {
      throw new BadRequestException("Sales rep is invalid");
    }
    if (salesRep.officeId !== officeId) {
      throw new BadRequestException("Sales rep does not belong to the selected office");
    }
  }

  private async ensureRoute(routeId: number, officeId: number) {
    const route = await this.prisma.route.findFirst({
      where: { id: routeId, status: { not: "DELETED" } }
    });
    if (!route) {
      throw new BadRequestException("Route is invalid");
    }
    if (route.officeId !== officeId) {
      throw new BadRequestException("Route does not belong to the selected office");
    }
  }

  private async ensureWarehouse(warehouseId: number) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, status: { not: "DELETED" } }
    });
    if (!warehouse) {
      throw new BadRequestException("Warehouse is invalid");
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

  private async ensurePackagingOption(
    packagingOptionId: number,
    productId: number
  ) {
    const packagingOption = await this.prisma.productPackagingOption.findFirst({
      where: {
        id: packagingOptionId,
        productId,
        status: { not: "DELETED" }
      }
    });
    if (!packagingOption) {
      throw new BadRequestException("Packaging option is invalid");
    }
  }

  private async ensureUniqueOrderNumber(orderNumber: string) {
    const existingOrder = await this.prisma.order.findUnique({
      where: { orderNumber }
    });
    if (existingOrder) {
      throw new ConflictException("Order number already exists");
    }
  }

  private async ensureCreditAllowed(order: OrderWithDetails) {
    const hasOverride = await this.hasApprovedCreditOverride(
      order.id,
      Number(order.totalAmount)
    );
    if (hasOverride) {
      return;
    }

    if (order.customer.creditHold) {
      throw new BadRequestException("Customer is on credit hold");
    }

    const creditLimit = Number(order.customer.creditLimit);
    if (creditLimit <= 0) {
      return;
    }

    const outstandingBalance = await this.getOutstandingBalance(order.customerId);
    if (outstandingBalance + Number(order.totalAmount) > creditLimit) {
      throw new BadRequestException("Customer credit limit would be exceeded");
    }
  }

  private async hasApprovedCreditOverride(orderId: number, amount: number) {
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

  private async generateOrderNumber() {
    const count = await this.prisma.order.count();
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `ORD-${datePart}-${String(count + 1).padStart(5, "0")}`;
  }
}
