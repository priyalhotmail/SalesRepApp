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
  AdjustInventoryDto,
  CreateStockReservationDto,
  InventoryMovementQueryDto,
  InventoryStockQueryDto,
  ReleaseStockReservationDto,
  StockReservationQueryDto
} from "./dto/inventory.dto";
import { InventoryService } from "./inventory.service";

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get("inventory/stocks")
  @Permissions("inventory.read")
  listStocks(@Query() query: InventoryStockQueryDto) {
    return this.service.listStocks(query);
  }

  @Get("inventory/movements")
  @Permissions("inventory.read")
  listMovements(@Query() query: InventoryMovementQueryDto) {
    return this.service.listMovements(query);
  }

  @Get("inventory/reservations")
  @Permissions("inventory.read")
  listReservations(@Query() query: StockReservationQueryDto) {
    return this.service.listReservations(query);
  }

  @Post("inventory/stocks/adjust")
  @Permissions("inventory.adjust")
  adjustStock(
    @Body() dto: AdjustInventoryDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.adjustStock(dto, buildRequestContext(actor, request));
  }

  @Post("inventory/reservations")
  @Permissions("inventory.reserve")
  createReservation(
    @Body() dto: CreateStockReservationDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createReservation(
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Post("inventory/reservations/:id/release")
  @Permissions("inventory.reserve")
  releaseReservation(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReleaseStockReservationDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.releaseReservation(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }
}
