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

@Injectable()
export class PriceListsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async listCustomerGroups(query: CustomerGroupQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.CustomerGroupWhereInput = {
      status: query.status ?? { not: "DELETED" }
    };
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } }
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.customerGroup.findMany({
        include: { members: true },
        orderBy: { name: "asc" },
        skip,
        take,
        where
      }),
      this.prisma.customerGroup.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async createCustomerGroup(dto: CreateCustomerGroupDto, context: RequestContext) {
    await this.ensureUniqueCustomerGroupCode(dto.code);
    const group = await this.prisma.customerGroup.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        createdById: context.actor.id,
        description: dto.description,
        name: dto.name.trim()
      }
    });
    await this.auditService.record({
      action: "CUSTOMER_GROUP_CREATED",
      actorUserId: context.actor.id,
      entityId: group.id,
      entityType: "customer_group",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(group),
      userAgent: context.userAgent
    });
    return group;
  }

  async updateCustomerGroup(
    id: number,
    dto: UpdateCustomerGroupDto,
    context: RequestContext
  ) {
    const group = await this.findActiveCustomerGroup(id);
    const updatedGroup = await this.prisma.customerGroup.update({
      data: {
        description: dto.description,
        name: dto.name?.trim(),
        status: dto.status,
        updatedById: context.actor.id
      },
      where: { id }
    });
    await this.auditService.record({
      action: "CUSTOMER_GROUP_UPDATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "customer_group",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: toAuditJson(group),
      userAgent: context.userAgent
    });
    return updatedGroup;
  }

  async assignCustomersToGroup(
    id: number,
    dto: AssignCustomersToGroupDto,
    context: RequestContext
  ) {
    await this.findActiveCustomerGroup(id);
    await this.ensureCustomers(dto.customerIds);
    const existing = await this.prisma.customerGroupMember.findMany({
      where: { customerGroupId: id }
    });
    const group = await this.prisma.$transaction(async (tx) => {
      await tx.customerGroupMember.deleteMany({ where: { customerGroupId: id } });
      if (dto.customerIds.length) {
        await tx.customerGroupMember.createMany({
          data: dto.customerIds.map((customerId) => ({
            assignedById: context.actor.id,
            customerGroupId: id,
            customerId
          })),
          skipDuplicates: true
        });
      }
      return tx.customerGroup.findUniqueOrThrow({
        include: { members: true },
        where: { id }
      });
    });

    await this.auditService.record({
      action: "CUSTOMER_GROUP_MEMBERS_ASSIGNED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "customer_group",
      ipAddress: context.ipAddress,
      newValues: toAuditJson({ customerIds: dto.customerIds }),
      oldValues: toAuditJson({ customerIds: existing.map((item) => item.customerId) }),
      userAgent: context.userAgent
    });
    return group;
  }

  async listPriceLists(query: PriceListQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.PriceListWhereInput = {
      status: query.status ?? { not: "DELETED" }
    };
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } }
      ];
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.priceList.findMany({
        include: {
          assignments: true,
          items: { include: { product: true } }
        },
        orderBy: { effectiveFrom: "desc" },
        skip,
        take,
        where
      }),
      this.prisma.priceList.count({ where })
    ]);
    return toPaginatedResult(data, total, page, limit);
  }

  async createPriceList(dto: CreatePriceListDto, context: RequestContext) {
    const companyId = await this.resolveCompanyId(dto.companyId);
    const code = await this.resolveUniquePriceListCode(dto.code);
    this.validateEffectiveDates(dto.effectiveFrom, dto.effectiveTo);
    const priceList = await this.prisma.priceList.create({
      data: {
        code,
        companyId,
        createdById: context.actor.id,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
        name: dto.name.trim()
      }
    });
    await this.auditService.record({
      action: "PRICE_LIST_CREATED",
      actorUserId: context.actor.id,
      entityId: priceList.id,
      entityType: "price_list",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(priceList),
      userAgent: context.userAgent
    });
    return priceList;
  }

  async updatePriceList(id: number, dto: UpdatePriceListDto, context: RequestContext) {
    const priceList = await this.findPriceList(id);
    this.validateEffectiveDates(
      dto.effectiveFrom ?? priceList.effectiveFrom.toISOString(),
      dto.effectiveTo ?? priceList.effectiveTo?.toISOString()
    );
    const updatedPriceList = await this.prisma.priceList.update({
      data: {
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
        name: dto.name?.trim(),
        status: dto.status,
        updatedById: context.actor.id
      },
      where: { id }
    });
    await this.auditService.record({
      action: "PRICE_LIST_UPDATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "price_list",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: toAuditJson(priceList),
      userAgent: context.userAgent
    });
    return updatedPriceList;
  }

  async activatePriceList(id: number, context: RequestContext) {
    const priceList = await this.findPriceList(id);
    const nextStatus = priceList.effectiveFrom > new Date() ? "SCHEDULED" : "ACTIVE";
    const updatedPriceList = await this.prisma.priceList.update({
      data: {
        status: nextStatus,
        updatedById: context.actor.id
      },
      where: { id }
    });
    await this.auditService.record({
      action: "PRICE_LIST_ACTIVATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "price_list",
      ipAddress: context.ipAddress,
      newValues: toAuditJson({ status: nextStatus }),
      oldValues: toAuditJson({ status: priceList.status }),
      userAgent: context.userAgent
    });
    return updatedPriceList;
  }

  async softDeletePriceList(id: number, context: RequestContext) {
    const priceList = await this.findPriceList(id);
    const deletedPriceList = await this.prisma.priceList.update({
      data: {
        deletedAt: new Date(),
        deletedById: context.actor.id,
        status: "DELETED",
        updatedById: context.actor.id
      },
      where: { id }
    });
    await this.auditService.record({
      action: "PRICE_LIST_SOFT_DELETED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "price_list",
      ipAddress: context.ipAddress,
      oldValues: toAuditJson(priceList),
      userAgent: context.userAgent
    });
    return deletedPriceList;
  }

  async upsertPriceListItem(
    priceListId: number,
    dto: UpsertPriceListItemDto,
    context: RequestContext
  ) {
    await this.findPriceList(priceListId);
    const product = await this.ensureProduct(dto.productId);
    const existing = await this.prisma.priceListItem.findUnique({
      where: {
        priceListId_productId: {
          priceListId,
          productId: dto.productId
        }
      }
    });

    const item = await this.prisma.priceListItem.upsert({
      create: {
        priceListId,
        productId: dto.productId,
        unitPrice: dto.unitPrice
      },
      update: {
        unitPrice: dto.unitPrice
      },
      where: {
        priceListId_productId: {
          priceListId,
          productId: dto.productId
        }
      }
    });

    await this.prisma.productPriceHistory.create({
      data: {
        changedById: context.actor.id,
        newPrice: dto.unitPrice,
        oldPrice: existing?.unitPrice ?? product.price,
        priceListId,
        productId: dto.productId
      }
    });

    await this.auditService.record({
      action: "PRICE_LIST_ITEM_UPSERTED",
      actorUserId: context.actor.id,
      entityId: item.id,
      entityType: "price_list_item",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(item),
      oldValues: existing ? toAuditJson(existing) : undefined,
      userAgent: context.userAgent
    });
    return item;
  }

  async createAssignment(
    priceListId: number,
    dto: CreatePriceListAssignmentDto,
    context: RequestContext
  ) {
    await this.findPriceList(priceListId);
    await this.validateAssignment(dto);
    const assignment = await this.prisma.priceListAssignment.create({
      data: {
        createdById: context.actor.id,
        customerGroupId: dto.customerGroupId,
        customerId: dto.customerId,
        officeId: dto.officeId,
        priceListId,
        scope: dto.scope
      }
    });
    await this.auditService.record({
      action: "PRICE_LIST_ASSIGNED",
      actorUserId: context.actor.id,
      entityId: assignment.id,
      entityType: "price_list_assignment",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(assignment),
      userAgent: context.userAgent
    });
    return assignment;
  }

  async resolvePrice(dto: ResolvePriceDto) {
    const pricingDate = dto.pricingDate ? new Date(dto.pricingDate) : new Date();
    const product = await this.ensureProduct(dto.productId);
    const customer = dto.customerId
      ? await this.prisma.customer.findFirst({
          include: { customerGroupMembers: true },
          where: { id: dto.customerId, status: { not: "DELETED" } }
        })
      : null;

    const officeId = dto.officeId ?? customer?.officeId;
    const customerGroupIds = customer?.customerGroupMembers.map(
      (member) => member.customerGroupId
    ) ?? [];

    const assignmentFilters: Prisma.PriceListAssignmentWhereInput[] = [];
    if (customer) {
      assignmentFilters.push({ scope: "CUSTOMER", customerId: customer.id });
    }
    if (customerGroupIds.length) {
      assignmentFilters.push({
        scope: "CUSTOMER_GROUP",
        customerGroupId: { in: customerGroupIds }
      });
    }
    if (officeId) {
      assignmentFilters.push({ scope: "OFFICE", officeId });
    }
    assignmentFilters.push({ scope: "GLOBAL" });

    for (const filter of assignmentFilters) {
      const item = await this.findActivePriceItemForScope(
        dto.productId,
        pricingDate,
        filter
      );
      if (item) {
        return {
          priceListCode: item.priceList.code,
          priceListId: item.priceListId,
          productId: dto.productId,
          source: "PRICE_LIST",
          unitPrice: Number(item.unitPrice)
        };
      }
    }

    return {
      priceListCode: null,
      priceListId: null,
      productId: dto.productId,
      source: "PRODUCT_BASE_PRICE",
      unitPrice: Number(product.price)
    };
  }

  private async findActivePriceItemForScope(
    productId: number,
    pricingDate: Date,
    assignmentFilter: Prisma.PriceListAssignmentWhereInput
  ) {
    return this.prisma.priceListItem.findFirst({
      include: { priceList: true },
      orderBy: { priceList: { effectiveFrom: "desc" } },
      where: {
        productId,
        priceList: {
          assignments: { some: assignmentFilter },
          effectiveFrom: { lte: pricingDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: pricingDate } }],
          status: "ACTIVE"
        }
      }
    });
  }

  private async ensureCompany(companyId: number) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, status: { not: "DELETED" } }
    });
    if (!company) {
      throw new BadRequestException("Company is invalid");
    }
  }

  private async resolveCompanyId(companyId?: number) {
    if (companyId) {
      await this.ensureCompany(companyId);
      return companyId;
    }

    const company = await this.prisma.company.findFirst({
      orderBy: { id: "asc" },
      where: { status: { not: "DELETED" } }
    });
    if (!company) {
      throw new BadRequestException("Company is invalid");
    }
    return company.id;
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

  private async ensureCustomers(customerIds: number[]) {
    if (customerIds.length === 0) {
      return;
    }
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds }, status: { not: "DELETED" } }
    });
    if (customers.length !== customerIds.length) {
      throw new BadRequestException("One or more customers are invalid");
    }
  }

  private async findActiveCustomerGroup(id: number) {
    const group = await this.prisma.customerGroup.findFirst({
      where: { id, status: { not: "DELETED" } }
    });
    if (!group) {
      throw new NotFoundException("Customer group not found");
    }
    return group;
  }

  private async findPriceList(id: number) {
    const priceList = await this.prisma.priceList.findFirst({
      where: { id, status: { not: "DELETED" } }
    });
    if (!priceList) {
      throw new NotFoundException("Price list not found");
    }
    return priceList;
  }

  private async ensureUniqueCustomerGroupCode(code: string) {
    const existing = await this.prisma.customerGroup.findUnique({
      where: { code: normalizeCode(code) }
    });
    if (existing) {
      throw new ConflictException("Customer group code already exists");
    }
  }

  private async resolveUniquePriceListCode(code?: string) {
    if (code) {
      await this.ensureUniquePriceListCode(code);
      return normalizeCode(code);
    }

    const lastCode = await this.prisma.priceList.findFirst({
      orderBy: { code: "desc" },
      select: { code: true },
      where: { code: { startsWith: "PL-" } }
    });
    const generatedCode = nextSequentialCode("PL", lastCode?.code);
    await this.ensureUniquePriceListCode(generatedCode);
    return generatedCode;
  }

  private async ensureUniquePriceListCode(code: string) {
    const existing = await this.prisma.priceList.findUnique({
      where: { code: normalizeCode(code) }
    });
    if (existing) {
      throw new ConflictException("Price list code already exists");
    }
  }

  private validateEffectiveDates(effectiveFrom: string, effectiveTo?: string) {
    if (effectiveTo && new Date(effectiveFrom) >= new Date(effectiveTo)) {
      throw new BadRequestException("effectiveTo must be after effectiveFrom");
    }
  }

  private async validateAssignment(dto: CreatePriceListAssignmentDto) {
    const targetCount = [dto.customerId, dto.customerGroupId, dto.officeId].filter(
      Boolean
    ).length;
    if (dto.scope === "GLOBAL" && targetCount !== 0) {
      throw new BadRequestException("Global price list assignment cannot have a target");
    }
    if (dto.scope !== "GLOBAL" && targetCount !== 1) {
      throw new BadRequestException("Price list assignment requires exactly one target");
    }
    if (dto.scope === "CUSTOMER" && dto.customerId) {
      await this.ensureCustomers([dto.customerId]);
    }
    if (dto.scope === "CUSTOMER_GROUP" && dto.customerGroupId) {
      await this.findActiveCustomerGroup(dto.customerGroupId);
    }
    if (dto.scope === "OFFICE" && dto.officeId) {
      const office = await this.prisma.office.findFirst({
        where: { id: dto.officeId, status: { not: "DELETED" } }
      });
      if (!office) {
        throw new BadRequestException("Office is invalid");
      }
    }
  }
}
