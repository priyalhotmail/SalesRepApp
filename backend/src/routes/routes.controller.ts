import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
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
  AssignRouteCustomersDto,
  CreateRouteDto,
  CreateRouteScheduleDto,
  RouteQueryDto,
  UpdateRouteDto,
  UpdateRouteScheduleDto
} from "./dto/route.dto";
import { RoutesService } from "./routes.service";

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RoutesController {
  constructor(private readonly service: RoutesService) {}

  @Get("routes")
  @Permissions("routes.read")
  listRoutes(
    @Query() query: RouteQueryDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.listRoutes(query, actor);
  }

  @Post("routes")
  @Permissions("routes.create")
  createRoute(
    @Body() dto: CreateRouteDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createRoute(dto, buildRequestContext(actor, request));
  }

  @Get("routes/:id")
  @Permissions("routes.read")
  findRouteById(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.findRouteById(id, actor);
  }

  @Patch("routes/:id")
  @Permissions("routes.update")
  updateRoute(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateRouteDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.updateRoute(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Delete("routes/:id")
  @Permissions("routes.delete")
  deleteRoute(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.deleteRoute(id, buildRequestContext(actor, request));
  }

  @Put("routes/:id/customers")
  @Permissions("routes.update")
  assignCustomers(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AssignRouteCustomersDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.assignCustomers(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Post("routes/:id/schedules")
  @Permissions("routes.update")
  createSchedule(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateRouteScheduleDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createSchedule(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Patch("route-schedules/:id")
  @Permissions("routes.update")
  updateSchedule(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateRouteScheduleDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.updateSchedule(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }
}
