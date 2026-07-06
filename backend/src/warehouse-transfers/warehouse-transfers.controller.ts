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
  ApproveWarehouseTransferDto,
  CreateWarehouseTransferDto,
  ReceiveWarehouseTransferDto,
  WarehouseTransferNoteDto,
  WarehouseTransferQueryDto
} from "./dto/warehouse-transfer.dto";
import { WarehouseTransfersService } from "./warehouse-transfers.service";

@Controller("warehouse-transfers")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehouseTransfersController {
  constructor(private readonly service: WarehouseTransfersService) {}

  @Get()
  @Permissions("warehouse_transfers.read")
  list(@Query() query: WarehouseTransferQueryDto) {
    return this.service.list(query);
  }

  @Post()
  @Permissions("warehouse_transfers.create")
  create(
    @Body() dto: CreateWarehouseTransferDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.create(dto, buildRequestContext(actor, request));
  }

  @Get(":id")
  @Permissions("warehouse_transfers.read")
  findById(@Param("id", ParseIntPipe) id: number) {
    return this.service.findById(id);
  }

  @Post(":id/approve")
  @Permissions("warehouse_transfers.approve")
  approve(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ApproveWarehouseTransferDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.approve(id, dto, buildRequestContext(actor, request));
  }

  @Post(":id/reject")
  @Permissions("warehouse_transfers.approve")
  reject(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: WarehouseTransferNoteDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.reject(id, dto, buildRequestContext(actor, request));
  }

  @Post(":id/dispatch")
  @Permissions("warehouse_transfers.dispatch")
  dispatch(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: WarehouseTransferNoteDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.dispatch(id, dto, buildRequestContext(actor, request));
  }

  @Post(":id/receive")
  @Permissions("warehouse_transfers.receive")
  receive(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReceiveWarehouseTransferDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.receive(id, dto, buildRequestContext(actor, request));
  }

  @Post(":id/cancel")
  @Permissions("warehouse_transfers.cancel")
  cancel(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: WarehouseTransferNoteDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.cancel(id, dto, buildRequestContext(actor, request));
  }
}
