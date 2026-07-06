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
import {
  nextSequentialCode,
  normalizeCode
} from "../common/utils/code-generator.util";
import { getPagination, toPaginatedResult } from "../common/utils/pagination.util";
import { PrismaService } from "../prisma/prisma.service";
import {
  AssignProductFactoriesDto
} from "./dto/product-factory-source.dto";
import {
  CreatePackagingOptionDto,
  UpdatePackagingOptionDto
} from "./dto/packaging.dto";
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

@Injectable()
export class ProductCatalogueService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async listGroups(query: ProductGroupQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.ProductGroupWhereInput = {
      status: query.status ?? { not: "DELETED" }
    };

    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } }
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.productGroup.findMany({
        orderBy: { name: "asc" },
        skip,
        take,
        where
      }),
      this.prisma.productGroup.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async createGroup(dto: CreateProductGroupDto, context: RequestContext) {
    const code = await this.resolveUniqueGroupCode(dto.code);
    const group = await this.prisma.productGroup.create({
      data: {
        code,
        createdById: context.actor.id,
        description: dto.description,
        name: dto.name.trim()
      }
    });

    await this.auditService.record({
      action: "PRODUCT_GROUP_CREATED",
      actorUserId: context.actor.id,
      entityId: group.id,
      entityType: "product_group",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(group),
      userAgent: context.userAgent
    });

    return group;
  }

  async updateGroup(
    id: number,
    dto: UpdateProductGroupDto,
    context: RequestContext
  ) {
    const group = await this.findActiveGroup(id);
    const updatedGroup = await this.prisma.productGroup.update({
      data: {
        description: dto.description,
        name: dto.name?.trim(),
        status: dto.status,
        updatedById: context.actor.id
      },
      where: { id }
    });

    await this.auditService.record({
      action: "PRODUCT_GROUP_UPDATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "product_group",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: toAuditJson(group),
      userAgent: context.userAgent
    });

    return updatedGroup;
  }

  async deleteGroup(id: number, context: RequestContext) {
    const group = await this.findActiveGroup(id);
    const activeProducts = await this.prisma.product.count({
      where: { productGroupId: id, status: { not: "DELETED" } }
    });

    if (activeProducts > 0) {
      throw new BadRequestException("Product group has active products");
    }

    const deletedGroup = await this.prisma.productGroup.update({
      data: {
        deletedAt: new Date(),
        deletedById: context.actor.id,
        status: "DELETED",
        updatedById: context.actor.id
      },
      where: { id }
    });

    await this.auditService.record({
      action: "PRODUCT_GROUP_SOFT_DELETED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "product_group",
      ipAddress: context.ipAddress,
      oldValues: toAuditJson(group),
      userAgent: context.userAgent
    });

    return deletedGroup;
  }

  async listProducts(query: ProductQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.ProductWhereInput = {
      productGroupId: query.productGroupId,
      status: query.status ?? { not: "DELETED" }
    };

    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } }
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        include: {
          factorySources: { include: { factory: true } },
          packagingOptions: true,
          productGroup: true
        },
        orderBy: { name: "asc" },
        skip,
        take,
        where
      }),
      this.prisma.product.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async createProduct(dto: CreateProductDto, context: RequestContext) {
    await this.findActiveGroup(dto.productGroupId);
    const code = await this.resolveUniqueProductCode(dto.code);

    const product = await this.prisma.product.create({
      data: {
        capacity: dto.capacity,
        code,
        createdById: context.actor.id,
        name: dto.name.trim(),
        price: dto.price,
        productGroupId: dto.productGroupId,
        supportsBulk: dto.supportsBulk ?? false,
        unitType: dto.unitType
      }
    });

    await this.prisma.productPriceHistory.create({
      data: {
        changedById: context.actor.id,
        newPrice: dto.price,
        productId: product.id
      }
    });

    await this.auditService.record({
      action: "PRODUCT_CREATED",
      actorUserId: context.actor.id,
      entityId: product.id,
      entityType: "product",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(product),
      userAgent: context.userAgent
    });

    return product;
  }

  async findProductById(id: number) {
    const product = await this.prisma.product.findFirst({
      include: {
        factorySources: { include: { factory: true } },
        packagingOptions: true,
        productGroup: true
      },
      where: { id }
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    return product;
  }

  async updateProduct(id: number, dto: UpdateProductDto, context: RequestContext) {
    const product = await this.findActiveProduct(id);
    if (dto.productGroupId) {
      await this.findActiveGroup(dto.productGroupId);
    }

    const updatedProduct = await this.prisma.product.update({
      data: {
        capacity: dto.capacity,
        name: dto.name?.trim(),
        price: dto.price,
        productGroupId: dto.productGroupId,
        status: dto.status,
        supportsBulk: dto.supportsBulk,
        unitType: dto.unitType,
        updatedById: context.actor.id
      },
      where: { id }
    });

    if (dto.price !== undefined && Number(product.price) !== dto.price) {
      await this.prisma.productPriceHistory.create({
        data: {
          changedById: context.actor.id,
          newPrice: dto.price,
          oldPrice: product.price,
          productId: id
        }
      });
    }

    await this.auditService.record({
      action: "PRODUCT_UPDATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "product",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: toAuditJson(product),
      userAgent: context.userAgent
    });

    return updatedProduct;
  }

  async deleteProduct(id: number, context: RequestContext) {
    const product = await this.findActiveProduct(id);
    const deletedProduct = await this.prisma.product.update({
      data: {
        deletedAt: new Date(),
        deletedById: context.actor.id,
        status: "DELETED",
        updatedById: context.actor.id
      },
      where: { id }
    });

    await this.auditService.record({
      action: "PRODUCT_SOFT_DELETED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "product",
      ipAddress: context.ipAddress,
      oldValues: toAuditJson(product),
      userAgent: context.userAgent
    });

    return deletedProduct;
  }

  async createPackagingOption(
    productId: number,
    dto: CreatePackagingOptionDto,
    context: RequestContext
  ) {
    const product = await this.findActiveProduct(productId);
    if (!product.supportsBulk && dto.unitQuantity > 1) {
      throw new BadRequestException("Product does not support bulk packaging");
    }

    const packaging = await this.prisma.productPackagingOption.create({
      data: {
        isDefault: dto.isDefault ?? false,
        name: dto.name.trim(),
        productId,
        unitQuantity: dto.unitQuantity
      }
    });

    await this.auditService.record({
      action: "PRODUCT_PACKAGING_CREATED",
      actorUserId: context.actor.id,
      entityId: packaging.id,
      entityType: "product_packaging_option",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(packaging),
      userAgent: context.userAgent
    });

    return packaging;
  }

  async updatePackagingOption(
    id: number,
    dto: UpdatePackagingOptionDto,
    context: RequestContext
  ) {
    const packaging = await this.prisma.productPackagingOption.findFirst({
      include: { product: true },
      where: { id, status: { not: "DELETED" } }
    });

    if (!packaging) {
      throw new NotFoundException("Packaging option not found");
    }

    if (!packaging.product.supportsBulk && (dto.unitQuantity ?? packaging.unitQuantity) > 1) {
      throw new BadRequestException("Product does not support bulk packaging");
    }

    const updatedPackaging = await this.prisma.productPackagingOption.update({
      data: {
        isDefault: dto.isDefault,
        name: dto.name?.trim(),
        status: dto.status,
        unitQuantity: dto.unitQuantity
      },
      where: { id }
    });

    await this.auditService.record({
      action: "PRODUCT_PACKAGING_UPDATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "product_packaging_option",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: toAuditJson(packaging),
      userAgent: context.userAgent
    });

    return updatedPackaging;
  }

  async assignFactories(
    productId: number,
    dto: AssignProductFactoriesDto,
    context: RequestContext
  ) {
    await this.findActiveProduct(productId);
    await this.ensureFactories(dto.factoryIds);

    const existing = await this.prisma.productFactorySource.findMany({
      where: { productId }
    });

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.productFactorySource.deleteMany({ where: { productId } });
      if (dto.factoryIds.length) {
        await tx.productFactorySource.createMany({
          data: dto.factoryIds.map((factoryId) => ({
            factoryId,
            productId
          })),
          skipDuplicates: true
        });
      }

      return tx.product.findUniqueOrThrow({
        include: { factorySources: { include: { factory: true } } },
        where: { id: productId }
      });
    });

    await this.auditService.record({
      action: "PRODUCT_FACTORIES_ASSIGNED",
      actorUserId: context.actor.id,
      entityId: productId,
      entityType: "product",
      ipAddress: context.ipAddress,
      newValues: toAuditJson({ factoryIds: dto.factoryIds }),
      oldValues: toAuditJson({ factoryIds: existing.map((item) => item.factoryId) }),
      userAgent: context.userAgent
    });

    return result;
  }

  calculatePackaging(dto: BulkPackagingCalculationDto) {
    return {
      fullPackages: Math.floor(dto.quantity / dto.unitsPerPackage),
      looseUnits: dto.quantity % dto.unitsPerPackage,
      quantity: dto.quantity,
      unitsPerPackage: dto.unitsPerPackage
    };
  }

  private async findActiveGroup(id: number) {
    const group = await this.prisma.productGroup.findFirst({
      where: { id, status: { not: "DELETED" } }
    });

    if (!group) {
      throw new NotFoundException("Product group not found");
    }

    return group;
  }

  private async findActiveProduct(id: number) {
    const product = await this.prisma.product.findFirst({
      where: { id, status: { not: "DELETED" } }
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    return product;
  }

  private async resolveUniqueGroupCode(code?: string) {
    if (code) {
      await this.ensureUniqueGroupCode(code);
      return normalizeCode(code);
    }

    const lastCode = await this.prisma.productGroup.findFirst({
      orderBy: { code: "desc" },
      select: { code: true },
      where: { code: { startsWith: "PG-" } }
    });
    const generatedCode = nextSequentialCode("PG", lastCode?.code);
    await this.ensureUniqueGroupCode(generatedCode);
    return generatedCode;
  }

  private async resolveUniqueProductCode(code?: string) {
    if (code) {
      await this.ensureUniqueProductCode(code);
      return normalizeCode(code);
    }

    const lastCode = await this.prisma.product.findFirst({
      orderBy: { code: "desc" },
      select: { code: true },
      where: { code: { startsWith: "PRD-" } }
    });
    const generatedCode = nextSequentialCode("PRD", lastCode?.code);
    await this.ensureUniqueProductCode(generatedCode);
    return generatedCode;
  }

  private async ensureUniqueGroupCode(code: string) {
    const group = await this.prisma.productGroup.findUnique({
      where: { code: normalizeCode(code) }
    });

    if (group) {
      throw new ConflictException("Product group code already exists");
    }
  }

  private async ensureUniqueProductCode(code: string) {
    const product = await this.prisma.product.findUnique({
      where: { code: normalizeCode(code) }
    });

    if (product) {
      throw new ConflictException("Product code already exists");
    }
  }

  private async ensureFactories(factoryIds: number[]) {
    if (factoryIds.length === 0) {
      return;
    }

    const factories = await this.prisma.factory.findMany({
      where: { id: { in: factoryIds }, status: { not: "DELETED" } }
    });

    if (factories.length !== factoryIds.length) {
      throw new BadRequestException("One or more factories are invalid");
    }
  }
}
