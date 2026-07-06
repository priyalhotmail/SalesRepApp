import {
  Body,
  Controller,
  Delete,
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
  CreateSalesTargetDto,
  SalesTargetPerformanceQueryDto,
  SalesTargetQueryDto,
  UpdateSalesTargetDto
} from "./dto/sales-target.dto";
import { SalesTargetsService } from "./sales-targets.service";

@Controller("sales-targets")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalesTargetsController {
  constructor(private readonly service: SalesTargetsService) {}

  @Get()
  @Permissions("sales_targets.read")
  list(@Query() query: SalesTargetQueryDto) {
    return this.service.list(query);
  }

  @Post()
  @Permissions("sales_targets.create")
  create(
    @Body() dto: CreateSalesTargetDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.create(dto, buildRequestContext(actor, request));
  }

  @Get("performance")
  @Permissions("sales_targets.read")
  getPerformance(@Query() query: SalesTargetPerformanceQueryDto) {
    return this.service.getPerformance(query);
  }

  @Patch(":id")
  @Permissions("sales_targets.update")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateSalesTargetDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.update(id, dto, buildRequestContext(actor, request));
  }

  @Delete(":id")
  @Permissions("sales_targets.delete")
  delete(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.delete(id, buildRequestContext(actor, request));
  }
}
