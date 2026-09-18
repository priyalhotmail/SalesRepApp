import {
  BadRequestException,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { CanReturnsService } from "./can-returns.service";
import { DriverDayQuery } from "./can-return.dto";
@Injectable()
export class DriverDayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cans: CanReturnsService,
  ) {}
  async drivers(actor: AuthenticatedUser) {
    const office = await this.cans.officeScope(actor);
    return this.prisma.employee.findMany({
      where: {
        category: "DRIVER",
        status: "ACTIVE",
        ...(office
          ? { OR: [{ branchId: office }, { branchId: null, officeId: office }] }
          : {}),
      },
      select: {
        id: true,
        userId: true,
        warehouseId: true,
        user: { select: { displayName: true } },
      },
    });
  }
  async summary(query: DriverDayQuery, actor: AuthenticatedUser) {
    const driver = (await this.drivers(actor)).find(
      (d) => d.id === query.driverId,
    );
    if (!driver) throw new ForbiddenException("Driver is outside your branch");
    const start = new Date(`${query.date}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 86400000);
    const range = { gte: start, lt: end };
    const [payments, returns, cans, deliveries, plans] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          createdById: driver.userId,
          paymentDate: range,
          status: { not: "CANCELLED" },
        },
        include: { customer: true, cheque: true },
      }),
      this.prisma.salesReturn.findMany({
        where: { createdById: driver.userId, returnDate: range },
        include: { customer: true, items: { include: { product: true } } },
      }),
      this.prisma.canReturn.findMany({
        where: { collectedById: driver.userId, collectedAt: range },
        include: { customer: true },
      }),
      this.prisma.delivery.findMany({
        where: { deliveryPlan: { driverId: driver.id }, deliveryDate: range },
        include: {
          customer: true,
          order: true,
          items: { include: { product: true } },
        },
      }),
      this.prisma.deliveryPlan.findMany({
        where: {
          driverId: driver.id,
          plannedDate: range,
          status: { not: "CANCELLED" },
        },
        include: {
          orders: { include: { order: { include: { customer: true } } } },
        },
      }),
    ]);
    const pendingOrders = plans.flatMap((plan) =>
      plan.orders
        .filter((link) => !deliveries.some((d) => d.orderId === link.orderId))
        .map((link) => ({
          id: -link.orderId,
          deliveryNumber: plan.planNumber,
          customer: link.order.customer,
          status: "AWAITING_LOADING",
          pendingPlan: true,
          items: [],
        })),
    );
    const cash = payments.filter((p) => p.method === "CASH");
    const cheques = payments.filter((p) => p.method === "CHEQUE");
    const money = (rows: { amount: unknown }[]) =>
      rows.reduce((n, r) => n + Number(r.amount), 0);
    const undelivered = deliveries
      .filter((d) => ["PARTIALLY_DELIVERED", "CANCELLED"].includes(d.status))
      .map((d) => ({
        ...d,
        items: d.items
          .map((i) => ({
            ...i,
            notDeliveredQuantity:
              Number(i.orderedQuantity) - Number(i.deliveredQuantity),
          }))
          .filter((i) => i.notDeliveredQuantity > 0),
      }))
      .filter((d) => d.items.length);
    return {
      driver,
      date: query.date,
      cash,
      cheques,
      returns,
      cans,
      deliveries: [...deliveries, ...pendingOrders],
      undelivered,
      totals: {
        cash: money(cash),
        cashConfirmed: money(cash.filter((p) => p.status === "POSTED")),
        chequeCount: cheques.length,
        chequeAmount: money(cheques),
        chequeReceived: cheques.filter((p) => p.status !== "TEMPORARY").length,
        chequeCleared: cheques.filter((p) => p.status === "POSTED").length,
        returnAmount: returns
          .filter((r) => !["REJECTED", "CANCELLED"].includes(r.status))
          .reduce((n, r) => n + Number(r.totalAmount), 0),
        returnsReceived: returns.filter((r) => r.status === "RECEIVED").length,
        deliveredOrders: deliveries.filter((d) => d.status === "DELIVERED")
          .length,
        partiallyDeliveredOrders: deliveries.filter(
          (d) =>
            d.status === "PARTIALLY_DELIVERED" &&
            d.items.some((i) => Number(i.deliveredQuantity) > 0),
        ).length,
        notDeliveredOrders:
          deliveries.filter(
            (d) =>
              d.status !== "DELIVERED" &&
              !d.items.some((i) => Number(i.deliveredQuantity) > 0),
          ).length + pendingOrders.length,
        undeliveredQuantity: undelivered.reduce(
          (n, d) => n + d.items.reduce((v, i) => v + i.notDeliveredQuantity, 0),
          0,
        ),
        undeliveredReceived: undelivered.filter(
          (d) => d.returnedItemsReceivedAt,
        ).length,
        cans: cans
          .filter((r) => !["REJECTED", "CANCELLED"].includes(r.status))
          .reduce(
            (n, r) =>
              n +
              (r.items as { quantity: number }[]).reduce(
                (v, i) => v + i.quantity,
                0,
              ),
            0,
          ),
        cansConfirmed: cans
          .filter((r) => r.status === "CONFIRMED")
          .reduce(
            (n, r) =>
              n +
              (r.items as { quantity: number }[]).reduce(
                (v, i) => v + i.quantity,
                0,
              ),
            0,
          ),
      },
    };
  }
  async receiveUndelivered(id: number, actor: AuthenticatedUser) {
    const officeId = await this.cans.officeScope(actor);
    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.findFirst({
        where: { id, customer: { officeId } },
        include: { items: true },
      });
      if (
        !delivery ||
        !["PARTIALLY_DELIVERED", "CANCELLED"].includes(delivery.status) ||
        !delivery.items.some(
          (i) => Number(i.orderedQuantity) > Number(i.deliveredQuantity),
        )
      )
        throw new BadRequestException(
          "Record the delivery outcome before receiving undelivered goods",
        );
      const changed = await tx.delivery.updateMany({
        where: { id, returnedItemsReceivedAt: null, status: delivery.status },
        data: {
          returnedItemsReceivedAt: new Date(),
          returnedItemsReceivedById: actor.id,
        },
      });
      if (!changed.count)
        throw new BadRequestException(
          "Undelivered goods have already been received",
        );
      // Existing delivery finalization deducts only delivered stock. Do not add rejected stock twice.
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "UNDELIVERED_GOODS_RECEIVED",
          entityType: "delivery",
          entityId: String(id),
        },
      });
      return { received: true };
    });
  }
}
