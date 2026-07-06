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
import { CommissionsService } from "./commissions.service";
import {
  CalculateCommissionRunDto,
  CommissionRuleQueryDto,
  CommissionRunQueryDto,
  CreateCommissionRuleDto,
  UpdateCommissionRuleDto
} from "./dto/commission.dto";

@Controller("commissions")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CommissionsController {
  constructor(private readonly service: CommissionsService) {}

  @Get("rules")
  @Permissions("commissions.read")
  listRules(@Query() query: CommissionRuleQueryDto) {
    return this.service.listRules(query);
  }

  @Post("rules")
  @Permissions("commissions.create")
  createRule(
    @Body() dto: CreateCommissionRuleDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createRule(dto, buildRequestContext(actor, request));
  }

  @Patch("rules/:id")
  @Permissions("commissions.update")
  updateRule(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCommissionRuleDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.updateRule(id, dto, buildRequestContext(actor, request));
  }

  @Delete("rules/:id")
  @Permissions("commissions.delete")
  deleteRule(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.deleteRule(id, buildRequestContext(actor, request));
  }

  @Get("runs")
  @Permissions("commissions.read")
  listRuns(@Query() query: CommissionRunQueryDto) {
    return this.service.listRuns(query);
  }

  @Post("runs/calculate")
  @Permissions("commissions.create")
  calculateRun(
    @Body() dto: CalculateCommissionRunDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.calculateRun(dto, buildRequestContext(actor, request));
  }

  @Post("runs/:id/approve")
  @Permissions("commissions.approve")
  approveRun(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.approveRun(id, buildRequestContext(actor, request));
  }

  @Post("runs/:id/pay")
  @Permissions("commissions.approve")
  markRunPaid(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.markRunPaid(id, buildRequestContext(actor, request));
  }
}
