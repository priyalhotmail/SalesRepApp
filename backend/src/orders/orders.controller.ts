import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
  CreateOrderAmendmentRequestDto,
  CreateOrderDto,
  OrderAmendmentRequestQueryDto,
  OrderQueryDto,
  ReviewOrderAmendmentRequestDto,
  UpdateOrderDto
} from "./dto/order.dto";
import { OrdersService } from "./orders.service";

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get("orders")
  @Permissions("orders.read")
  listOrders(@Query() query: OrderQueryDto) {
    return this.service.listOrders(query);
  }

  @Post("orders")
  @Permissions("orders.create")
  createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createOrder(dto, buildRequestContext(actor, request));
  }

  @Get("orders/:id")
  @Permissions("orders.read")
  findOrderById(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOrderById(id);
  }

  @Patch("orders/:id")
  @Permissions("orders.update")
  updateOrder(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.updateOrder(id, dto, buildRequestContext(actor, request));
  }

  @Post("orders/:id/approve")
  @Permissions("orders.approve")
  approveOrder(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.approveOrder(id, buildRequestContext(actor, request));
  }

  @Post("orders/:id/reserve-stock")
  @Permissions("orders.reserve_stock")
  reserveOrderStock(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.reserveOrderStock(id, buildRequestContext(actor, request));
  }

  @Post("orders/:id/cancel")
  @Permissions("orders.cancel")
  cancelOrder(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.cancelOrder(id, buildRequestContext(actor, request));
  }

  @Post("orders/:id/amendment-requests")
  @Permissions("orders.amend")
  createAmendmentRequest(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateOrderAmendmentRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createAmendmentRequest(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Get("order-amendment-requests")
  @Permissions("orders.read")
  listAmendmentRequests(@Query() query: OrderAmendmentRequestQueryDto) {
    return this.service.listAmendmentRequests(query);
  }

  @Post("order-amendment-requests/:id/approve")
  @Permissions("orders.approve_amendment")
  approveAmendmentRequest(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReviewOrderAmendmentRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.approveAmendmentRequest(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Post("order-amendment-requests/:id/reject")
  @Permissions("orders.approve_amendment")
  rejectAmendmentRequest(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReviewOrderAmendmentRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.rejectAmendmentRequest(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }
}
