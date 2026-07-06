import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DashboardQueryDto, DashboardTrendQueryDto } from "./dto/dashboard-query.dto";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(query: DashboardQueryDto, actorUserId: number) {
    const dateFilter = this.getDateFilter(query);
    const [
      customerCount,
      productCount,
      salesRepCount,
      warehouseCount,
      orderRows,
      invoiceTotals,
      paymentTotals,
      deliveryRows,
      lowStockCount,
      pendingActions,
      unreadNotifications
    ] = await Promise.all([
      this.prisma.customer.count({ where: { status: { not: "DELETED" } } }),
      this.prisma.product.count({ where: { status: { not: "DELETED" } } }),
      this.prisma.salesRep.count({ where: { status: { not: "DELETED" } } }),
      this.prisma.warehouse.count({ where: { status: { not: "DELETED" } } }),
      this.prisma.order.findMany({
        select: { status: true, totalAmount: true },
        where: { deletedAt: null, orderDate: dateFilter }
      }),
      this.prisma.salesInvoice.aggregate({
        _count: { _all: true },
        _sum: { balanceAmount: true, paidAmount: true, totalAmount: true },
        where: {
          deletedAt: null,
          invoiceDate: dateFilter,
          status: { not: "CANCELLED" }
        }
      }),
      this.prisma.payment.aggregate({
        _count: { _all: true },
        _sum: { amount: true },
        where: { paymentDate: dateFilter, status: "POSTED" }
      }),
      this.prisma.delivery.findMany({
        select: { status: true },
        where: { deliveryDate: dateFilter }
      }),
      this.getLowStockCount(),
      this.getPendingActionCounts(),
      this.prisma.notification.count({
        where: { status: "UNREAD", userId: actorUserId }
      })
    ]);

    return {
      filters: this.withResolvedDateRange(query),
      kpis: {
        activeCustomers: customerCount,
        activeProducts: productCount,
        activeSalesReps: salesRepCount,
        activeWarehouses: warehouseCount,
        collectedAmount: this.money(Number(paymentTotals._sum.amount ?? 0)),
        deliveryCount: deliveryRows.length,
        invoiceCount: invoiceTotals._count._all,
        lowStockCount,
        orderCount: orderRows.length,
        outstandingAmount: this.money(Number(invoiceTotals._sum.balanceAmount ?? 0)),
        pendingActionCount: Object.values(pendingActions).reduce(
          (sum, count) => sum + count,
          0
        ),
        salesAmount: this.money(Number(invoiceTotals._sum.totalAmount ?? 0)),
        unreadNotificationCount: unreadNotifications
      },
      ordersByStatus: this.countBy(orderRows.map((row) => row.status)),
      deliveriesByStatus: this.countBy(deliveryRows.map((row) => row.status)),
      pendingActions,
      totals: {
        orderAmount: this.money(
          orderRows.reduce((sum, order) => sum + Number(order.totalAmount), 0)
        ),
        paidInvoiceAmount: this.money(Number(invoiceTotals._sum.paidAmount ?? 0)),
        paymentCount: paymentTotals._count._all
      }
    };
  }

  async getSalesTrend(query: DashboardTrendQueryDto) {
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    const from = new Date(to);
    from.setDate(to.getDate() - (query.days - 1));
    from.setHours(0, 0, 0, 0);

    const invoices = await this.prisma.salesInvoice.findMany({
      select: { invoiceDate: true, totalAmount: true },
      where: {
        deletedAt: null,
        invoiceDate: { gte: from, lte: to },
        status: { not: "CANCELLED" }
      }
    });
    const buckets = new Map<string, { invoiceCount: number; salesAmount: number }>();

    for (let index = 0; index < query.days; index += 1) {
      const day = new Date(from);
      day.setDate(from.getDate() + index);
      buckets.set(this.dateKey(day), { invoiceCount: 0, salesAmount: 0 });
    }

    for (const invoice of invoices) {
      const key = this.dateKey(invoice.invoiceDate);
      const bucket = buckets.get(key) ?? { invoiceCount: 0, salesAmount: 0 };
      bucket.invoiceCount += 1;
      bucket.salesAmount += Number(invoice.totalAmount);
      buckets.set(key, bucket);
    }

    return {
      data: Array.from(buckets.entries()).map(([date, row]) => ({
        date,
        invoiceCount: row.invoiceCount,
        salesAmount: this.money(row.salesAmount)
      })),
      filters: { days: query.days }
    };
  }

  async getPendingActions() {
    const [
      customerChangeRequests,
      orderAmendments,
      creditOverrides,
      warehouseTransfers,
      returns
    ] = await Promise.all([
      this.prisma.customerChangeRequest.findMany({
        include: { customer: true, requestedBy: true },
        orderBy: { createdAt: "desc" },
        take: 10,
        where: { status: "PENDING" }
      }),
      this.prisma.orderAmendmentRequest.findMany({
        include: { order: true, requestedBy: true },
        orderBy: { createdAt: "desc" },
        take: 10,
        where: { status: "PENDING" }
      }),
      this.prisma.creditOverrideRequest.findMany({
        include: { customer: true, order: true, requestedBy: true },
        orderBy: { createdAt: "desc" },
        take: 10,
        where: { status: "PENDING" }
      }),
      this.prisma.warehouseTransfer.findMany({
        include: { fromWarehouse: true, requestedBy: true, toWarehouse: true },
        orderBy: { requestedAt: "desc" },
        take: 10,
        where: { status: "REQUESTED" }
      }),
      this.prisma.salesReturn.findMany({
        include: { customer: true },
        orderBy: { createdAt: "desc" },
        take: 10,
        where: { status: "REQUESTED" }
      })
    ]);

    return {
      counts: {
        creditOverrides: creditOverrides.length,
        customerChangeRequests: customerChangeRequests.length,
        orderAmendments: orderAmendments.length,
        returns: returns.length,
        warehouseTransfers: warehouseTransfers.length
      },
      creditOverrides,
      customerChangeRequests,
      orderAmendments,
      returns,
      warehouseTransfers
    };
  }

  private async getPendingActionCounts() {
    const [
      customerChangeRequests,
      orderAmendments,
      creditOverrides,
      warehouseTransfers,
      returns
    ] = await Promise.all([
      this.prisma.customerChangeRequest.count({ where: { status: "PENDING" } }),
      this.prisma.orderAmendmentRequest.count({ where: { status: "PENDING" } }),
      this.prisma.creditOverrideRequest.count({ where: { status: "PENDING" } }),
      this.prisma.warehouseTransfer.count({ where: { status: "REQUESTED" } }),
      this.prisma.salesReturn.count({ where: { status: "REQUESTED" } })
    ]);
    return {
      creditOverrides,
      customerChangeRequests,
      orderAmendments,
      returns,
      warehouseTransfers
    };
  }

  private async getLowStockCount() {
    const stocks = await this.prisma.inventoryStock.findMany({
      select: {
        lowStockThreshold: true,
        onHandQuantity: true,
        reservedQuantity: true
      }
    });
    return stocks.filter(
      (stock) =>
        Number(stock.onHandQuantity) - Number(stock.reservedQuantity) <=
        Number(stock.lowStockThreshold)
    ).length;
  }

  private getDateFilter(query: DashboardQueryDto): Prisma.DateTimeFilter {
    const range = this.getDateRange(query);
    return { gte: range.from, lte: range.to };
  }

  private getDateRange(query: DashboardQueryDto) {
    if (query.fromDate || query.toDate) {
      return {
        from: query.fromDate ? new Date(query.fromDate) : undefined,
        to: query.toDate ? new Date(query.toDate) : undefined
      };
    }
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    const from = new Date(to);
    from.setDate(to.getDate() - 29);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }

  private withResolvedDateRange(query: DashboardQueryDto) {
    const range = this.getDateRange(query);
    return {
      ...query,
      resolvedFromDate: range.from,
      resolvedToDate: range.to
    };
  }

  private countBy(values: string[]) {
    return values.reduce<Record<string, number>>((result, value) => {
      result[value] = (result[value] ?? 0) + 1;
      return result;
    }, {});
  }

  private dateKey(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private money(value: number) {
    return Number(value.toFixed(2));
  }
}
