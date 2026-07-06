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
import { CompanyStructureService } from "./company-structure.service";
import { UpdateCompanyDto } from "./dto/company.dto";
import { CreateFactoryDto, UpdateFactoryDto } from "./dto/factory.dto";
import { CreateOfficeDto, UpdateOfficeDto } from "./dto/office.dto";
import { StructureQueryDto } from "./dto/structure-query.dto";
import { CreateWarehouseDto, UpdateWarehouseDto } from "./dto/warehouse.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class CompanyStructureController {
  constructor(private readonly service: CompanyStructureService) {}

  @Get("companies/current")
  @Permissions("company_structure.read")
  getCurrentCompany() {
    return this.service.getCurrentCompany();
  }

  @Patch("companies/current")
  @Permissions("company_structure.update")
  updateCurrentCompany(
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.updateCurrentCompany(
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Get("offices")
  @Permissions("company_structure.read")
  listOffices(@Query() query: StructureQueryDto) {
    return this.service.listOffices(query);
  }

  @Post("offices")
  @Permissions("company_structure.create")
  createOffice(
    @Body() dto: CreateOfficeDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createOffice(dto, buildRequestContext(actor, request));
  }

  @Patch("offices/:id")
  @Permissions("company_structure.update")
  updateOffice(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateOfficeDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.updateOffice(id, dto, buildRequestContext(actor, request));
  }

  @Delete("offices/:id")
  @Permissions("company_structure.delete")
  deleteOffice(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.deleteOffice(id, buildRequestContext(actor, request));
  }

  @Get("factories")
  @Permissions("company_structure.read")
  listFactories(@Query() query: StructureQueryDto) {
    return this.service.listFactories(query);
  }

  @Post("factories")
  @Permissions("company_structure.create")
  createFactory(
    @Body() dto: CreateFactoryDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createFactory(dto, buildRequestContext(actor, request));
  }

  @Patch("factories/:id")
  @Permissions("company_structure.update")
  updateFactory(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateFactoryDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.updateFactory(id, dto, buildRequestContext(actor, request));
  }

  @Delete("factories/:id")
  @Permissions("company_structure.delete")
  deleteFactory(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.deleteFactory(id, buildRequestContext(actor, request));
  }

  @Get("warehouses")
  @Permissions("company_structure.read")
  listWarehouses(@Query() query: StructureQueryDto) {
    return this.service.listWarehouses(query);
  }

  @Post("warehouses")
  @Permissions("company_structure.create")
  createWarehouse(
    @Body() dto: CreateWarehouseDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createWarehouse(dto, buildRequestContext(actor, request));
  }

  @Patch("warehouses/:id")
  @Permissions("company_structure.update")
  updateWarehouse(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateWarehouseDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.updateWarehouse(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Delete("warehouses/:id")
  @Permissions("company_structure.delete")
  deleteWarehouse(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.deleteWarehouse(id, buildRequestContext(actor, request));
  }
}
