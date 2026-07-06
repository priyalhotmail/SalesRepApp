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
  AdditionalDiscountRequestQueryDto,
  CreateAdditionalDiscountRequestDto,
  ReviewAdditionalDiscountRequestDto
} from "./dto/additional-discount.dto";
import {
  AssignCustomerDiscountDto,
  CreateDiscountClassDto,
  DiscountClassQueryDto,
  UpdateDiscountClassDto
} from "./dto/discount-class.dto";
import { DiscountCalculationDto } from "./dto/discount-calculate.dto";
import {
  CreateFreeItemOfferDto,
  FreeItemOfferQueryDto,
  UpdateFreeItemOfferDto
} from "./dto/free-item-offer.dto";
import {
  CreateSeasonalDiscountDto,
  SeasonalDiscountQueryDto,
  UpdateSeasonalDiscountDto
} from "./dto/seasonal-discount.dto";
import { DiscountsService } from "./discounts.service";

@Controller("discounts")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DiscountsController {
  constructor(private readonly service: DiscountsService) {}

  @Get("classes")
  @Permissions("discounts.read")
  listDiscountClasses(@Query() query: DiscountClassQueryDto) {
    return this.service.listDiscountClasses(query);
  }

  @Post("classes")
  @Permissions("discounts.create")
  createDiscountClass(
    @Body() dto: CreateDiscountClassDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createDiscountClass(dto, buildRequestContext(actor, request));
  }

  @Patch("classes/:id")
  @Permissions("discounts.update")
  updateDiscountClass(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateDiscountClassDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.updateDiscountClass(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Delete("classes/:id")
  @Permissions("discounts.delete")
  deleteDiscountClass(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.deleteDiscountClass(id, buildRequestContext(actor, request));
  }

  @Post("customer-assignments")
  @Permissions("discounts.update")
  assignCustomerDiscount(
    @Body() dto: AssignCustomerDiscountDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.assignCustomerDiscount(
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Get("seasonal")
  @Permissions("discounts.read")
  listSeasonalDiscounts(@Query() query: SeasonalDiscountQueryDto) {
    return this.service.listSeasonalDiscounts(query);
  }

  @Post("seasonal")
  @Permissions("discounts.create")
  createSeasonalDiscount(
    @Body() dto: CreateSeasonalDiscountDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createSeasonalDiscount(
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Patch("seasonal/:id")
  @Permissions("discounts.update")
  updateSeasonalDiscount(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateSeasonalDiscountDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.updateSeasonalDiscount(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Delete("seasonal/:id")
  @Permissions("discounts.delete")
  deleteSeasonalDiscount(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.deleteSeasonalDiscount(
      id,
      buildRequestContext(actor, request)
    );
  }

  @Get("free-item-offers")
  @Permissions("discounts.read")
  listFreeItemOffers(@Query() query: FreeItemOfferQueryDto) {
    return this.service.listFreeItemOffers(query);
  }

  @Post("free-item-offers")
  @Permissions("discounts.create")
  createFreeItemOffer(
    @Body() dto: CreateFreeItemOfferDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createFreeItemOffer(dto, buildRequestContext(actor, request));
  }

  @Patch("free-item-offers/:id")
  @Permissions("discounts.update")
  updateFreeItemOffer(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateFreeItemOfferDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.updateFreeItemOffer(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Delete("free-item-offers/:id")
  @Permissions("discounts.delete")
  deleteFreeItemOffer(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.deleteFreeItemOffer(id, buildRequestContext(actor, request));
  }

  @Post("additional-bill/request")
  @Permissions("discounts.request")
  requestAdditionalDiscount(
    @Body() dto: CreateAdditionalDiscountRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.requestAdditionalDiscount(
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Get("additional-bill/requests")
  @Permissions("discounts.read")
  listAdditionalDiscountRequests(
    @Query() query: AdditionalDiscountRequestQueryDto
  ) {
    return this.service.listAdditionalDiscountRequests(query);
  }

  @Post("additional-bill/:id/approve")
  @Permissions("discounts.approve")
  approveAdditionalDiscountRequest(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReviewAdditionalDiscountRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.approveAdditionalDiscountRequest(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Post("additional-bill/:id/reject")
  @Permissions("discounts.approve")
  rejectAdditionalDiscountRequest(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReviewAdditionalDiscountRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.rejectAdditionalDiscountRequest(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }

  @Post("calculate")
  @Permissions("discounts.calculate")
  calculate(@Body() dto: DiscountCalculationDto) {
    return this.service.calculate(dto);
  }
}

