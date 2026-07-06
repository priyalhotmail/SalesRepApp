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
  AssignCustomersToGroupDto,
  CreateCustomerGroupDto,
  CustomerGroupQueryDto,
  UpdateCustomerGroupDto
} from "./dto/customer-group.dto";
import {
  CreatePriceListAssignmentDto,
  CreatePriceListDto,
  PriceListQueryDto,
  ResolvePriceDto,
  UpdatePriceListDto,
  UpsertPriceListItemDto
} from "./dto/price-list.dto";
import { PriceListsService } from "./price-lists.service";

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PriceListsController {
  constructor(private readonly service: PriceListsService) {}

  @Get("customer-groups")
  @Permissions("price_lists.read")
  listCustomerGroups(@Query() query: CustomerGroupQueryDto) {
    return this.service.listCustomerGroups(query);
  }

  @Post("customer-groups")
  @Permissions("price_lists.create")
  createCustomerGroup(
    @Body() dto: CreateCustomerGroupDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createCustomerGroup(
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Patch("customer-groups/:id")
  @Permissions("price_lists.update")
  updateCustomerGroup(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerGroupDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.updateCustomerGroup(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Put("customer-groups/:id/customers")
  @Permissions("price_lists.update")
  assignCustomersToGroup(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AssignCustomersToGroupDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.assignCustomersToGroup(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Get("price-lists")
  @Permissions("price_lists.read")
  listPriceLists(@Query() query: PriceListQueryDto) {
    return this.service.listPriceLists(query);
  }

  @Post("price-lists")
  @Permissions("price_lists.create")
  createPriceList(
    @Body() dto: CreatePriceListDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createPriceList(dto, buildRequestContext(actor, request));
  }

  @Patch("price-lists/:id")
  @Permissions("price_lists.update")
  updatePriceList(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePriceListDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.updatePriceList(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Post("price-lists/:id/activate")
  @Permissions("price_lists.activate")
  activatePriceList(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.activatePriceList(id, buildRequestContext(actor, request));
  }

  @Delete("price-lists/:id")
  @Permissions("price_lists.delete")
  softDeletePriceList(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.softDeletePriceList(
      id,
      buildRequestContext(actor, request)
    );
  }

  @Put("price-lists/:id/items")
  @Permissions("price_lists.update")
  upsertPriceListItem(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpsertPriceListItemDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.upsertPriceListItem(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Post("price-lists/:id/assignments")
  @Permissions("price_lists.update")
  createAssignment(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreatePriceListAssignmentDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createAssignment(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Post("pricing/resolve")
  @Permissions("price_lists.read")
  resolvePrice(@Body() dto: ResolvePriceDto) {
    return this.service.resolvePrice(dto);
  }
}

