import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LoadingReportQueryDto } from "./dto/loading-report-query.dto";
import {
  DeliveryPerformanceQueryDto,
  InventoryReportQueryDto,
  ReportDateRangeQueryDto,
  SalesRepPerformanceQueryDto
} from "./dto/report-query.dto";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getLoadingReport(query: LoadingReportQueryDto) {
    const orders = await this.getLoadingOrders(query);

    return {
      filters: query,
      orders,
      totals: {
        itemLineCount: orders.reduce((sum, order) => sum + order.items.length, 0),
        orderCount: orders.length,
        totalAmount: Number(
          orders
            .reduce((sum, order) => sum + Number(order.totalAmount), 0)
            .toFixed(2)
        )
      }
    };
  }

  async getLoadingItemSummary(query: LoadingReportQueryDto) {
    const orders = await this.getLoadingOrders(query);
    const summary = new Map<
      number,
      {
        productCode: string;
        productId: number;
        productName: string;
        totalAmount: number;
        totalFreeQuantity: number;
        totalQuantity: number;
      }
    >();

    for (const order of orders) {
      for (const item of order.items) {
        const current = summary.get(item.productId) ?? {
          productCode: item.product.code,
          productId: item.productId,
          productName: item.product.name,
          totalAmount: 0,
          totalFreeQuantity: 0,
          totalQuantity: 0
        };

        current.totalQuantity += Number(item.quantity);
        current.totalFreeQuantity += Number(item.freeQuantity);
        current.totalAmount += Number(item.lineTotal);
        summary.set(item.productId, current);
      }
    }

    return {
      data: Array.from(summary.values()).map((item) => ({
        ...item,
        totalAmount: Number(item.totalAmount.toFixed(2)),
        totalFreeQuantity: Number(item.totalFreeQuantity.toFixed(3)),
        totalQuantity: Number(item.totalQuantity.toFixed(3))
      })),
      filters: query
    };
  }

  async getLoadingCustomerDetail(query: LoadingReportQueryDto) {
    const orders = await this.getLoadingOrders(query);

    return {
      data: orders.map((order) => ({
        customerCode: order.customer.code,
        customerId: order.customerId,
        customerName: order.customer.displayName,
        items: order.items.map((item) => ({
          freeQuantity: Number(item.freeQuantity),
          lineTotal: Number(item.lineTotal),
          productCode: item.product.code,
          productId: item.productId,
          productName: item.product.name,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice)
        })),
        orderDate: order.orderDate,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: Number(order.totalAmount)
      })),
      filters: query
    };
  }

  async getSalesSummary(query: ReportDateRangeQueryDto) {
    const invoices = await this.prisma.salesInvoice.findMany({
      include: {
        customer: true,
        items: { include: { product: true } },
        order: { include: { salesRep: true } }
      },
      orderBy: { invoiceDate: "desc" },
      where: this.buildInvoiceWhere(query)
    });

    const byStatus = new Map<string, number>();
    const bySalesRep = new Map<
      string,
      { salesRepCode: string | null; salesRepId: number | null; salesRepName: string; totalAmount: number }
    >();
    const topProducts = new Map<
      number,
      { productCode: string; productId: number; productName: string; quantity: number; totalAmount: number }
    >();

    let totalRevenue = 0;
    let paidAmount = 0;
    let balanceAmount = 0;
    let returnTotal = 0;
    let totalVolume = 0;

    for (const invoice of invoices) {
      totalRevenue += Number(invoice.totalAmount);
      paidAmount += Number(invoice.paidAmount);
      balanceAmount += Number(invoice.balanceAmount);
      returnTotal += Number(invoice.returnTotal);
      byStatus.set(invoice.status, (byStatus.get(invoice.status) ?? 0) + 1);

      const salesRepId = invoice.order?.salesRepId ?? null;
      const salesRepKey = String(salesRepId ?? "unassigned");
      const salesRepRow = bySalesRep.get(salesRepKey) ?? {
        salesRepCode: invoice.order?.salesRep?.code ?? null,
        salesRepId,
        salesRepName: invoice.order?.salesRep?.name ?? "Unassigned",
        totalAmount: 0
      };
      salesRepRow.totalAmount += Number(invoice.totalAmount);
      bySalesRep.set(salesRepKey, salesRepRow);

      for (const item of invoice.items) {
        if (query.productId && item.productId !== query.productId) {
          continue;
        }
        totalVolume += Number(item.quantity);
        const productRow = topProducts.get(item.productId) ?? {
          productCode: item.product.code,
          productId: item.productId,
          productName: item.product.name,
          quantity: 0,
          totalAmount: 0
        };
        productRow.quantity += Number(item.quantity);
        productRow.totalAmount += Number(item.lineTotal);
        topProducts.set(item.productId, productRow);
      }
    }

    return {
      bySalesRep: Array.from(bySalesRep.values()).map((row) => ({
        ...row,
        totalAmount: this.money(row.totalAmount)
      })),
      byStatus: Object.fromEntries(byStatus),
      filters: this.withResolvedDateRange(query),
      topProducts: Array.from(topProducts.values())
        .map((row) => ({
          ...row,
          quantity: this.quantity(row.quantity),
          totalAmount: this.money(row.totalAmount)
        }))
        .sort((left, right) => right.totalAmount - left.totalAmount)
        .slice(0, 10),
      totals: {
        balanceAmount: this.money(balanceAmount),
        invoiceCount: invoices.length,
        paidAmount: this.money(paidAmount),
        returnTotal: this.money(returnTotal),
        totalRevenue: this.money(totalRevenue),
        totalVolume: this.quantity(totalVolume)
      }
    };
  }

  async getCollectionSummary(query: ReportDateRangeQueryDto) {
    const payments = await this.prisma.payment.findMany({
      include: { customer: true },
      orderBy: { paymentDate: "desc" },
      where: {
        customer: {
          officeId: query.officeId,
          salesRepId: query.salesRepId
        },
        customerId: query.customerId,
        paymentDate: this.getReportDateFilter(query),
        status: "POSTED"
      }
    });
    const returnedCheques = await this.prisma.cheque.findMany({
      include: { customer: true },
      where: {
        customer: {
          officeId: query.officeId,
          salesRepId: query.salesRepId
        },
        customerId: query.customerId,
        returnedAt: this.getReportDateFilter(query),
        status: "RETURNED"
      }
    });
    const byMethod = new Map<string, { amount: number; count: number }>();
    const byCustomer = new Map<
      number,
      { amount: number; customerCode: string; customerId: number; customerName: string; count: number }
    >();

    for (const payment of payments) {
      const method = byMethod.get(payment.method) ?? { amount: 0, count: 0 };
      method.amount += Number(payment.amount);
      method.count += 1;
      byMethod.set(payment.method, method);

      const customer = byCustomer.get(payment.customerId) ?? {
        amount: 0,
        customerCode: payment.customer.code,
        customerId: payment.customerId,
        customerName: payment.customer.displayName,
        count: 0
      };
      customer.amount += Number(payment.amount);
      customer.count += 1;
      byCustomer.set(payment.customerId, customer);
    }

    return {
      byCustomer: Array.from(byCustomer.values())
        .map((row) => ({ ...row, amount: this.money(row.amount) }))
        .sort((left, right) => right.amount - left.amount)
        .slice(0, 10),
      byMethod: Array.from(byMethod.entries()).map(([method, row]) => ({
        amount: this.money(row.amount),
        count: row.count,
        method
      })),
      filters: this.withResolvedDateRange(query),
      returnedCheques: {
        amount: this.money(
          returnedCheques.reduce((sum, cheque) => sum + Number(cheque.amount), 0)
        ),
        count: returnedCheques.length
      },
      totals: {
        collectedAmount: this.money(
          payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
        ),
        paymentCount: payments.length
      }
    };
  }

  async getInventorySummary(query: InventoryReportQueryDto) {
    const stocks = await this.getInventoryStocks(query);
    const rows = stocks.map((stock) => {
      const onHandQuantity = Number(stock.onHandQuantity);
      const reservedQuantity = Number(stock.reservedQuantity);
      const availableQuantity = onHandQuantity - reservedQuantity;
      const stockValue = onHandQuantity * Number(stock.product.price);

      return {
        availableQuantity: this.quantity(availableQuantity),
        lowStock: availableQuantity <= Number(stock.lowStockThreshold),
        lowStockThreshold: this.quantity(Number(stock.lowStockThreshold)),
        onHandQuantity: this.quantity(onHandQuantity),
        productCode: stock.product.code,
        productId: stock.productId,
        productName: stock.product.name,
        reservedQuantity: this.quantity(reservedQuantity),
        stockId: stock.id,
        stockValue: this.money(stockValue),
        warehouseCode: stock.warehouse.code,
        warehouseId: stock.warehouseId,
        warehouseName: stock.warehouse.name
      };
    });

    return {
      filters: query,
      rows,
      totals: {
        availableQuantity: this.quantity(
          rows.reduce((sum, row) => sum + row.availableQuantity, 0)
        ),
        lowStockCount: rows.filter((row) => row.lowStock).length,
        onHandQuantity: this.quantity(rows.reduce((sum, row) => sum + row.onHandQuantity, 0)),
        reservedQuantity: this.quantity(
          rows.reduce((sum, row) => sum + row.reservedQuantity, 0)
        ),
        stockValue: this.money(rows.reduce((sum, row) => sum + row.stockValue, 0))
      }
    };
  }

  async getLowStockReport(query: InventoryReportQueryDto) {
    const summary = await this.getInventorySummary(query);
    return {
      filters: summary.filters,
      rows: summary.rows.filter((row) => row.lowStock),
      totals: {
        lowStockCount: summary.rows.filter((row) => row.lowStock).length
      }
    };
  }

  async getDeliveryPerformance(query: DeliveryPerformanceQueryDto) {
    const deliveries = await this.prisma.delivery.findMany({
      include: { route: true, warehouse: true },
      orderBy: { deliveryDate: "desc" },
      where: {
        deliveryDate: this.getReportDateFilter(query),
        routeId: query.routeId,
        warehouseId: query.warehouseId
      }
    });
    const byStatus = new Map<string, number>();
    const byRoute = new Map<
      string,
      { delivered: number; deliveryCount: number; routeCode: string | null; routeId: number | null; routeName: string }
    >();

    for (const delivery of deliveries) {
      byStatus.set(delivery.status, (byStatus.get(delivery.status) ?? 0) + 1);
      const routeKey = String(delivery.routeId ?? "unassigned");
      const routeRow = byRoute.get(routeKey) ?? {
        delivered: 0,
        deliveryCount: 0,
        routeCode: delivery.route?.code ?? null,
        routeId: delivery.routeId,
        routeName: delivery.route?.name ?? "Unassigned"
      };
      routeRow.deliveryCount += 1;
      if (["DELIVERED", "PARTIALLY_DELIVERED"].includes(delivery.status)) {
        routeRow.delivered += 1;
      }
      byRoute.set(routeKey, routeRow);
    }

    const deliveredCount = deliveries.filter((delivery) =>
      ["DELIVERED", "PARTIALLY_DELIVERED"].includes(delivery.status)
    ).length;

    return {
      byRoute: Array.from(byRoute.values()).map((row) => ({
        ...row,
        deliveryRatePercentage: this.percent(row.delivered, row.deliveryCount)
      })),
      byStatus: Object.fromEntries(byStatus),
      filters: this.withResolvedDateRange(query),
      totals: {
        deliveredCount,
        deliveryCount: deliveries.length,
        deliveryRatePercentage: this.percent(deliveredCount, deliveries.length)
      }
    };
  }

  async getSalesRepPerformance(query: SalesRepPerformanceQueryDto) {
    const now = new Date();
    const targetYear = query.targetYear ?? now.getFullYear();
    const targetMonth = query.targetMonth ?? now.getMonth() + 1;
    const { from, to } = this.getMonthRange(targetYear, targetMonth);
    const targets = await this.prisma.salesTarget.findMany({
      include: { product: true, salesRep: true },
      where: {
        salesRepId: query.salesRepId,
        status: "ACTIVE",
        targetMonth,
        targetYear
      }
    });
    const invoices = await this.prisma.salesInvoice.findMany({
      include: { items: true, order: true },
      where: {
        invoiceDate: { gte: from, lte: to },
        order: { salesRepId: query.salesRepId },
        status: { not: "CANCELLED" }
      }
    });

    return {
      filters: { salesRepId: query.salesRepId, targetMonth, targetYear },
      rows: targets.map((target) => {
        const matchingItems = invoices.flatMap((invoice) =>
          invoice.items.filter(
            (item) => !target.productId || item.productId === target.productId
          )
        );
        const actualRevenue = matchingItems.reduce(
          (sum, item) => sum + Number(item.lineTotal),
          0
        );
        const actualVolume = matchingItems.reduce(
          (sum, item) => sum + Number(item.quantity),
          0
        );

        return {
          actualRevenue: this.money(actualRevenue),
          actualVolume: this.quantity(actualVolume),
          productCode: target.product?.code ?? null,
          productId: target.productId,
          productName: target.product?.name ?? "All products",
          revenueAchievementPercentage: this.percent(
            actualRevenue,
            Number(target.revenueTarget)
          ),
          salesRepCode: target.salesRep.code,
          salesRepId: target.salesRepId,
          salesRepName: target.salesRep.name,
          targetId: target.id,
          targetRevenue: this.money(Number(target.revenueTarget)),
          targetVolume: this.quantity(Number(target.volumeTarget)),
          volumeAchievementPercentage: this.percent(
            actualVolume,
            Number(target.volumeTarget)
          )
        };
      })
    };
  }

  private async getLoadingOrders(query: LoadingReportQueryDto) {
    return this.prisma.order.findMany({
      include: {
        customer: true,
        items: { include: { product: true } },
        route: true,
        warehouse: true
      },
      orderBy: [{ routeId: "asc" }, { orderDate: "asc" }, { orderNumber: "asc" }],
      where: this.buildLoadingWhere(query)
    });
  }

  private buildLoadingWhere(query: LoadingReportQueryDto): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
      routeId: query.routeId,
      status: { in: ["APPROVED", "RESERVED", "LOADING"] },
      warehouseId: query.warehouseId
    };

    const range = this.getDateRange(query);
    if (range) {
      where.orderDate = {
        gte: range.from,
        lte: range.to
      };
    }

    return where;
  }

  private getDateRange(query: LoadingReportQueryDto) {
    if (query.fromDate || query.toDate) {
      return {
        from: query.fromDate ? new Date(query.fromDate) : undefined,
        to: query.toDate ? new Date(query.toDate) : undefined
      };
    }

    if (!query.date) {
      return undefined;
    }

    const from = new Date(query.date);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setHours(23, 59, 59, 999);

    return { from, to };
  }

  private buildInvoiceWhere(query: ReportDateRangeQueryDto): Prisma.SalesInvoiceWhereInput {
    const where: Prisma.SalesInvoiceWhereInput = {
      customerId: query.customerId,
      deletedAt: null,
      invoiceDate: this.getReportDateFilter(query),
      status: { not: "CANCELLED" }
    };

    if (query.officeId || query.salesRepId) {
      where.order = {
        officeId: query.officeId,
        salesRepId: query.salesRepId
      };
    }
    if (query.productId) {
      where.items = { some: { productId: query.productId } };
    }

    return where;
  }

  private async getInventoryStocks(query: InventoryReportQueryDto) {
    const where: Prisma.InventoryStockWhereInput = {
      productId: query.productId,
      warehouseId: query.warehouseId
    };
    if (query.search) {
      where.OR = [
        { product: { code: { contains: query.search } } },
        { product: { name: { contains: query.search } } },
        { warehouse: { code: { contains: query.search } } },
        { warehouse: { name: { contains: query.search } } }
      ];
    }
    return this.prisma.inventoryStock.findMany({
      include: { product: true, warehouse: true },
      orderBy: [{ warehouseId: "asc" }, { productId: "asc" }],
      where
    });
  }

  private getReportDateFilter(query: {
    fromDate?: string;
    toDate?: string;
  }): Prisma.DateTimeFilter {
    const range = this.getReportDateRange(query);
    return {
      gte: range.from,
      lte: range.to
    };
  }

  private getReportDateRange(query: { fromDate?: string; toDate?: string }) {
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

  private withResolvedDateRange<T extends { fromDate?: string; toDate?: string }>(
    query: T
  ) {
    const range = this.getReportDateRange(query);
    return {
      ...query,
      resolvedFromDate: range.from,
      resolvedToDate: range.to
    };
  }

  private getMonthRange(year: number, month: number) {
    const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { from, to };
  }

  private money(value: number) {
    return Number(value.toFixed(2));
  }

  private quantity(value: number) {
    return Number(value.toFixed(3));
  }

  private percent(actual: number, total: number) {
    if (total <= 0) {
      return 0;
    }
    return this.money((actual / total) * 100);
  }
}
