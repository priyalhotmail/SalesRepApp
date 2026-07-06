import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Permissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { LoadingReportQueryDto } from "./dto/loading-report-query.dto";
import {
  DeliveryPerformanceQueryDto,
  InventoryReportQueryDto,
  ReportDateRangeQueryDto,
  SalesRepPerformanceQueryDto
} from "./dto/report-query.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get("loading")
  @Permissions("reports.loading")
  getLoadingReport(@Query() query: LoadingReportQueryDto) {
    return this.service.getLoadingReport(query);
  }

  @Get("loading/item-summary")
  @Permissions("reports.loading")
  getLoadingItemSummary(@Query() query: LoadingReportQueryDto) {
    return this.service.getLoadingItemSummary(query);
  }

  @Get("loading/customer-detail")
  @Permissions("reports.loading")
  getLoadingCustomerDetail(@Query() query: LoadingReportQueryDto) {
    return this.service.getLoadingCustomerDetail(query);
  }

  @Get("sales-summary")
  @Permissions("reports.sales")
  getSalesSummary(@Query() query: ReportDateRangeQueryDto) {
    return this.service.getSalesSummary(query);
  }

  @Get("collection-summary")
  @Permissions("reports.collections")
  getCollectionSummary(@Query() query: ReportDateRangeQueryDto) {
    return this.service.getCollectionSummary(query);
  }

  @Get("inventory-summary")
  @Permissions("reports.inventory")
  getInventorySummary(@Query() query: InventoryReportQueryDto) {
    return this.service.getInventorySummary(query);
  }

  @Get("low-stock")
  @Permissions("reports.inventory")
  getLowStockReport(@Query() query: InventoryReportQueryDto) {
    return this.service.getLowStockReport(query);
  }

  @Get("delivery-performance")
  @Permissions("reports.delivery")
  getDeliveryPerformance(@Query() query: DeliveryPerformanceQueryDto) {
    return this.service.getDeliveryPerformance(query);
  }

  @Get("sales-rep-performance")
  @Permissions("reports.performance")
  getSalesRepPerformance(@Query() query: SalesRepPerformanceQueryDto) {
    return this.service.getSalesRepPerformance(query);
  }
}
