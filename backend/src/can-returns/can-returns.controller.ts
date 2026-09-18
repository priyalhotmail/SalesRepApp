import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { CanReturnsService } from "./can-returns.service";
import { DriverDayService } from "./driver-day.service";
import {
  CanReturnQuery,
  CanTypeDto,
  CreateCanReturnDto,
  DriverDayQuery,
} from "./can-return.dto";
@Controller("can-returns")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CanReturnsController {
  constructor(private readonly service: CanReturnsService) {}
  @Get("types") @Permissions("can_returns.read") types() {
    return this.service.types();
  }
  @Post("types") @Permissions("can_returns.configure") createType(
    @Body() dto: CanTypeDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.saveType(dto, actor);
  }
  @Put("types/:id") @Permissions("can_returns.configure") updateType(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CanTypeDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.saveType(dto, actor, id);
  }
  @Get("customer/:id") @Permissions("can_returns.read") customer(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.eligibility(id, actor);
  }
  @Get() @Permissions("can_returns.read") list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: CanReturnQuery,
  ) {
    return this.service.list(actor, query);
  }
  @Post() @Permissions("can_returns.create") create(
    @Body() dto: CreateCanReturnDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.create(dto, actor);
  }
  @Post(":id/confirm") @Permissions("can_returns.confirm") confirm(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.confirm(id, actor);
  }
  @Post(":id/reject") @Permissions("can_returns.confirm") reject(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.confirm(id, actor, true);
  }
}
@Controller("driver-day")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DriverDayController {
  constructor(private readonly service: DriverDayService) {}
  @Get("drivers") @Permissions("driver_day.read") drivers(
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.drivers(actor);
  }
  @Get() @Permissions("driver_day.read") summary(
    @Query() dto: DriverDayQuery,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.summary(dto, actor);
  }
  @Post("deliveries/:id/receive") @Permissions("driver_day.confirm") receive(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.receiveUndelivered(id, actor);
  }
}
