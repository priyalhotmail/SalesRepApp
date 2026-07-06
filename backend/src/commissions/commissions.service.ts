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
  CalculateCommissionRunDto,
  CommissionRuleQueryDto,
  CommissionRunQueryDto,
  CreateCommissionRuleDto,
  UpdateCommissionRuleDto
} from "./dto/commission.dto";

@Injectable()
export class CommissionsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async listRules(query: CommissionRuleQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.CommissionRuleWhereInput = {
      productId: query.productId,
      salesRepId: query.salesRepId,
      status: query.status ?? { not: "DELETED" }
    };
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } }
      ];
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.commissionRule.findMany({
        include: { product: true, salesRep: true },
        orderBy: { effectiveFrom: "desc" },
        skip,
        take,
        where
      }),
      this.prisma.commissionRule.count({ where })
    ]);
    return toPaginatedResult(data, total, page, limit);
  }

  async createRule(dto: CreateCommissionRuleDto, context: RequestContext) {
    await this.ensureUniqueRuleCode(dto.code);
    await this.validateRuleReferences(dto.salesRepId, dto.productId);
    this.validateDateRange(dto.effectiveFrom, dto.effectiveTo);

    const rule = await this.prisma.commissionRule.create({
      data: {
        amountPerUnit: dto.amountPerUnit,
        bonusAmount: dto.bonusAmount,
        bonusThreshold: dto.bonusThreshold,
        code: dto.code.trim().toUpperCase(),
        createdById: context.actor.id,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
        name: dto.name.trim(),
        productId: dto.productId,
        ratePercentage: dto.ratePercentage,
        salesRepId: dto.salesRepId
      }
    });

    await this.auditService.record({
      action: "COMMISSION_RULE_CREATED",
      actorUserId: context.actor.id,
      entityId: rule.id,
      entityType: "commission_rule",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(rule),
      userAgent: context.userAgent
    });

    return rule;
  }

  async updateRule(
    id: number,
    dto: UpdateCommissionRuleDto,
    context: RequestContext
  ) {
    const rule = await this.findActiveRule(id);
    this.validateDateRange(
      dto.effectiveFrom ?? rule.effectiveFrom.toISOString(),
      dto.effectiveTo ?? rule.effectiveTo?.toISOString()
    );
    const updatedRule = await this.prisma.commissionRule.update({
      data: {
        amountPerUnit: dto.amountPerUnit,
        bonusAmount: dto.bonusAmount,
        bonusThreshold: dto.bonusThreshold,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
        name: dto.name?.trim(),
        ratePercentage: dto.ratePercentage,
        status: dto.status,
        updatedById: context.actor.id
      },
      where: { id }
    });

    await this.auditService.record({
      action: "COMMISSION_RULE_UPDATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "commission_rule",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: toAuditJson(rule),
      userAgent: context.userAgent
    });

    return updatedRule;
  }

  async deleteRule(id: number, context: RequestContext) {
    const rule = await this.findActiveRule(id);
    const deletedRule = await this.prisma.commissionRule.update({
      data: {
        deletedAt: new Date(),
        deletedById: context.actor.id,
        status: "DELETED",
        updatedById: context.actor.id
      },
      where: { id }
    });
    await this.auditService.record({
      action: "COMMISSION_RULE_SOFT_DELETED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "commission_rule",
      ipAddress: context.ipAddress,
      oldValues: toAuditJson(rule),
      userAgent: context.userAgent
    });
    return deletedRule;
  }

  async listRuns(query: CommissionRunQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.CommissionRunWhereInput = {
      periodMonth: query.periodMonth,
      periodYear: query.periodYear,
      salesRepId: query.salesRepId,
      status: query.status
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.commissionRun.findMany({
        include: { salesRep: true },
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
        skip,
        take,
        where
      }),
      this.prisma.commissionRun.count({ where })
    ]);
    return toPaginatedResult(data, total, page, limit);
  }

  async calculateRun(dto: CalculateCommissionRunDto, context: RequestContext) {
    await this.ensureSalesRep(dto.salesRepId);
    const { from, to } = this.getMonthRange(dto.periodYear, dto.periodMonth);
    const invoices = await this.prisma.salesInvoice.findMany({
      include: { items: true, order: true },
      where: {
        invoiceDate: { gte: from, lte: to },
        order: { salesRepId: dto.salesRepId },
        status: { not: "CANCELLED" }
      }
    });
    const rules = await this.prisma.commissionRule.findMany({
      where: {
        AND: [
          { OR: [{ salesRepId: null }, { salesRepId: dto.salesRepId }] },
          { OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }] }
        ],
        status: "ACTIVE",
        effectiveFrom: { lte: to }
      }
    });

    const revenueAmount = Number(
      invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0).toFixed(2)
    );
    const volumeAmount = Number(
      invoices
        .flatMap((invoice) => invoice.items)
        .reduce((sum, item) => sum + Number(item.quantity), 0)
        .toFixed(3)
    );
    let commissionAmount = 0;
    let bonusAmount = 0;

    for (const rule of rules) {
      const matchingItems = invoices.flatMap((invoice) =>
        invoice.items.filter(
          (item) => !rule.productId || item.productId === rule.productId
        )
      );
      const ruleRevenue = matchingItems.reduce(
        (sum, item) => sum + Number(item.lineTotal),
        0
      );
      const ruleVolume = matchingItems.reduce(
        (sum, item) => sum + Number(item.quantity),
        0
      );
      commissionAmount += (ruleRevenue * Number(rule.ratePercentage)) / 100;
      commissionAmount += ruleVolume * Number(rule.amountPerUnit);
      if (
        Number(rule.bonusThreshold) > 0 &&
        ruleRevenue >= Number(rule.bonusThreshold)
      ) {
        bonusAmount += Number(rule.bonusAmount);
      }
    }

    commissionAmount = Number(commissionAmount.toFixed(2));
    bonusAmount = Number(bonusAmount.toFixed(2));
    const run = await this.prisma.commissionRun.upsert({
      create: {
        bonusAmount,
        commissionAmount,
        createdById: context.actor.id,
        periodMonth: dto.periodMonth,
        periodYear: dto.periodYear,
        revenueAmount,
        salesRepId: dto.salesRepId,
        totalAmount: Number((commissionAmount + bonusAmount).toFixed(2)),
        volumeAmount
      },
      update: {
        bonusAmount,
        calculatedAt: new Date(),
        commissionAmount,
        createdById: context.actor.id,
        revenueAmount,
        status: "DRAFT",
        totalAmount: Number((commissionAmount + bonusAmount).toFixed(2)),
        volumeAmount
      },
      where: {
        salesRepId_periodYear_periodMonth: {
          periodMonth: dto.periodMonth,
          periodYear: dto.periodYear,
          salesRepId: dto.salesRepId
        }
      }
    });

    await this.auditService.record({
      action: "COMMISSION_RUN_CALCULATED",
      actorUserId: context.actor.id,
      entityId: run.id,
      entityType: "commission_run",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(run),
      userAgent: context.userAgent
    });

    return run;
  }

  async approveRun(id: number, context: RequestContext) {
    return this.changeRunStatus(id, "APPROVED", context);
  }

  async markRunPaid(id: number, context: RequestContext) {
    return this.changeRunStatus(id, "PAID", context);
  }

  private async changeRunStatus(
    id: number,
    status: "APPROVED" | "PAID",
    context: RequestContext
  ) {
    const run = await this.prisma.commissionRun.findUnique({ where: { id } });
    if (!run) {
      throw new NotFoundException("Commission run not found");
    }
    if (status === "APPROVED" && run.status !== "DRAFT") {
      throw new BadRequestException("Only draft runs can be approved");
    }
    if (status === "PAID" && run.status !== "APPROVED") {
      throw new BadRequestException("Only approved runs can be marked paid");
    }
    const updatedRun = await this.prisma.commissionRun.update({
      data: {
        approvedAt: status === "APPROVED" ? new Date() : run.approvedAt,
        approvedById: status === "APPROVED" ? context.actor.id : run.approvedById,
        paidAt: status === "PAID" ? new Date() : run.paidAt,
        status
      },
      where: { id }
    });
    await this.auditService.record({
      action: status === "APPROVED" ? "COMMISSION_RUN_APPROVED" : "COMMISSION_RUN_PAID",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "commission_run",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(updatedRun),
      oldValues: toAuditJson(run),
      userAgent: context.userAgent
    });
    return updatedRun;
  }

  private async findActiveRule(id: number) {
    const rule = await this.prisma.commissionRule.findFirst({
      where: { id, status: { not: "DELETED" } }
    });
    if (!rule) {
      throw new NotFoundException("Commission rule not found");
    }
    return rule;
  }

  private async ensureUniqueRuleCode(code: string) {
    const rule = await this.prisma.commissionRule.findUnique({
      where: { code: code.trim().toUpperCase() }
    });
    if (rule) {
      throw new ConflictException("Commission rule code already exists");
    }
  }

  private async validateRuleReferences(salesRepId?: number, productId?: number) {
    if (salesRepId) {
      await this.ensureSalesRep(salesRepId);
    }
    if (productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: productId, status: { not: "DELETED" } }
      });
      if (!product) {
        throw new BadRequestException("Product is invalid");
      }
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

  private validateDateRange(effectiveFrom: string, effectiveTo?: string) {
    if (effectiveTo && new Date(effectiveFrom) >= new Date(effectiveTo)) {
      throw new BadRequestException("Effective end date must be after start date");
    }
  }

  private getMonthRange(year: number, month: number) {
    const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { from, to };
  }
}
