import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { buildRequestContext } from "../common/types/request-context.type";
import {
  ConfirmDeliveryDto,
  CreateDeliveryPlanDto,
  CreateDeliveryDto,
  DeliveryPlanEligibleOrdersQueryDto,
  DeliveryPlanQueryDto,
  DeliveryPlanSummaryQueryDto,
  DeliveryNoteDto,
  DeliveryQueryDto
} from "./dto/delivery.dto";
import { DeliveryService } from "./delivery.service";

@Controller("deliveries")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DeliveryController {
  constructor(private readonly service: DeliveryService) {}

  @Get("drivers") @Permissions("delivery.create") listDrivers() { return this.service.listDrivers(); }
  @Get("plans/loading-summary") @Permissions("delivery.create") loadingSummary(@Query("orderIds") orderIds?: string) { return this.service.loadingSummary(orderIds); }
  @Get("plans") @Permissions("delivery.read") listPlans(@Query() query: DeliveryPlanQueryDto) { return this.service.listPlans(query); }
  @Get("plans/eligible-orders") @Permissions("delivery.create") eligiblePlanOrders(@Query() query: DeliveryPlanEligibleOrdersQueryDto) { return this.service.eligiblePlanOrders(query.routeId); }
  @Post("plans") @Permissions("delivery.create") createPlan(@Body() dto: CreateDeliveryPlanDto, @CurrentUser() actor: AuthenticatedUser, @Req() request: Request) { return this.service.createPlan(dto, buildRequestContext(actor, request)); }
  @Post("plans/:id/confirm-loading") @Permissions("delivery.update") confirmLoading(@Param("id", ParseIntPipe) id: number, @CurrentUser() actor: AuthenticatedUser, @Req() request: Request) { return this.service.confirmLoading(id, buildRequestContext(actor, request)); }

  @Get()
  @Permissions("delivery.read")
  listDeliveries(@Query() query: DeliveryQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.listDeliveries(query, actor);
  }

  @Post()
  @Permissions("delivery.create")
  createDelivery(
    @Body() dto: CreateDeliveryDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createDelivery(dto, buildRequestContext(actor, request));
  }

  @Get(":id")
  @Permissions("delivery.read")
  findDeliveryById(@Param("id", ParseIntPipe) id: number) {
    return this.service.findDeliveryById(id);
  }

  @Post(":id/dispatch")
  @Permissions("delivery.update")
  dispatchDelivery(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.dispatchDelivery(id, buildRequestContext(actor, request));
  }

  @Post(":id/confirm")
  @Permissions("delivery.update")
  confirmDelivery(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ConfirmDeliveryDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.confirmDelivery(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Post(":id/cancel")
  @Permissions("delivery.update")
  cancelDelivery(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: DeliveryNoteDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.cancelDelivery(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }
}
