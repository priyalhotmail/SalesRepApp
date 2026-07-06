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
  CancelPaymentDto,
  CreatePaymentDto,
  PaymentQueryDto
} from "./dto/payment.dto";
import { PaymentsService } from "./payments.service";

@Controller("payments")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get()
  @Permissions("payments.read")
  listPayments(@Query() query: PaymentQueryDto) {
    return this.service.listPayments(query);
  }

  @Post()
  @Permissions("payments.create")
  createPayment(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createPayment(dto, buildRequestContext(actor, request));
  }

  @Get(":id")
  @Permissions("payments.read")
  findPaymentById(@Param("id", ParseIntPipe) id: number) {
    return this.service.findPaymentById(id);
  }

  @Post(":id/cancel")
  @Permissions("payments.cancel")
  cancelPayment(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CancelPaymentDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.cancelPayment(id, dto, buildRequestContext(actor, request));
  }
}
