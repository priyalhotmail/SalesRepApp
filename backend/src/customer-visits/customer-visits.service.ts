import {
  BadRequestException,
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
  CompleteCustomerVisitDto,
  CreateCustomerVisitDto,
  CustomerVisitQueryDto,
  VisitNoteDto
} from "./dto/customer-visit.dto";

const visitInclude = {
  customer: true,
  salesRep: true
} satisfies Prisma.CustomerVisitInclude;

@Injectable()
export class CustomerVisitsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async list(query: CustomerVisitQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.CustomerVisitWhereInput = {
      customerId: query.customerId,
      salesRepId: query.salesRepId,
      status: query.status,
      visitType: query.visitType
    };
    if (query.search) {
      where.OR = [
        { customer: { code: { contains: query.search } } },
        { customer: { displayName: { contains: query.search } } },
        { salesRep: { code: { contains: query.search } } },
        { salesRep: { name: { contains: query.search } } }
      ];
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.customerVisit.findMany({
        include: visitInclude,
        orderBy: [{ plannedAt: "desc" }, { visitedAt: "desc" }],
        skip,
        take,
        where
      }),
      this.prisma.customerVisit.count({ where })
    ]);
    return toPaginatedResult(data, total, page, limit);
  }

  async create(dto: CreateCustomerVisitDto, context: RequestContext) {
    await this.ensureCustomer(dto.customerId);
    if (dto.salesRepId) {
      await this.ensureSalesRep(dto.salesRepId);
    }
    const visit = await this.prisma.customerVisit.create({
      data: {
        createdById: context.actor.id,
        customerId: dto.customerId,
        notes: dto.notes,
        plannedAt: dto.plannedAt ? new Date(dto.plannedAt) : undefined,
        salesRepId: dto.salesRepId,
        visitType: dto.visitType
      },
      include: visitInclude
    });
    await this.auditService.record({
      action: "CUSTOMER_VISIT_CREATED",
      actorUserId: context.actor.id,
      entityId: visit.id,
      entityType: "customer_visit",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(visit),
      userAgent: context.userAgent
    });
    return visit;
  }

  async complete(id: number, dto: CompleteCustomerVisitDto, context: RequestContext) {
    const visit = await this.findActiveVisit(id);
    this.validateGeoPair(dto.latitude, dto.longitude);
    const completedVisit = await this.prisma.$transaction(async (tx) => {
      const updatedVisit = await tx.customerVisit.update({
        data: {
          collectionAmount: dto.collectionAmount,
          complaintNotes: dto.complaintNotes,
          geoAccuracyMeters: dto.geoAccuracyMeters,
          latitude: dto.latitude,
          longitude: dto.longitude,
          noOrderReason: dto.noOrderReason,
          notes: dto.notes ?? visit.notes,
          outcome: dto.outcome,
          status: "COMPLETED",
          updatedById: context.actor.id,
          visitedAt: dto.visitedAt ? new Date(dto.visitedAt) : new Date()
        },
        include: visitInclude,
        where: { id }
      });

      if (dto.latitude !== undefined && dto.longitude !== undefined) {
        await tx.customer.update({
          data: {
            geoAccuracyMeters: dto.geoAccuracyMeters,
            geoCapturedAt: new Date(),
            latitude: dto.latitude,
            longitude: dto.longitude,
            updatedById: context.actor.id
          },
          where: { id: visit.customerId }
        });
      }

      return updatedVisit;
    });
    await this.auditService.record({
      action: "CUSTOMER_VISIT_COMPLETED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "customer_visit",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(completedVisit),
      oldValues: toAuditJson(visit),
      userAgent: context.userAgent
    });
    return completedVisit;
  }

  async markMissed(id: number, dto: VisitNoteDto, context: RequestContext) {
    return this.changeStatus(id, "MISSED", dto, context);
  }

  async cancel(id: number, dto: VisitNoteDto, context: RequestContext) {
    return this.changeStatus(id, "CANCELLED", dto, context);
  }

  private async changeStatus(
    id: number,
    status: "MISSED" | "CANCELLED",
    dto: VisitNoteDto,
    context: RequestContext
  ) {
    const visit = await this.findActiveVisit(id);
    if (visit.status === "COMPLETED") {
      throw new BadRequestException("Completed visits cannot be changed");
    }
    const updatedVisit = await this.prisma.customerVisit.update({
      data: {
        notes: dto.notes ?? visit.notes,
        status,
        updatedById: context.actor.id
      },
      include: visitInclude,
      where: { id }
    });
    await this.auditService.record({
      action: status === "MISSED" ? "CUSTOMER_VISIT_MISSED" : "CUSTOMER_VISIT_CANCELLED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "customer_visit",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(updatedVisit),
      oldValues: toAuditJson(visit),
      userAgent: context.userAgent
    });
    return updatedVisit;
  }

  private async findActiveVisit(id: number) {
    const visit = await this.prisma.customerVisit.findUnique({
      include: visitInclude,
      where: { id }
    });
    if (!visit) {
      throw new NotFoundException("Customer visit not found");
    }
    if (["COMPLETED", "MISSED", "CANCELLED"].includes(visit.status)) {
      throw new BadRequestException("Visit is already finalized");
    }
    return visit;
  }

  private async ensureCustomer(customerId: number) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, status: { not: "DELETED" } }
    });
    if (!customer) {
      throw new BadRequestException("Customer is invalid");
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

  private validateGeoPair(latitude?: number, longitude?: number) {
    if (latitude === undefined && longitude === undefined) {
      return;
    }
    if (latitude === undefined || longitude === undefined) {
      throw new BadRequestException("Latitude and longitude must be provided together");
    }
  }
}
