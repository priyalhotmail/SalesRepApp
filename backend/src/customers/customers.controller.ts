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
  CreateCustomerChangeRequestDto,
  CustomerChangeRequestQueryDto,
  ReviewCustomerChangeRequestDto
} from "./dto/customer-change-request.dto";
import {
  CustomerQueryDto,
  NearbyCustomerQueryDto
} from "./dto/customer-query.dto";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { CustomersService } from "./customers.service";

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get("customers")
  @Permissions("customers.read")
  list(
    @Query() query: CustomerQueryDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.list(query, actor);
  }

  @Post("customers")
  @Permissions("customers.create")
  create(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.create(dto, buildRequestContext(actor, request));
  }

  @Get("customers/new-context")
  @Permissions("customers.create")
  newCustomerContext(@CurrentUser() actor: AuthenticatedUser) {
    return this.service.getNewCustomerContext(actor);
  }

  @Get("customers/nearby")
  @Permissions("customers.read")
  findNearby(@Query() query: NearbyCustomerQueryDto) {
    return this.service.findNearby(query);
  }

  @Get("customers/:id")
  @Permissions("customers.read")
  findById(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.findById(id, actor);
  }

  @Patch("customers/:id")
  @Permissions("customers.update")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.update(id, dto, buildRequestContext(actor, request));
  }

  @Delete("customers/:id")
  @Permissions("customers.delete")
  softDelete(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.softDelete(id, buildRequestContext(actor, request));
  }

  @Post("customers/:id/change-requests")
  @Permissions("customers.request_change")
  requestChange(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateCustomerChangeRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.requestChange(id, dto, buildRequestContext(actor, request));
  }

  @Get("customers/:id/history")
  @Permissions("customers.read")
  getHistory(@Param("id", ParseIntPipe) id: number) {
    return this.service.getHistory(id);
  }

  @Get("customer-change-requests")
  @Permissions("customers.approve_change")
  listChangeRequests(@Query() query: CustomerChangeRequestQueryDto) {
    return this.service.listChangeRequests(query);
  }

  @Post("customer-change-requests/:id/approve")
  @Permissions("customers.approve_change")
  approveChangeRequest(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReviewCustomerChangeRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.approveChangeRequest(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Post("customer-change-requests/:id/reject")
  @Permissions("customers.approve_change")
  rejectChangeRequest(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReviewCustomerChangeRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.rejectChangeRequest(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }
}
