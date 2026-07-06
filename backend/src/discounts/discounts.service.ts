import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { RequestContext } from "../common/types/request-context.type";
import { toAuditJson } from "../common/utils/audit-json.util";
import { getPagination, toPaginatedResult } from "../common/utils/pagination.util";
import { PrismaService } from "../prisma/prisma.service";
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

@Injectable()
export class DiscountsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async listDiscountClasses(query: DiscountClassQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.DiscountClassWhereInput = {
      status: query.status ?? { not: "DELETED" }
    };
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } }
      ];
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.discountClass.findMany({ orderBy: { name: "asc" }, skip, take, where }),
      this.prisma.discountClass.count({ where })
    ]);
    return toPaginatedResult(data, total, page, limit);
  }

  async createDiscountClass(dto: CreateDiscountClassDto, context: RequestContext) {
    await this.ensureUniqueDiscountClassCode(dto.code);
    const discountClass = await this.prisma.discountClass.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        createdById: context.actor.id,
        discountPercentage: dto.discountPercentage,
        name: dto.name.trim()
      }
    });
    await this.auditService.record({
      action: "DISCOUNT_CLASS_CREATED",
      actorUserId: context.actor.id,
      entityId: discountClass.id,
      entityType: "discount_class",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(discountClass),
      userAgent: context.userAgent
    });
    return discountClass;
  }

  async updateDiscountClass(
    id: number,
    dto: UpdateDiscountClassDto,
    context: RequestContext
  ) {
    const discountClass = await this.findActiveDiscountClass(id);
    const updatedDiscountClass = await this.prisma.discountClass.update({
      data: {
        discountPercentage: dto.discountPercentage,
        name: dto.name?.trim(),
        status: dto.status,
        updatedById: context.actor.id
      },
      where: { id }
    });
    await this.auditService.record({
      action: "DISCOUNT_CLASS_UPDATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "discount_class",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: toAuditJson(discountClass),
      userAgent: context.userAgent
    });
    return updatedDiscountClass;
  }

  async deleteDiscountClass(id: number, context: RequestContext) {
    const discountClass = await this.findActiveDiscountClass(id);
    const deletedDiscountClass = await this.prisma.discountClass.update({
      data: {
        deletedAt: new Date(),
        deletedById: context.actor.id,
        status: "DELETED",
        updatedById: context.actor.id
      },
      where: { id }
    });
    await this.auditService.record({
      action: "DISCOUNT_CLASS_SOFT_DELETED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "discount_class",
      ipAddress: context.ipAddress,
      oldValues: toAuditJson(discountClass),
      userAgent: context.userAgent
    });
    return deletedDiscountClass;
  }

  async assignCustomerDiscount(
    dto: AssignCustomerDiscountDto,
    context: RequestContext
  ) {
    this.validateDateRange(dto.effectiveFrom, dto.effectiveTo);
    await this.ensureCustomer(dto.customerId);
    await this.findActiveDiscountClass(dto.discountClassId);
    const assignment = await this.prisma.customerDiscountAssignment.create({
      data: {
        createdById: context.actor.id,
        customerId: dto.customerId,
        discountClassId: dto.discountClassId,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined
      }
    });
    await this.auditService.record({
      action: "CUSTOMER_DISCOUNT_ASSIGNED",
      actorUserId: context.actor.id,
      entityId: assignment.id,
      entityType: "customer_discount_assignment",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(assignment),
      userAgent: context.userAgent
    });
    return assignment;
  }

  async listSeasonalDiscounts(query: SeasonalDiscountQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.SeasonalDiscountWhereInput = {
      productId: query.productId,
      status: query.status ?? { not: "DELETED" }
    };
    if (query.search) {
      where.name = { contains: query.search };
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.seasonalDiscount.findMany({
        include: { product: true },
        orderBy: { validFrom: "desc" },
        skip,
        take,
        where
      }),
      this.prisma.seasonalDiscount.count({ where })
    ]);
    return toPaginatedResult(data, total, page, limit);
  }

  async createSeasonalDiscount(
    dto: CreateSeasonalDiscountDto,
    context: RequestContext
  ) {
    await this.ensureProduct(dto.productId);
    this.validateDateRange(dto.validFrom, dto.validTo);
    const discount = await this.prisma.seasonalDiscount.create({
      data: {
        createdById: context.actor.id,
        name: dto.name.trim(),
        productId: dto.productId,
        validFrom: new Date(dto.validFrom),
        validTo: new Date(dto.validTo),
        value: dto.value,
        valueType: dto.valueType
      }
    });
    await this.auditService.record({
      action: "SEASONAL_DISCOUNT_CREATED",
      actorUserId: context.actor.id,
      entityId: discount.id,
      entityType: "seasonal_discount",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(discount),
      userAgent: context.userAgent
    });
    return discount;
  }

  async updateSeasonalDiscount(
    id: number,
    dto: UpdateSeasonalDiscountDto,
    context: RequestContext
  ) {
    const discount = await this.findActiveSeasonalDiscount(id);
    this.validateDateRange(
      dto.validFrom ?? discount.validFrom.toISOString(),
      dto.validTo ?? discount.validTo.toISOString()
    );
    const updatedDiscount = await this.prisma.seasonalDiscount.update({
      data: {
        name: dto.name?.trim(),
        status: dto.status,
        updatedById: context.actor.id,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
        value: dto.value,
        valueType: dto.valueType
      },
      where: { id }
    });
    await this.auditService.record({
      action: "SEASONAL_DISCOUNT_UPDATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "seasonal_discount",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: toAuditJson(discount),
      userAgent: context.userAgent
    });
    return updatedDiscount;
  }

  async deleteSeasonalDiscount(id: number, context: RequestContext) {
    const discount = await this.findActiveSeasonalDiscount(id);
    const deletedDiscount = await this.prisma.seasonalDiscount.update({
      data: {
        deletedAt: new Date(),
        deletedById: context.actor.id,
        status: "DELETED",
        updatedById: context.actor.id
      },
      where: { id }
    });
    await this.auditService.record({
      action: "SEASONAL_DISCOUNT_SOFT_DELETED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "seasonal_discount",
      ipAddress: context.ipAddress,
      oldValues: toAuditJson(discount),
      userAgent: context.userAgent
    });
    return deletedDiscount;
  }

  async listFreeItemOffers(query: FreeItemOfferQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.FreeItemOfferWhereInput = {
      productId: query.productId,
      status: query.status ?? { not: "DELETED" }
    };
    if (query.search) {
      where.name = { contains: query.search };
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.freeItemOffer.findMany({
        include: { product: true },
        orderBy: { validFrom: "desc" },
        skip,
        take,
        where
      }),
      this.prisma.freeItemOffer.count({ where })
    ]);
    return toPaginatedResult(data, total, page, limit);
  }

  async createFreeItemOffer(dto: CreateFreeItemOfferDto, context: RequestContext) {
    await this.ensureProduct(dto.productId);
    this.validateDateRange(dto.validFrom, dto.validTo);
    const offer = await this.prisma.freeItemOffer.create({
      data: {
        buyQuantity: dto.buyQuantity,
        createdById: context.actor.id,
        freeQuantity: dto.freeQuantity,
        name: dto.name.trim(),
        productId: dto.productId,
        validFrom: new Date(dto.validFrom),
        validTo: new Date(dto.validTo)
      }
    });
    await this.auditService.record({
      action: "FREE_ITEM_OFFER_CREATED",
      actorUserId: context.actor.id,
      entityId: offer.id,
      entityType: "free_item_offer",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(offer),
      userAgent: context.userAgent
    });
    return offer;
  }

  async updateFreeItemOffer(
    id: number,
    dto: UpdateFreeItemOfferDto,
    context: RequestContext
  ) {
    const offer = await this.findActiveFreeItemOffer(id);
    this.validateDateRange(
      dto.validFrom ?? offer.validFrom.toISOString(),
      dto.validTo ?? offer.validTo.toISOString()
    );
    const updatedOffer = await this.prisma.freeItemOffer.update({
      data: {
        buyQuantity: dto.buyQuantity,
        freeQuantity: dto.freeQuantity,
        name: dto.name?.trim(),
        status: dto.status,
        updatedById: context.actor.id,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined
      },
      where: { id }
    });
    await this.auditService.record({
      action: "FREE_ITEM_OFFER_UPDATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "free_item_offer",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: toAuditJson(offer),
      userAgent: context.userAgent
    });
    return updatedOffer;
  }

  async deleteFreeItemOffer(id: number, context: RequestContext) {
    const offer = await this.findActiveFreeItemOffer(id);
    const deletedOffer = await this.prisma.freeItemOffer.update({
      data: {
        deletedAt: new Date(),
        deletedById: context.actor.id,
        status: "DELETED",
        updatedById: context.actor.id
      },
      where: { id }
    });
    await this.auditService.record({
      action: "FREE_ITEM_OFFER_SOFT_DELETED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "free_item_offer",
      ipAddress: context.ipAddress,
      oldValues: toAuditJson(offer),
      userAgent: context.userAgent
    });
    return deletedOffer;
  }

  async requestAdditionalDiscount(
    dto: CreateAdditionalDiscountRequestDto,
    context: RequestContext
  ) {
    await this.ensureCustomer(dto.customerId);
    const request = await this.prisma.additionalBillDiscountRequest.create({
      data: {
        customerId: dto.customerId,
        discountPercentage: dto.discountPercentage,
        reason: dto.reason,
        requestedById: context.actor.id
      }
    });
    await this.auditService.record({
      action: "ADDITIONAL_BILL_DISCOUNT_REQUESTED",
      actorUserId: context.actor.id,
      entityId: request.id,
      entityType: "additional_bill_discount_request",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(request),
      userAgent: context.userAgent
    });
    return request;
  }

  async listAdditionalDiscountRequests(query: AdditionalDiscountRequestQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.AdditionalBillDiscountRequestWhereInput = {
      customerId: query.customerId,
      status: query.status
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.additionalBillDiscountRequest.findMany({
        include: { customer: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
        where
      }),
      this.prisma.additionalBillDiscountRequest.count({ where })
    ]);
    return toPaginatedResult(data, total, page, limit);
  }

  async approveAdditionalDiscountRequest(
    id: number,
    dto: ReviewAdditionalDiscountRequestDto,
    context: RequestContext
  ) {
    return this.reviewAdditionalDiscountRequest(id, "APPROVED", dto, context);
  }

  async rejectAdditionalDiscountRequest(
    id: number,
    dto: ReviewAdditionalDiscountRequestDto,
    context: RequestContext
  ) {
    return this.reviewAdditionalDiscountRequest(id, "REJECTED", dto, context);
  }

  async calculate(dto: DiscountCalculationDto) {
    const calculationDate = dto.calculationDate ? new Date(dto.calculationDate) : new Date();
    const customerDiscountPercentage = dto.customerId
      ? await this.getCustomerDiscountPercentage(dto.customerId, calculationDate)
      : 0;
    const additionalDiscountPercentage = dto.additionalDiscountRequestId
      ? await this.getApprovedAdditionalDiscountPercentage(
          dto.additionalDiscountRequestId,
          dto.customerId
        )
      : 0;
    const cashDiscountPercentage =
      dto.cashPaymentSelected && dto.cashDiscountPercentage
        ? dto.cashDiscountPercentage
        : 0;

    const lines = [];
    for (const line of dto.lines) {
      const product = await this.ensureProduct(line.productId);
      const unitPrice = line.unitPrice ?? Number(product.price);
      const grossAmount = unitPrice * line.quantity;
      const seasonalDiscount = await this.getSeasonalDiscountAmount(
        line.productId,
        grossAmount,
        calculationDate
      );
      const freeQuantity = await this.getFreeQuantity(
        line.productId,
        line.quantity,
        calculationDate
      );
      const customerDiscount = this.percent(grossAmount, customerDiscountPercentage);
      const additionalDiscount = this.percent(grossAmount, additionalDiscountPercentage);
      const cashDiscount = this.percent(grossAmount, cashDiscountPercentage);
      const totalDiscount =
        seasonalDiscount.amount + customerDiscount + additionalDiscount + cashDiscount;
      const netAmount = Math.max(grossAmount - totalDiscount, 0);

      lines.push({
        additionalDiscount,
        cashDiscount,
        chargedQuantity: line.quantity,
        customerDiscount,
        freeQuantity,
        grossAmount,
        netAmount,
        productId: line.productId,
        seasonalDiscount,
        totalDiscount,
        totalQuantity: line.quantity + freeQuantity,
        unitPrice
      });
    }

    return {
      additionalDiscountPercentage,
      cashDiscountPercentage,
      customerDiscountPercentage,
      grossTotal: lines.reduce((sum, line) => sum + line.grossAmount, 0),
      lines,
      netTotal: lines.reduce((sum, line) => sum + line.netAmount, 0),
      totalDiscount: lines.reduce((sum, line) => sum + line.totalDiscount, 0)
    };
  }

  private async reviewAdditionalDiscountRequest(
    id: number,
    status: "APPROVED" | "REJECTED",
    dto: ReviewAdditionalDiscountRequestDto,
    context: RequestContext
  ) {
    const request = await this.prisma.additionalBillDiscountRequest.findFirst({
      where: { id, status: "PENDING" }
    });
    if (!request) {
      throw new NotFoundException("Pending additional discount request not found");
    }
    const reviewedRequest = await this.prisma.additionalBillDiscountRequest.update({
      data: {
        reviewedAt: new Date(),
        reviewedById: context.actor.id,
        reviewNote: dto.reviewNote,
        status
      },
      where: { id }
    });
    await this.auditService.record({
      action:
        status === "APPROVED"
          ? "ADDITIONAL_BILL_DISCOUNT_APPROVED"
          : "ADDITIONAL_BILL_DISCOUNT_REJECTED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "additional_bill_discount_request",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(reviewedRequest),
      oldValues: toAuditJson(request),
      userAgent: context.userAgent
    });
    return reviewedRequest;
  }

  private async ensureProduct(productId: number) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: { not: "DELETED" } }
    });
    if (!product) {
      throw new BadRequestException("Product is invalid");
    }
    return product;
  }

  private async ensureCustomer(customerId: number) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, status: { not: "DELETED" } }
    });
    if (!customer) {
      throw new BadRequestException("Customer is invalid");
    }
  }

  private async findActiveDiscountClass(id: number) {
    const discountClass = await this.prisma.discountClass.findFirst({
      where: { id, status: { not: "DELETED" } }
    });
    if (!discountClass) {
      throw new NotFoundException("Discount class not found");
    }
    return discountClass;
  }

  private async findActiveSeasonalDiscount(id: number) {
    const discount = await this.prisma.seasonalDiscount.findFirst({
      where: { id, status: { not: "DELETED" } }
    });
    if (!discount) {
      throw new NotFoundException("Seasonal discount not found");
    }
    return discount;
  }

  private async findActiveFreeItemOffer(id: number) {
    const offer = await this.prisma.freeItemOffer.findFirst({
      where: { id, status: { not: "DELETED" } }
    });
    if (!offer) {
      throw new NotFoundException("Free item offer not found");
    }
    return offer;
  }

  private async ensureUniqueDiscountClassCode(code: string) {
    const existing = await this.prisma.discountClass.findUnique({
      where: { code: code.trim().toUpperCase() }
    });
    if (existing) {
      throw new ConflictException("Discount class code already exists");
    }
  }

  private validateDateRange(validFrom: string, validTo?: string) {
    if (validTo && new Date(validFrom) >= new Date(validTo)) {
      throw new BadRequestException("End date must be after start date");
    }
  }

  private async getCustomerDiscountPercentage(customerId: number, date: Date) {
    const assignment = await this.prisma.customerDiscountAssignment.findFirst({
      include: { discountClass: true },
      orderBy: { effectiveFrom: "desc" },
      where: {
        customerId,
        discountClass: { status: "ACTIVE" },
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }]
      }
    });
    return assignment ? Number(assignment.discountClass.discountPercentage) : 0;
  }

  private async getApprovedAdditionalDiscountPercentage(
    requestId: number,
    customerId?: number
  ) {
    const request = await this.prisma.additionalBillDiscountRequest.findFirst({
      where: {
        customerId,
        id: requestId,
        status: "APPROVED"
      }
    });
    return request ? Number(request.discountPercentage) : 0;
  }

  private async getSeasonalDiscountAmount(
    productId: number,
    grossAmount: number,
    date: Date
  ) {
    const discount = await this.prisma.seasonalDiscount.findFirst({
      orderBy: { value: "desc" },
      where: {
        productId,
        status: "ACTIVE",
        validFrom: { lte: date },
        validTo: { gte: date }
      }
    });
    if (!discount) {
      return { amount: 0, id: null, name: null };
    }
    const amount =
      discount.valueType === "PERCENTAGE"
        ? this.percent(grossAmount, Number(discount.value))
        : Number(discount.value);
    return {
      amount: Math.min(amount, grossAmount),
      id: discount.id,
      name: discount.name
    };
  }

  private async getFreeQuantity(productId: number, quantity: number, date: Date) {
    const offer = await this.prisma.freeItemOffer.findFirst({
      orderBy: { buyQuantity: "desc" },
      where: {
        productId,
        status: "ACTIVE",
        validFrom: { lte: date },
        validTo: { gte: date }
      }
    });
    if (!offer) {
      return 0;
    }
    return Math.floor(quantity / offer.buyQuantity) * offer.freeQuantity;
  }

  private percent(amount: number, percentage: number) {
    return Number(((amount * percentage) / 100).toFixed(2));
  }
}

