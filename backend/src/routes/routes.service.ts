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
  AssignRouteCustomersDto,
  CreateRouteDto,
  CreateRouteScheduleDto,
  RouteQueryDto,
  UpdateRouteDto,
  UpdateRouteScheduleDto
} from "./dto/route.dto";

@Injectable()
export class RoutesService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async listRoutes(query: RouteQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.RouteWhereInput = {
      officeId: query.officeId,
      status: query.status ?? { not: "DELETED" }
    };

    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
        { office: { code: { contains: query.search } } },
        { office: { name: { contains: query.search } } }
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.route.findMany({
        include: {
          customers: { include: { customer: true } },
          office: true,
          schedules: true
        },
        orderBy: { name: "asc" },
        skip,
        take,
        where
      }),
      this.prisma.route.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async findRouteById(id: number) {
    const route = await this.prisma.route.findFirst({
      include: {
        customers: { include: { customer: true } },
        office: true,
        schedules: true
      },
      where: { id, status: { not: "DELETED" } }
    });

    if (!route) {
      throw new NotFoundException("Route not found");
    }

    return route;
  }

  async createRoute(dto: CreateRouteDto, context: RequestContext) {
    await this.ensureOffice(dto.officeId);
    const code = await this.resolveUniqueRouteCode(dto.code);

    const route = await this.prisma.route.create({
      data: {
        code,
        createdById: context.actor.id,
        description: dto.description,
        name: dto.name.trim(),
        officeId: dto.officeId
      }
    });

    await this.auditService.record({
      action: "ROUTE_CREATED",
      actorUserId: context.actor.id,
      entityId: route.id,
      entityType: "route",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(route),
      userAgent: context.userAgent
    });

    return route;
  }

  async updateRoute(id: number, dto: UpdateRouteDto, context: RequestContext) {
    const route = await this.findActiveRoute(id);
    const updatedRoute = await this.prisma.route.update({
      data: {
        description: dto.description,
        name: dto.name?.trim(),
        status: dto.status,
        updatedById: context.actor.id
      },
      where: { id }
    });

    await this.auditService.record({
      action: "ROUTE_UPDATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "route",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: toAuditJson(route),
      userAgent: context.userAgent
    });

    return updatedRoute;
  }

  async deleteRoute(id: number, context: RequestContext) {
    const route = await this.findActiveRoute(id);
    const openOrders = await this.prisma.order.count({
      where: {
        deletedAt: null,
        routeId: id,
        status: { notIn: ["CANCELLED", "DELIVERED"] }
      }
    });

    if (openOrders > 0) {
      throw new BadRequestException("Route has active orders");
    }

    const deletedRoute = await this.prisma.route.update({
      data: {
        deletedAt: new Date(),
        deletedById: context.actor.id,
        status: "DELETED",
        updatedById: context.actor.id
      },
      where: { id }
    });

    await this.auditService.record({
      action: "ROUTE_SOFT_DELETED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "route",
      ipAddress: context.ipAddress,
      oldValues: toAuditJson(route),
      userAgent: context.userAgent
    });

    return deletedRoute;
  }

  async assignCustomers(
    routeId: number,
    dto: AssignRouteCustomersDto,
    context: RequestContext
  ) {
    await this.findActiveRoute(routeId);
    await this.ensureCustomers(dto.customerIds);

    const route = await this.prisma.$transaction(async (tx) => {
      await tx.routeCustomer.deleteMany({ where: { routeId } });
      if (dto.customerIds.length > 0) {
        await tx.routeCustomer.createMany({
          data: dto.customerIds.map((customerId) => ({
            assignedById: context.actor.id,
            customerId,
            routeId
          })),
          skipDuplicates: true
        });
      }

      return tx.route.findUnique({
        include: { customers: { include: { customer: true } }, schedules: true },
        where: { id: routeId }
      });
    });

    await this.auditService.record({
      action: "ROUTE_CUSTOMERS_ASSIGNED",
      actorUserId: context.actor.id,
      entityId: routeId,
      entityType: "route",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      userAgent: context.userAgent
    });

    return route;
  }

  async createSchedule(
    routeId: number,
    dto: CreateRouteScheduleDto,
    context: RequestContext
  ) {
    await this.findActiveRoute(routeId);

    const schedule = await this.prisma.routeSchedule.upsert({
      create: {
        dayOfWeek: dto.dayOfWeek,
        plannedTime: dto.plannedTime,
        routeId
      },
      update: {
        plannedTime: dto.plannedTime,
        status: "ACTIVE"
      },
      where: {
        routeId_dayOfWeek: {
          dayOfWeek: dto.dayOfWeek,
          routeId
        }
      }
    });

    await this.auditService.record({
      action: "ROUTE_SCHEDULE_UPSERTED",
      actorUserId: context.actor.id,
      entityId: schedule.id,
      entityType: "route_schedule",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(schedule),
      userAgent: context.userAgent
    });

    return schedule;
  }

  async updateSchedule(
    id: number,
    dto: UpdateRouteScheduleDto,
    context: RequestContext
  ) {
    const schedule = await this.prisma.routeSchedule.findUnique({
      where: { id }
    });
    if (!schedule) {
      throw new NotFoundException("Route schedule not found");
    }

    const updatedSchedule = await this.prisma.routeSchedule.update({
      data: {
        plannedTime: dto.plannedTime,
        status: dto.status
      },
      where: { id }
    });

    await this.auditService.record({
      action: "ROUTE_SCHEDULE_UPDATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "route_schedule",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: toAuditJson(schedule),
      userAgent: context.userAgent
    });

    return updatedSchedule;
  }

  private async ensureOffice(officeId: number) {
    const office = await this.prisma.office.findFirst({
      where: { id: officeId, status: { not: "DELETED" } }
    });
    if (!office) {
      throw new BadRequestException("Office is invalid");
    }
  }

  private async ensureCustomers(customerIds: number[]) {
    if (customerIds.length === 0) {
      return;
    }

    const count = await this.prisma.customer.count({
      where: { id: { in: customerIds }, status: { not: "DELETED" } }
    });

    if (count !== customerIds.length) {
      throw new BadRequestException("One or more customers are invalid");
    }
  }

  private async findActiveRoute(id: number) {
    const route = await this.prisma.route.findFirst({
      where: { id, status: { not: "DELETED" } }
    });
    if (!route) {
      throw new NotFoundException("Route not found");
    }
    return route;
  }

  private async resolveUniqueRouteCode(code?: string) {
    if (code) {
      await this.ensureUniqueRouteCode(code);
      return normalizeCode(code);
    }

    const lastCode = await this.prisma.route.findFirst({
      orderBy: { code: "desc" },
      select: { code: true },
      where: { code: { startsWith: "RTE-" } }
    });
    const generatedCode = nextSequentialCode("RTE", lastCode?.code);
    await this.ensureUniqueRouteCode(generatedCode);
    return generatedCode;
  }

  private async ensureUniqueRouteCode(code: string) {
    const existing = await this.prisma.route.findUnique({
      where: { code: normalizeCode(code) }
    });
    if (existing) {
      throw new ConflictException("Route code already exists");
    }
  }
}
