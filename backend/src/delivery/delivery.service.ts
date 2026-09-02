import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { DeliveryStatus, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { RequestContext } from "../common/types/request-context.type";
import { toAuditJson } from "../common/utils/audit-json.util";
import { getPagination, toPaginatedResult } from "../common/utils/pagination.util";
import { PrismaService } from "../prisma/prisma.service";
import {
  ConfirmDeliveryDto,
  CreateDeliveryPlanDto,
  CreateDeliveryDto,
  DeliveryNoteDto, DeliveryPlanQueryDto,
  DeliveryQueryDto
} from "./dto/delivery.dto";

const deliveryInclude = {
  customer: true,
  items: { include: { orderItem: true, product: true } },
  order: { include: { items: true, reservations: true } },
  route: true,
  warehouse: true
} satisfies Prisma.DeliveryInclude;

type DeliveryWithDetails = Prisma.DeliveryGetPayload<{
  include: typeof deliveryInclude;
}>;

@Injectable()
export class DeliveryService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async listDeliveries(query: DeliveryQueryDto, actor?: import("../common/types/authenticated-user.type").AuthenticatedUser) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.DeliveryWhereInput = {
      customerId: query.customerId,
      orderId: query.orderId,
      routeId: query.routeId,
      status: query.status ? { in: query.status.split(",") as DeliveryStatus[] } : { in: ["PLANNED", "DISPATCHED"] },
      warehouseId: query.warehouseId
    };
    if (actor?.roles.includes("DELIVERY_PERSON")) {
      where.deliveryPlan = { driver: { userId: actor.id } };
    } else if (query.driverId) {
      where.deliveryPlan = { driverId: query.driverId };
    }

    if (query.search) {
      where.OR = [
        { deliveryNumber: { contains: query.search } },
        { customer: { code: { contains: query.search } } },
        { customer: { displayName: { contains: query.search } } },
        { order: { orderNumber: { contains: query.search } } }
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.delivery.findMany({
        include: deliveryInclude,
        orderBy: { deliveryDate: "desc" },
        skip,
        take,
        where
      }),
      this.prisma.delivery.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async listDrivers() {
    return this.prisma.employee.findMany({
      orderBy: { user: { displayName: "asc" } },
      select: { code: true, id: true, user: { select: { displayName: true, email: true } } },
      where: { category: "DRIVER", status: "ACTIVE", user: { status: "ACTIVE" } }
    });
  }

  async loadingSummary(orderIds?: string) {
    const ids = (orderIds ?? "").split(",").map(Number).filter(Number.isInteger);
    if (ids.length === 0) return [];
    const orders = await this.prisma.order.findMany({ include: { items: { include: { product: true } } }, where: { id: { in: ids } } });
    const totals = new Map<number, { freeQuantity: number; itemName: string; productId: number; quantity: number }>();
    orders.flatMap((order) => order.items).forEach((item) => {
      const current = totals.get(item.productId) ?? { freeQuantity: 0, itemName: item.product.name || "Item description unavailable", productId: item.productId, quantity: 0 };
      current.quantity += Number(item.quantity);
      current.freeQuantity += Number(item.freeQuantity);
      totals.set(item.productId, current);
    });
    return Array.from(totals.values()).map((item) => ({ ...item, totalQuantity: item.quantity + item.freeQuantity }));
  }

  async findDeliveryById(id: number) {
    const delivery = await this.prisma.delivery.findUnique({
      include: deliveryInclude,
      where: { id }
    });

    if (!delivery) {
      throw new NotFoundException("Delivery not found");
    }

    return delivery;
  }

  async listPlans(query: DeliveryPlanQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.DeliveryPlanWhereInput = { routeId: query.routeId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.deliveryPlan.findMany({ include: { driver: { include: { user: true } }, orders: { include: { order: { include: { customer: true, items: { include: { product: true } } } } } }, route: true, warehouse: true }, orderBy: { plannedDate: "desc" }, skip, take, where }),
      this.prisma.deliveryPlan.count({ where })
    ]);
    return toPaginatedResult(data, total, page, limit);
  }

  async eligiblePlanOrders(routeId?: number) {
    if (!routeId) return [];
    const orders = await this.prisma.order.findMany({
      include: { customer: true, items: { include: { product: true } }, warehouse: true },
      where: { deletedAt: null, routeId, status: "RESERVED", delivery: null, deliveryPlanOrders: { none: { deliveryPlan: { status: { not: "CANCELLED" } } } } }, orderBy: { customer: { displayName: "asc" } }
    });
    return orders;
  }

  async createPlan(dto: CreateDeliveryPlanDto, context: RequestContext) {
    const [route, driver, orders] = await Promise.all([
      this.prisma.route.findFirst({ where: { id: dto.routeId, status: "ACTIVE" } }),
      this.prisma.employee.findFirst({ include: { user: true }, where: { id: dto.driverId, category: "DRIVER", status: "ACTIVE" } }),
      this.prisma.order.findMany({ include: { delivery: true }, where: { id: { in: dto.orderIds }, deletedAt: null, routeId: dto.routeId, status: "RESERVED" } })
    ]);
    if (!route || !driver?.user || orders.length !== new Set(dto.orderIds).size) throw new BadRequestException("Route, driver, or selected orders are invalid");
    const warehouseId = orders[0]?.warehouseId;
    if (!warehouseId || orders.some((order) => order.delivery || !order.warehouseId) || new Set(orders.map((order) => order.warehouseId)).size !== 1) throw new BadRequestException("Selected orders must be reserved and use the same warehouse");
    const planNumber = `DPL-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String((await this.prisma.deliveryPlan.count()) + 1).padStart(5, "0")}`;
    return this.prisma.deliveryPlan.create({ data: { planNumber, routeId: dto.routeId, driverId: dto.driverId, warehouseId, plannedDate: new Date(dto.plannedDate), notes: dto.notes, createdById: context.actor.id, orders: { create: orders.map((order) => ({ orderId: order.id })) } }, include: { driver: { include: { user: true } }, orders: { include: { order: { include: { customer: true, items: { include: { product: true } } } } } }, route: true, warehouse: true } });
  }

  async confirmLoading(id: number, context: RequestContext) {
    const plan = await this.prisma.deliveryPlan.findUnique({ include: { driver: { include: { user: true } }, orders: { include: { order: { include: { items: true } } } } }, where: { id } });
    if (!plan || plan.status !== "PLANNED") throw new BadRequestException("Only planned delivery runs can be confirmed as loaded");
    return this.prisma.$transaction(async (tx) => {
      const deliveryCount = await tx.delivery.count();
      for (const [index, entry] of plan.orders.entries()) {
        const order = entry.order;
        await tx.delivery.create({ data: { deliveryNumber: this.formatDeliveryNumber(deliveryCount + index + 1), deliveryPlanId: plan.id, orderId: order.id, customerId: order.customerId, routeId: order.routeId, warehouseId: order.warehouseId!, deliveryDate: plan.plannedDate, driverName: plan.driver.user.displayName, items: { create: order.items.map((item) => ({ orderItemId: item.id, productId: item.productId, orderedQuantity: Number(item.quantity) + Number(item.freeQuantity) })) } } });
      }
      return tx.deliveryPlan.update({ data: { status: "LOADED", loadingConfirmedAt: new Date(), loadingConfirmedById: context.actor.id, updatedById: context.actor.id }, where: { id } });
    });
  }

  async createDelivery(dto: CreateDeliveryDto, context: RequestContext) {
    const order = await this.prisma.order.findFirst({
      include: { items: true },
      where: { deletedAt: null, id: dto.orderId }
    });

    if (!order) {
      throw new BadRequestException("Order is invalid");
    }
    if (order.status !== "RESERVED") {
      throw new BadRequestException("Only stock-reserved orders can be delivered");
    }
    if (!order.warehouseId) {
      throw new BadRequestException("Order does not have a warehouse");
    }

    const existingDelivery = await this.prisma.delivery.findFirst({
      where: { orderId: order.id, status: { not: "CANCELLED" } }
    });
    if (existingDelivery) {
      throw new ConflictException("Order already has an active delivery");
    }

    const deliveryNumber = await this.generateDeliveryNumber();
    const delivery = await this.prisma.delivery.create({
      data: {
        createdById: context.actor.id,
        customerId: order.customerId,
        deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : new Date(),
        deliveryNumber,
        driverName: dto.driverName,
        items: {
          create: order.items.map((item) => ({
            orderItemId: item.id,
            orderedQuantity: Number(item.quantity) + Number(item.freeQuantity),
            productId: item.productId
          }))
        },
        notes: dto.notes,
        orderId: order.id,
        routeId: order.routeId,
        vehicleNumber: dto.vehicleNumber,
        warehouseId: order.warehouseId
      },
      include: deliveryInclude
    });

    await this.auditService.record({
      action: "DELIVERY_CREATED",
      actorUserId: context.actor.id,
      entityId: delivery.id,
      entityType: "delivery",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(delivery),
      userAgent: context.userAgent
    });

    return delivery;
  }

  async dispatchDelivery(id: number, context: RequestContext) {
    const delivery = await this.findDeliveryById(id);
    if (delivery.status !== "PLANNED") {
      throw new BadRequestException("Only planned deliveries can be dispatched");
    }

    const updatedDelivery = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        data: { status: "LOADING", updatedById: context.actor.id },
        where: { id: delivery.orderId }
      });

      return tx.delivery.update({
        data: {
          dispatchedAt: new Date(),
          status: "DISPATCHED",
          updatedById: context.actor.id
        },
        include: deliveryInclude,
        where: { id }
      });
    });

    await this.auditService.record({
      action: "DELIVERY_DISPATCHED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "delivery",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(updatedDelivery),
      oldValues: toAuditJson(delivery),
      userAgent: context.userAgent
    });

    return updatedDelivery;
  }

  async confirmDelivery(
    id: number,
    dto: ConfirmDeliveryDto,
    context: RequestContext
  ) {
    const delivery = await this.findDeliveryById(id);
    if (delivery.status !== "DISPATCHED") {
      throw new BadRequestException("Only dispatched deliveries can be confirmed");
    }

    const confirmedDelivery = await this.prisma.$transaction(async (tx) => {
      const deliveredByProduct = new Map<number, number>();
      const updates = this.validateConfirmationItems(delivery, dto);

      for (const update of updates) {
        await tx.deliveryItem.update({
          data: {
            deliveredQuantity: update.deliveredQuantity,
            notes: update.notes,
            rejectedQuantity: update.rejectedQuantity
          },
          where: { id: update.id }
        });

        deliveredByProduct.set(
          update.productId,
          (deliveredByProduct.get(update.productId) ?? 0) +
            update.deliveredQuantity
        );
      }

      await this.finalizeReservations(
        tx,
        delivery.orderId,
        deliveredByProduct,
        context
      );

      const fullDelivery = updates.every(
        (item) =>
          item.deliveredQuantity >= item.orderedQuantity &&
          item.rejectedQuantity === 0
      );

      await tx.order.update({
        data: {
          status: fullDelivery ? "DELIVERED" : "LOADING",
          updatedById: context.actor.id
        },
        where: { id: delivery.orderId }
      });

      return tx.delivery.update({
        data: {
          deliveredAt: new Date(),
          proofNotes: dto.proofNotes,
          receivedBy: dto.receivedBy,
          status: fullDelivery ? "DELIVERED" : "PARTIALLY_DELIVERED",
          updatedById: context.actor.id
        },
        include: deliveryInclude,
        where: { id }
      });
    });

    await this.auditService.record({
      action: "DELIVERY_CONFIRMED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "delivery",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(confirmedDelivery),
      oldValues: toAuditJson(delivery),
      userAgent: context.userAgent
    });

    return confirmedDelivery;
  }

  async cancelDelivery(
    id: number,
    dto: DeliveryNoteDto,
    context: RequestContext
  ) {
    const delivery = await this.findDeliveryById(id);
    if (["DELIVERED", "PARTIALLY_DELIVERED", "CANCELLED"].includes(delivery.status)) {
      throw new BadRequestException("Delivery cannot be cancelled");
    }

    const cancelledDelivery = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        data: { status: "RESERVED", updatedById: context.actor.id },
        where: { id: delivery.orderId }
      });

      return tx.delivery.update({
        data: {
          notes: dto.notes ?? delivery.notes,
          status: "CANCELLED",
          updatedById: context.actor.id
        },
        include: deliveryInclude,
        where: { id }
      });
    });

    await this.auditService.record({
      action: "DELIVERY_CANCELLED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "delivery",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(cancelledDelivery),
      oldValues: toAuditJson(delivery),
      userAgent: context.userAgent
    });

    return cancelledDelivery;
  }

  private validateConfirmationItems(
    delivery: DeliveryWithDetails,
    dto: ConfirmDeliveryDto
  ) {
    const deliveryItems = new Map(delivery.items.map((item) => [item.id, item]));
    const submittedIds = new Set(dto.items.map((item) => item.deliveryItemId));

    if (submittedIds.size !== dto.items.length) {
      throw new BadRequestException("Delivery confirmation contains duplicate items");
    }
    if (submittedIds.size !== delivery.items.length) {
      throw new BadRequestException("Confirm every delivery item in the delivery");
    }

    return dto.items.map((item) => {
      const deliveryItem = deliveryItems.get(item.deliveryItemId);
      if (!deliveryItem) {
        throw new BadRequestException("One or more delivery items are invalid");
      }

      const rejectedQuantity = item.rejectedQuantity ?? 0;
      const totalConfirmed = item.deliveredQuantity + rejectedQuantity;
      const orderedQuantity = Number(deliveryItem.orderedQuantity);

      if (totalConfirmed > orderedQuantity) {
        throw new BadRequestException(
          "Delivered plus rejected quantity cannot exceed ordered quantity"
        );
      }

      return {
        deliveredQuantity: item.deliveredQuantity,
        id: deliveryItem.id,
        notes: item.notes,
        orderedQuantity,
        productId: deliveryItem.productId,
        rejectedQuantity
      };
    });
  }

  private async finalizeReservations(
    tx: Prisma.TransactionClient,
    orderId: number,
    deliveredByProduct: Map<number, number>,
    context: RequestContext
  ) {
    const reservations = await tx.stockReservation.findMany({
      where: { orderId, status: "ACTIVE" }
    });

    for (const reservation of reservations) {
      const stock = await this.getOrCreateStock(
        tx,
        reservation.warehouseId,
        reservation.productId
      );
      const remainingDelivered =
        deliveredByProduct.get(reservation.productId) ?? 0;
      const reservationQuantity = Number(reservation.quantity);
      const consumeQuantity = Math.min(remainingDelivered, reservationQuantity);
      const releaseQuantity = reservationQuantity - consumeQuantity;
      const nextOnHand = Number(stock.onHandQuantity) - consumeQuantity;
      const nextReserved = Math.max(
        Number(stock.reservedQuantity) - reservationQuantity,
        0
      );

      if (nextOnHand < 0) {
        throw new BadRequestException("Delivery confirmation would make stock negative");
      }

      const updatedStock = await tx.inventoryStock.update({
        data: {
          onHandQuantity: nextOnHand,
          reservedQuantity: nextReserved
        },
        where: { id: stock.id }
      });

      if (consumeQuantity > 0) {
        await tx.inventoryMovement.create({
          data: {
            balanceAfter: Number(updatedStock.onHandQuantity),
            createdById: context.actor.id,
            movementType: "RESERVATION_CONSUME",
            notes: "Delivery confirmed",
            productId: reservation.productId,
            quantity: -consumeQuantity,
            referenceId: String(orderId),
            referenceType: "delivery",
            warehouseId: reservation.warehouseId
          }
        });
      }

      if (releaseQuantity > 0) {
        await tx.inventoryMovement.create({
          data: {
            balanceAfter: Number(updatedStock.onHandQuantity),
            createdById: context.actor.id,
            movementType: "RESERVATION_RELEASE",
            notes: "Undelivered delivery quantity released",
            productId: reservation.productId,
            quantity: -releaseQuantity,
            referenceId: String(reservation.id),
            referenceType: "stock_reservation",
            warehouseId: reservation.warehouseId
          }
        });
      }

      deliveredByProduct.set(
        reservation.productId,
        Math.max(remainingDelivered - consumeQuantity, 0)
      );

      await tx.stockReservation.update({
        data: {
          releasedAt: new Date(),
          releasedById: context.actor.id,
          status: releaseQuantity > 0 ? "CANCELLED" : "CONSUMED"
        },
        where: { id: reservation.id }
      });
    }
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

  private async generateDeliveryNumber() {
    const count = await this.prisma.delivery.count();
    return this.formatDeliveryNumber(count + 1);
  }

  private formatDeliveryNumber(sequence: number) {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `DEL-${datePart}-${String(sequence).padStart(5, "0")}`;
  }
}
