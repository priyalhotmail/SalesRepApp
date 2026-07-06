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
  CreatePackagingOptionDto,
  UpdatePackagingOptionDto
} from "./dto/packaging.dto";
import { AssignProductFactoriesDto } from "./dto/product-factory-source.dto";
import {
  BulkPackagingCalculationDto,
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto
} from "./dto/product.dto";
import {
  CreateProductGroupDto,
  ProductGroupQueryDto,
  UpdateProductGroupDto
} from "./dto/product-group.dto";
import { ProductCatalogueService } from "./product-catalogue.service";

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductCatalogueController {
  constructor(private readonly service: ProductCatalogueService) {}

  @Get("product-groups")
  @Permissions("product_catalogue.read")
  listGroups(@Query() query: ProductGroupQueryDto) {
    return this.service.listGroups(query);
  }

  @Post("product-groups")
  @Permissions("product_catalogue.create")
  createGroup(
    @Body() dto: CreateProductGroupDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createGroup(dto, buildRequestContext(actor, request));
  }

  @Patch("product-groups/:id")
  @Permissions("product_catalogue.update")
  updateGroup(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateProductGroupDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.updateGroup(id, dto, buildRequestContext(actor, request));
  }

  @Delete("product-groups/:id")
  @Permissions("product_catalogue.delete")
  deleteGroup(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.deleteGroup(id, buildRequestContext(actor, request));
  }

  @Get("products")
  @Permissions("product_catalogue.read")
  listProducts(@Query() query: ProductQueryDto) {
    return this.service.listProducts(query);
  }

  @Post("products")
  @Permissions("product_catalogue.create")
  createProduct(
    @Body() dto: CreateProductDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createProduct(dto, buildRequestContext(actor, request));
  }

  @Get("products/:id")
  @Permissions("product_catalogue.read")
  findProductById(@Param("id", ParseIntPipe) id: number) {
    return this.service.findProductById(id);
  }

  @Patch("products/:id")
  @Permissions("product_catalogue.update")
  updateProduct(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.updateProduct(id, dto, buildRequestContext(actor, request));
  }

  @Delete("products/:id")
  @Permissions("product_catalogue.delete")
  deleteProduct(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.deleteProduct(id, buildRequestContext(actor, request));
  }

  @Post("products/:id/packaging-options")
  @Permissions("product_catalogue.create")
  createPackagingOption(
    @Param("id", ParseIntPipe) productId: number,
    @Body() dto: CreatePackagingOptionDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createPackagingOption(
      productId,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Patch("packaging-options/:id")
  @Permissions("product_catalogue.update")
  updatePackagingOption(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePackagingOptionDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.updatePackagingOption(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Put("products/:id/factories")
  @Permissions("product_catalogue.update")
  assignFactories(
    @Param("id", ParseIntPipe) productId: number,
    @Body() dto: AssignProductFactoriesDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.assignFactories(
      productId,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Post("products/calculate-packaging")
  @Permissions("product_catalogue.read")
  calculatePackaging(@Body() dto: BulkPackagingCalculationDto) {
    return this.service.calculatePackaging(dto);
  }
}

