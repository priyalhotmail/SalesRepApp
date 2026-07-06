import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { getPagination, toPaginatedResult } from "../common/utils/pagination.util";
import { PrismaService } from "../prisma/prisma.service";
import {
  AuditLogExportQueryDto,
  AuditLogQueryDto
} from "./dto/audit-log-query.dto";

type RecordAuditInput = {
  action: string;
  actorUserId?: number;
  approvalReference?: string;
  entityId?: string | number;
  entityType: string;
  ipAddress?: string;
  newValues?: Prisma.InputJsonValue;
  oldValues?: Prisma.InputJsonValue;
  userAgent?: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditInput) {
    return this.prisma.auditLog.create({
      data: {
        action: input.action,
        actorUserId: input.actorUserId,
        approvalReference: input.approvalReference,
        entityId:
          input.entityId === undefined ? undefined : String(input.entityId),
        entityType: input.entityType,
        ipAddress: input.ipAddress,
        newValues: input.newValues,
        oldValues: input.oldValues,
        userAgent: input.userAgent
      }
    });
  }

  async list(query: AuditLogQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where = this.buildWhere(query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        include: { actor: true },
        orderBy: {
          createdAt: "desc"
        },
        skip,
        take,
        where
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async findById(id: number) {
    const auditLog = await this.prisma.auditLog.findUnique({
      include: { actor: true },
      where: { id }
    });
    if (!auditLog) {
      throw new NotFoundException("Audit log not found");
    }
    return auditLog;
  }

  async export(query: AuditLogExportQueryDto) {
    const data = await this.prisma.auditLog.findMany({
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
      where: this.buildWhere(query)
    });

    return {
      count: data.length,
      data,
      exportedAt: new Date(),
      format: query.format ?? "json",
      limit: 1000
    };
  }

  private buildWhere(query: AuditLogQueryDto): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {
      action: query.action,
      actorUserId: query.actorUserId,
      entityId: query.entityId,
      entityType: query.entityType
    };
    if (query.fromDate || query.toDate) {
      where.createdAt = {
        gte: query.fromDate ? new Date(query.fromDate) : undefined,
        lte: query.toDate ? new Date(query.toDate) : undefined
      };
    }
    if (query.search) {
      where.OR = [
        { action: { contains: query.search } },
        { entityType: { contains: query.search } },
        { entityId: { contains: query.search } },
        { ipAddress: { contains: query.search } }
      ];
    }
    return where;
  }
}
