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
import { CreateSalesRepDto } from "./dto/create-sales-rep.dto";
import { SalesRepQueryDto } from "./dto/sales-rep-query.dto";
import { UpdateSalesRepDto } from "./dto/update-sales-rep.dto";

@Injectable()
export class SalesRepsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async list(query: SalesRepQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.SalesRepWhereInput = {
      officeId: query.officeId,
      status: query.status ?? { not: "DELETED" }
    };

    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
        { nic: { contains: query.search } },
        { email: { contains: query.search } }
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.salesRep.findMany({
        include: {
          office: true,
          user: {
            select: {
              displayName: true,
              email: true,
              id: true,
              status: true
            }
          }
        },
        orderBy: { name: "asc" },
        skip,
        take,
        where
      }),
      this.prisma.salesRep.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async create(dto: CreateSalesRepDto, context: RequestContext) {
    await this.ensureOffice(dto.officeId);
    await this.ensureUser(dto.userId);
    const code = await this.resolveUniqueCode(dto.code);

    const salesRep = await this.prisma.salesRep.create({
      data: {
        address: dto.address,
        code,
        createdById: context.actor.id,
        email: dto.email,
        name: dto.name.trim(),
        nic: dto.nic.trim(),
        officeId: dto.officeId,
        telephone: dto.telephone,
        userId: dto.userId
      }
    });

    await this.auditService.record({
      action: "SALES_REP_CREATED",
      actorUserId: context.actor.id,
      entityId: salesRep.id,
      entityType: "sales_rep",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(salesRep),
      userAgent: context.userAgent
    });

    return salesRep;
  }

  async findById(id: number) {
    const salesRep = await this.prisma.salesRep.findFirst({
      include: {
        office: true,
        user: {
          select: {
            displayName: true,
            email: true,
            id: true,
            status: true
          }
        }
      },
      where: { id }
    });

    if (!salesRep) {
      throw new NotFoundException("Sales rep not found");
    }

    return salesRep;
  }

  async update(id: number, dto: UpdateSalesRepDto, context: RequestContext) {
    const salesRep = await this.findActiveSalesRep(id);
    if (dto.officeId) {
      await this.ensureOffice(dto.officeId);
    }
    await this.ensureUser(dto.userId);

    const updatedSalesRep = await this.prisma.salesRep.update({
      data: {
        address: dto.address,
        email: dto.email,
        name: dto.name?.trim(),
        nic: dto.nic?.trim(),
        officeId: dto.officeId,
        status: dto.status,
        telephone: dto.telephone,
        updatedById: context.actor.id,
        userId: dto.userId
      },
      where: { id }
    });

    await this.auditService.record({
      action: "SALES_REP_UPDATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "sales_rep",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: toAuditJson(salesRep),
      userAgent: context.userAgent
    });

    return updatedSalesRep;
  }

  async softDelete(id: number, context: RequestContext) {
    const salesRep = await this.findActiveSalesRep(id);
    const activeCustomers = await this.prisma.customer.count({
      where: { salesRepId: id, status: { not: "DELETED" } }
    });

    if (activeCustomers > 0) {
      throw new BadRequestException("Sales rep has active customers");
    }

    const deletedSalesRep = await this.prisma.salesRep.update({
      data: {
        deletedAt: new Date(),
        deletedById: context.actor.id,
        status: "DELETED",
        updatedById: context.actor.id
      },
      where: { id }
    });

    await this.auditService.record({
      action: "SALES_REP_SOFT_DELETED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "sales_rep",
      ipAddress: context.ipAddress,
      oldValues: toAuditJson(salesRep),
      userAgent: context.userAgent
    });

    return deletedSalesRep;
  }

  private async ensureOffice(officeId: number) {
    const office = await this.prisma.office.findFirst({
      where: { id: officeId, status: { not: "DELETED" } }
    });

    if (!office) {
      throw new BadRequestException("Office is invalid");
    }
  }

  private async ensureUser(userId?: number) {
    if (!userId) {
      return;
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: "ACTIVE" }
    });

    if (!user) {
      throw new BadRequestException("Linked user is invalid");
    }
  }

  private async resolveUniqueCode(code?: string) {
    if (code) {
      await this.ensureUniqueCode(code);
      return normalizeCode(code);
    }

    const lastCode = await this.prisma.salesRep.findFirst({
      orderBy: { code: "desc" },
      select: { code: true },
      where: { code: { startsWith: "SR-" } }
    });
    const generatedCode = nextSequentialCode("SR", lastCode?.code);
    await this.ensureUniqueCode(generatedCode);
    return generatedCode;
  }

  private async ensureUniqueCode(code: string) {
    const salesRep = await this.prisma.salesRep.findUnique({
      where: { code: normalizeCode(code) }
    });

    if (salesRep) {
      throw new ConflictException("Sales rep code already exists");
    }
  }

  private async findActiveSalesRep(id: number) {
    const salesRep = await this.prisma.salesRep.findFirst({
      where: { id, status: { not: "DELETED" } }
    });

    if (!salesRep) {
      throw new NotFoundException("Sales rep not found");
    }

    return salesRep;
  }
}
