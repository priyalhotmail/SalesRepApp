import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { DashboardService } from "./dashboard.service";
import { DashboardQueryDto, DashboardTrendQueryDto } from "./dto/dashboard-query.dto";

@Controller("dashboard")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get("summary")
  @Permissions("dashboard.read")
  getSummary(
    @Query() query: DashboardQueryDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.getSummary(query, actor);
  }

  @Get("sales-trend")
  @Permissions("dashboard.read")
  getSalesTrend(@Query() query: DashboardTrendQueryDto) {
    return this.service.getSalesTrend(query);
  }

  @Get("pending-actions")
  @Permissions("dashboard.read")
  getPendingActions() {
    return this.service.getPendingActions();
  }
}
