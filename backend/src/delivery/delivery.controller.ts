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
  CreateDeliveryDto,
  DeliveryNoteDto,
  DeliveryQueryDto
} from "./dto/delivery.dto";
import { DeliveryService } from "./delivery.service";

@Controller("deliveries")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DeliveryController {
  constructor(private readonly service: DeliveryService) {}

  @Get()
  @Permissions("delivery.read")
  listDeliveries(@Query() query: DeliveryQueryDto) {
    return this.service.listDeliveries(query);
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
