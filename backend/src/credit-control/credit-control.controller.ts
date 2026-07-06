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
import { CreditControlService } from "./credit-control.service";
import {
  CreateCreditOverrideRequestDto,
  CreditAgingQueryDto,
  CreditCheckDto,
  CreditOverrideRequestQueryDto,
  ReviewCreditOverrideRequestDto,
  UpdateCustomerCreditDto
} from "./dto/credit-control.dto";

@Controller("credit-control")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CreditControlController {
  constructor(private readonly service: CreditControlService) {}

  @Get("customers/:id/summary")
  @Permissions("credit_control.read")
  getCustomerSummary(@Param("id", ParseIntPipe) id: number) {
    return this.service.getCustomerSummary(id);
  }

  @Patch("customers/:id/settings")
  @Permissions("credit_control.update")
  updateCustomerSettings(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerCreditDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.updateCustomerSettings(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Post("check-order")
  @Permissions("credit_control.read")
  checkCredit(@Body() dto: CreditCheckDto) {
    return this.service.checkCredit(dto);
  }

  @Get("aging")
  @Permissions("credit_control.read")
  getAgingReport(@Query() query: CreditAgingQueryDto) {
    return this.service.getAgingReport(query);
  }

  @Get("override-requests")
  @Permissions("credit_control.read")
  listOverrideRequests(@Query() query: CreditOverrideRequestQueryDto) {
    return this.service.listOverrideRequests(query);
  }

  @Post("override-requests")
  @Permissions("credit_control.request_override")
  createOverrideRequest(
    @Body() dto: CreateCreditOverrideRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createOverrideRequest(
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Post("override-requests/:id/approve")
  @Permissions("credit_control.approve_override")
  approveOverrideRequest(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReviewCreditOverrideRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.approveOverrideRequest(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Post("override-requests/:id/reject")
  @Permissions("credit_control.approve_override")
  rejectOverrideRequest(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReviewCreditOverrideRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.rejectOverrideRequest(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }
}
