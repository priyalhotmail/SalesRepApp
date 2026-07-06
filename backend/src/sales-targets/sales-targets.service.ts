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
  CreateSalesTargetDto,
  SalesTargetPerformanceQueryDto,
  SalesTargetQueryDto,
  UpdateSalesTargetDto
} from "./dto/sales-target.dto";

@Injectable()
export class SalesTargetsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async list(query: SalesTargetQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.SalesTargetWhereInput = {
      productId: query.productId,
      salesRepId: query.salesRepId,
      status: query.status ?? { not: "DELETED" },
      targetMonth: query.targetMonth,
      targetYear: query.targetYear
    };

    if (query.search) {
      where.OR = [
        { salesRep: { code: { contains: query.search } } },
        { salesRep: { name: { contains: query.search } } },
        { product: { code: { contains: query.search } } },
        { product: { name: { contains: query.search } } }
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.salesTarget.findMany({
        include: { product: true, salesRep: true },
        orderBy: [{ targetYear: "desc" }, { targetMonth: "desc" }],
        skip,
        take,
        where
      }),
      this.prisma.salesTarget.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async create(dto: CreateSalesTargetDto, context: RequestContext) {
    await this.ensureSalesRep(dto.salesRepId);
    if (dto.productId) {
      await this.ensureProduct(dto.productId);
    }
    await this.ensureNoDuplicateTarget(dto);

    const target = await this.prisma.salesTarget.create({
      data: {
        createdById: context.actor.id,
        notes: dto.notes,
        productId: dto.productId,
        revenueTarget: dto.revenueTarget,
        salesRepId: dto.salesRepId,
        targetMonth: dto.targetMonth,
        targetYear: dto.targetYear,
        volumeTarget: dto.volumeTarget
      },
      include: { product: true, salesRep: true }
    });

    await this.auditService.record({
      action: "SALES_TARGET_CREATED",
      actorUserId: context.actor.id,
      entityId: target.id,
      entityType: "sales_target",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(target),
      userAgent: context.userAgent
    });

    return target;
  }

  async update(id: number, dto: UpdateSalesTargetDto, context: RequestContext) {
    const target = await this.findActiveTarget(id);
    const updatedTarget = await this.prisma.salesTarget.update({
      data: {
        notes: dto.notes,
        revenueTarget: dto.revenueTarget,
        status: dto.status,
        updatedById: context.actor.id,
        volumeTarget: dto.volumeTarget
      },
      include: { product: true, salesRep: true },
      where: { id }
    });

    await this.auditService.record({
      action: "SALES_TARGET_UPDATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "sales_target",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: toAuditJson(target),
      userAgent: context.userAgent
    });

    return updatedTarget;
  }

  async delete(id: number, context: RequestContext) {
    const target = await this.findActiveTarget(id);
    const deletedTarget = await this.prisma.salesTarget.update({
      data: {
        deletedAt: new Date(),
        deletedById: context.actor.id,
        status: "DELETED",
        updatedById: context.actor.id
      },
      where: { id }
    });

    await this.auditService.record({
      action: "SALES_TARGET_SOFT_DELETED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "sales_target",
      ipAddress: context.ipAddress,
      oldValues: toAuditJson(target),
      userAgent: context.userAgent
    });

    return deletedTarget;
  }

  async getPerformance(query: SalesTargetPerformanceQueryDto) {
    await this.ensureSalesRep(query.salesRepId);
    const { from, to } = this.getMonthRange(query.targetYear, query.targetMonth);
    const targets = await this.prisma.salesTarget.findMany({
      include: { product: true },
      where: {
        salesRepId: query.salesRepId,
        status: "ACTIVE",
        targetMonth: query.targetMonth,
        targetYear: query.targetYear
      }
    });

    const invoices = await this.prisma.salesInvoice.findMany({
      include: {
        items: true,
        order: true
      },
      where: {
        invoiceDate: { gte: from, lte: to },
        order: { salesRepId: query.salesRepId },
        status: { not: "CANCELLED" }
      }
    });

    return targets.map((target) => {
      const matchingItems = invoices.flatMap((invoice) =>
        invoice.items.filter(
          (item) => !target.productId || item.productId === target.productId
        )
      );
      const actualRevenue = Number(
        matchingItems.reduce((sum, item) => sum + Number(item.lineTotal), 0).toFixed(2)
      );
      const actualVolume = Number(
        matchingItems.reduce((sum, item) => sum + Number(item.quantity), 0).toFixed(3)
      );

      return {
        actualRevenue,
        actualVolume,
        product: target.product,
        revenueAchievementPercentage: this.percent(
          actualRevenue,
          Number(target.revenueTarget)
        ),
        salesRepId: query.salesRepId,
        targetId: target.id,
        targetMonth: query.targetMonth,
        targetRevenue: Number(target.revenueTarget),
        targetVolume: Number(target.volumeTarget),
        targetYear: query.targetYear,
        volumeAchievementPercentage: this.percent(
          actualVolume,
          Number(target.volumeTarget)
        )
      };
    });
  }

  private async findActiveTarget(id: number) {
    const target = await this.prisma.salesTarget.findFirst({
      where: { id, status: { not: "DELETED" } }
    });
    if (!target) {
      throw new NotFoundException("Sales target not found");
    }
    return target;
  }

  private async ensureNoDuplicateTarget(dto: CreateSalesTargetDto) {
    const existingTarget = await this.prisma.salesTarget.findFirst({
      where: {
        productId: dto.productId ?? null,
        salesRepId: dto.salesRepId,
        status: { not: "DELETED" },
        targetMonth: dto.targetMonth,
        targetYear: dto.targetYear
      }
    });
    if (existingTarget) {
      throw new ConflictException("Sales target already exists for this period");
    }
  }

  private async ensureSalesRep(salesRepId: number) {
    const salesRep = await this.prisma.salesRep.findFirst({
      where: { id: salesRepId, status: { not: "DELETED" } }
    });
    if (!salesRep) {
      throw new BadRequestException("Sales rep is invalid");
    }
  }

  private async ensureProduct(productId: number) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: { not: "DELETED" } }
    });
    if (!product) {
      throw new BadRequestException("Product is invalid");
    }
  }

  private getMonthRange(year: number, month: number) {
    const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { from, to };
  }

  private percent(actual: number, target: number) {
    if (target <= 0) {
      return 0;
    }
    return Number(((actual / target) * 100).toFixed(2));
  }
}
