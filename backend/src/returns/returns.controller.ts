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
  CreateSalesReturnDto,
  ReceiveSalesReturnDto,
  ReviewSalesReturnDto,
  SalesReturnQueryDto
} from "./dto/return.dto";
import { ReturnsService } from "./returns.service";

@Controller("returns")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReturnsController {
  constructor(private readonly service: ReturnsService) {}

  @Get()
  @Permissions("returns.read")
  listReturns(@Query() query: SalesReturnQueryDto) {
    return this.service.listReturns(query);
  }

  @Post()
  @Permissions("returns.create")
  createReturn(
    @Body() dto: CreateSalesReturnDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createReturn(dto, buildRequestContext(actor, request));
  }

  @Get(":id")
  @Permissions("returns.read")
  findReturnById(@Param("id", ParseIntPipe) id: number) {
    return this.service.findReturnById(id);
  }

  @Post(":id/approve")
  @Permissions("returns.approve")
  approveReturn(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReviewSalesReturnDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.approveReturn(id, dto, buildRequestContext(actor, request));
  }

  @Post(":id/reject")
  @Permissions("returns.approve")
  rejectReturn(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReviewSalesReturnDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.rejectReturn(id, dto, buildRequestContext(actor, request));
  }

  @Post(":id/receive")
  @Permissions("returns.approve")
  receiveReturn(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReceiveSalesReturnDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.receiveReturn(id, dto, buildRequestContext(actor, request));
  }
}
