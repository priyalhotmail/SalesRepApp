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
  CancelSalesInvoiceDto,
  CreateInvoiceFromOrderDto,
  SalesInvoiceQueryDto
} from "./dto/sales-invoice.dto";
import { SalesInvoicesService } from "./sales-invoices.service";

@Controller("sales-invoices")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalesInvoicesController {
  constructor(private readonly service: SalesInvoicesService) {}

  @Get()
  @Permissions("sales_invoices.read")
  listInvoices(@Query() query: SalesInvoiceQueryDto) {
    return this.service.listInvoices(query);
  }

  @Post("from-order")
  @Permissions("sales_invoices.create")
  createFromOrder(
    @Body() dto: CreateInvoiceFromOrderDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createFromOrder(dto, buildRequestContext(actor, request));
  }

  @Get("eligible-orders")
  @Permissions("sales_invoices.create")
  listEligibleOrders(@CurrentUser() actor: AuthenticatedUser) {
    return this.service.listEligibleOrders(actor);
  }

  @Get(":id")
  @Permissions("sales_invoices.read")
  findInvoiceById(@Param("id", ParseIntPipe) id: number) {
    return this.service.findInvoiceById(id);
  }

  @Post(":id/cancel")
  @Permissions("sales_invoices.cancel")
  cancelInvoice(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CancelSalesInvoiceDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.cancelInvoice(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }
}
