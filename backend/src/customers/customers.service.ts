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
import { isSalesRepScopedActor } from "../common/utils/user-scope.util";
import { getPagination, toPaginatedResult } from "../common/utils/pagination.util";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateCustomerChangeRequestDto,
  CustomerChangeRequestQueryDto,
  ReviewCustomerChangeRequestDto
} from "./dto/customer-change-request.dto";
import {
  CustomerQueryDto,
  NearbyCustomerQueryDto
} from "./dto/customer-query.dto";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";

const allowedChangeFields = new Set([
  "officeId",
  "salesRepId",
  "routeId",
  "displayName",
  "registrationNumber",
  "vatRegistrationNumber",
  "nic",
  "address",
  "telephone",
  "contactPerson",
  "email",
  "latitude",
  "longitude",
  "geoAccuracyMeters",
  "status"
]);

@Injectable()
export class CustomersService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async list(query: CustomerQueryDto, actor?: RequestContext["actor"]) {
    const { limit, page, skip, take } = getPagination(query);
    const salesRepContext = actor && isSalesRepScopedActor(actor)
      ? await this.getSalesRepContext(actor.id)
      : undefined;
    const where: Prisma.CustomerWhereInput = {
      customerType: query.customerType,
      officeId: salesRepContext?.officeId ?? query.officeId,
      salesRepId: salesRepContext?.id ?? query.salesRepId,
      status: query.status ?? { not: "DELETED" }
    };

    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { displayName: { contains: query.search } },
        { registrationNumber: { contains: query.search } },
        { nic: { contains: query.search } },
        { email: { contains: query.search } },
        { telephone: { contains: query.search } }
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        include: {
          office: true,
          routeAssignments: {
            include: { route: true },
            where: { isPrimary: true, status: "ACTIVE" }
          },
          salesRep: true
        },
        orderBy: { displayName: "asc" },
        skip,
        take,
        where
      }),
      this.prisma.customer.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async create(dto: CreateCustomerDto, context: RequestContext) {
    const salesRepContext = isSalesRepScopedActor(context.actor)
      ? await this.getSalesRepContext(context.actor.id)
      : undefined;
    const officeId = salesRepContext?.officeId ?? dto.officeId;
    const salesRepId = salesRepContext?.id ?? dto.salesRepId;
    await this.validateCustomerShape(dto.customerType, dto);
    await this.ensureOffice(officeId);
    await this.ensureSalesRep(salesRepId, officeId);
    if (dto.routeId) {
      await this.ensureRouteAllowed(dto.routeId, officeId);
    } else if (salesRepContext) {
      throw new BadRequestException("Route is required");
    }
    const code = await this.resolveUniqueCode(dto.code);
    this.validateGeoPair(dto.latitude, dto.longitude);

    const customer = await this.prisma.$transaction(async (tx) => {
      const createdCustomer = await tx.customer.create({
        data: {
          address: dto.address,
          code,
          contactPerson: dto.contactPerson,
          createdById: context.actor.id,
          customerType: dto.customerType,
          displayName: dto.displayName.trim(),
          email: dto.email,
          geoAccuracyMeters: dto.geoAccuracyMeters,
          geoCapturedAt:
            dto.latitude !== undefined && dto.longitude !== undefined
              ? new Date()
              : undefined,
          latitude: dto.latitude,
          longitude: dto.longitude,
          nic: dto.nic,
          officeId,
          registrationNumber: dto.registrationNumber,
          salesRepId,
          telephone: dto.telephone,
          vatRegistrationNumber: dto.vatRegistrationNumber
        }
      });

      if (dto.routeId) {
        await this.setPrimaryRouteInTransaction(
          tx,
          createdCustomer.id,
          dto.routeId,
          context.actor.id
        );
      }

      return createdCustomer;
    });

    await this.prisma.customerChangeHistory.create({
      data: {
        changedById: context.actor.id,
        customerId: customer.id,
        newValues: toAuditJson(customer)
      }
    });

    await this.auditService.record({
      action: "CUSTOMER_CREATED",
      actorUserId: context.actor.id,
      entityId: customer.id,
      entityType: "customer",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(customer),
      userAgent: context.userAgent
    });

    return customer;
  }

  async getNewCustomerContext(actor: RequestContext["actor"]) {
    if (!isSalesRepScopedActor(actor)) {
      return { salesRep: null };
    }

    const salesRep = await this.prisma.salesRep.findFirst({
      include: {
        office: true,
        user: { select: { displayName: true } }
      },
      where: {
        status: "ACTIVE",
        userId: actor.id
      }
    });

    if (!salesRep) {
      throw new BadRequestException("Authenticated user is not linked to an active sales rep");
    }

    return {
      salesRep: {
        id: salesRep.id,
        name: salesRep.user?.displayName ?? salesRep.name,
        office: {
          id: salesRep.office.id,
          name: salesRep.office.name
        },
        officeId: salesRep.officeId
      }
    };
  }

  async findById(id: number, actor?: RequestContext["actor"]) {
    const customer = await this.prisma.customer.findFirst({
      include: {
        office: true,
        routeAssignments: {
          include: { route: true },
          where: { isPrimary: true, status: "ACTIVE" }
        },
        salesRep: true
      },
      where: { id }
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
    if (actor && isSalesRepScopedActor(actor)) {
      const salesRepContext = await this.getSalesRepContext(actor.id);
      if (customer.salesRepId !== salesRepContext.id) {
        throw new NotFoundException("Customer not found");
      }
    }

    return customer;
  }

  async update(id: number, dto: UpdateCustomerDto, context: RequestContext) {
    const customer = await this.findActiveCustomer(id);
    const salesRepContext = isSalesRepScopedActor(context.actor)
      ? await this.getSalesRepContext(context.actor.id)
      : undefined;
    if (salesRepContext && customer.salesRepId !== salesRepContext.id) {
      throw new NotFoundException("Customer not found");
    }
    const merged = { ...customer, ...dto };
    await this.validateCustomerShape(customer.customerType, merged);
    const officeId = salesRepContext?.officeId ?? dto.officeId ?? customer.officeId;
    const salesRepId = salesRepContext?.id ?? dto.salesRepId ?? customer.salesRepId ?? undefined;
    await this.ensureOffice(dto.officeId);
    await this.ensureSalesRep(salesRepId, officeId);
    if (dto.routeId) {
      await this.ensureRouteAllowed(dto.routeId, officeId);
    }
    this.validateGeoPair(
      dto.latitude ?? Number(customer.latitude ?? undefined),
      dto.longitude ?? Number(customer.longitude ?? undefined)
    );

    const updatedCustomer = await this.prisma.$transaction(async (tx) => {
      const changedCustomer = await tx.customer.update({
        data: this.toCustomerUpdateData({
          ...dto,
          officeId: salesRepContext ? salesRepContext.officeId : dto.officeId,
          salesRepId: salesRepContext ? salesRepContext.id : dto.salesRepId
        }, context.actor.id),
        where: { id }
      });
      if (dto.routeId) {
        await this.setPrimaryRouteInTransaction(
          tx,
          id,
          dto.routeId,
          context.actor.id
        );
      }
      return changedCustomer;
    });

    await this.prisma.customerChangeHistory.create({
      data: {
        changedById: context.actor.id,
        customerId: id,
        newValues: toAuditJson(updatedCustomer),
        oldValues: toAuditJson(customer)
      }
    });

    await this.auditService.record({
      action: "CUSTOMER_UPDATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "customer",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: toAuditJson(customer),
      userAgent: context.userAgent
    });

    if (dto.routeId) {
      await this.auditService.record({
        action: "CUSTOMER_PRIMARY_ROUTE_UPDATED",
        actorUserId: context.actor.id,
        entityId: id,
        entityType: "customer",
        ipAddress: context.ipAddress,
        newValues: toAuditJson({ routeId: dto.routeId }),
        userAgent: context.userAgent
      });
    }

    return updatedCustomer;
  }

  async softDelete(id: number, context: RequestContext) {
    const customer = await this.findActiveCustomer(id);
    const deletedCustomer = await this.prisma.customer.update({
      data: {
        deletedAt: new Date(),
        deletedById: context.actor.id,
        status: "DELETED",
        updatedById: context.actor.id
      },
      where: { id }
    });

    await this.prisma.customerChangeHistory.create({
      data: {
        changedById: context.actor.id,
        customerId: id,
        newValues: toAuditJson(deletedCustomer),
        oldValues: toAuditJson(customer)
      }
    });

    await this.auditService.record({
      action: "CUSTOMER_SOFT_DELETED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "customer",
      ipAddress: context.ipAddress,
      oldValues: toAuditJson(customer),
      userAgent: context.userAgent
    });

    return deletedCustomer;
  }

  async requestChange(
    customerId: number,
    dto: CreateCustomerChangeRequestDto,
    context: RequestContext
  ) {
    const customer = await this.findActiveCustomer(customerId);
    const requestedChanges = this.pickAllowedCustomerChanges(dto.requestedChanges);
    if (Object.keys(requestedChanges).length === 0) {
      throw new BadRequestException("No valid customer changes were provided");
    }

    const merged = { ...customer, ...requestedChanges };
    await this.validateCustomerShape(customer.customerType, merged);
    await this.ensureOffice(Number(requestedChanges.officeId ?? customer.officeId));
    await this.ensureSalesRep(
      requestedChanges.salesRepId === undefined
        ? customer.salesRepId ?? undefined
        : Number(requestedChanges.salesRepId),
      Number(requestedChanges.officeId ?? customer.officeId)
    );

    const changeRequest = await this.prisma.customerChangeRequest.create({
      data: {
        customerId,
        reason: dto.reason,
        requestedById: context.actor.id,
        requestedChanges: toAuditJson(requestedChanges)
      }
    });

    await this.auditService.record({
      action: "CUSTOMER_CHANGE_REQUESTED",
      actorUserId: context.actor.id,
      entityId: changeRequest.id,
      entityType: "customer_change_request",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(changeRequest),
      userAgent: context.userAgent
    });

    return changeRequest;
  }

  async listChangeRequests(query: CustomerChangeRequestQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.CustomerChangeRequestWhereInput = {
      customerId: query.customerId,
      status: query.status
    };

    if (query.search) {
      where.customer = {
        OR: [
          { code: { contains: query.search } },
          { displayName: { contains: query.search } }
        ]
      };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.customerChangeRequest.findMany({
        include: {
          customer: true,
          requestedBy: {
            select: {
              displayName: true,
              email: true,
              id: true
            }
          },
          reviewedBy: {
            select: {
              displayName: true,
              email: true,
              id: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
        where
      }),
      this.prisma.customerChangeRequest.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async approveChangeRequest(
    id: number,
    dto: ReviewCustomerChangeRequestDto,
    context: RequestContext
  ) {
    const request = await this.findPendingChangeRequest(id);
    const customer = await this.findActiveCustomer(request.customerId);
    const requestedChanges = request.requestedChanges as Record<string, unknown>;

    const updatedCustomer = await this.prisma.$transaction(async (tx) => {
      const changedCustomer = await tx.customer.update({
      data: this.toCustomerUpdateData(requestedChanges, context.actor.id),
        where: { id: customer.id }
      });

      await tx.customerChangeRequest.update({
        data: {
          reviewedAt: new Date(),
          reviewedById: context.actor.id,
          reviewNote: dto.reviewNote,
          status: "APPROVED"
        },
        where: { id }
      });

      await tx.customerChangeHistory.create({
        data: {
          changedById: context.actor.id,
          changeRequestId: id,
          customerId: customer.id,
          newValues: toAuditJson(changedCustomer),
          oldValues: toAuditJson(customer)
        }
      });

      return changedCustomer;
    });

    await this.auditService.record({
      action: "CUSTOMER_CHANGE_APPROVED",
      actorUserId: context.actor.id,
      approvalReference: String(id),
      entityId: customer.id,
      entityType: "customer",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(requestedChanges),
      oldValues: toAuditJson(customer),
      userAgent: context.userAgent
    });

    return updatedCustomer;
  }

  async rejectChangeRequest(
    id: number,
    dto: ReviewCustomerChangeRequestDto,
    context: RequestContext
  ) {
    const request = await this.findPendingChangeRequest(id);
    const rejectedRequest = await this.prisma.customerChangeRequest.update({
      data: {
        reviewedAt: new Date(),
        reviewedById: context.actor.id,
        reviewNote: dto.reviewNote,
        status: "REJECTED"
      },
      where: { id }
    });

    await this.auditService.record({
      action: "CUSTOMER_CHANGE_REJECTED",
      actorUserId: context.actor.id,
      approvalReference: String(id),
      entityId: request.customerId,
      entityType: "customer",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(rejectedRequest),
      userAgent: context.userAgent
    });

    return rejectedRequest;
  }

  async getHistory(customerId: number) {
    await this.findById(customerId);
    return this.prisma.customerChangeHistory.findMany({
      orderBy: { changedAt: "desc" },
      where: { customerId }
    });
  }

  async findNearby(query: NearbyCustomerQueryDto) {
    const customers = await this.prisma.customer.findMany({
      include: {
        office: true,
        salesRep: true
      },
      where: {
        latitude: { not: null },
        longitude: { not: null },
        status: { not: "DELETED" }
      }
    });

    return customers
      .map((customer) => ({
        ...customer,
        distanceKm: this.calculateDistanceKm(
          query.latitude,
          query.longitude,
          Number(customer.latitude),
          Number(customer.longitude)
        )
      }))
      .filter((customer) => customer.distanceKm <= query.radiusKm)
      .sort((left, right) => left.distanceKm - right.distanceKm)
      .slice(0, query.limit);
  }

  private async ensureOffice(officeId?: number) {
    if (!officeId) {
      return;
    }

    const office = await this.prisma.office.findFirst({
      where: { id: officeId, status: { not: "DELETED" } }
    });

    if (!office) {
      throw new BadRequestException("Office is invalid");
    }
  }

  private async ensureSalesRep(salesRepId?: number, officeId?: number) {
    if (!salesRepId) {
      return;
    }

    const salesRep = await this.prisma.salesRep.findFirst({
      where: { id: salesRepId, status: { not: "DELETED" } }
    });

    if (!salesRep) {
      throw new BadRequestException("Sales rep is invalid");
    }

    if (officeId && salesRep.officeId !== officeId) {
      throw new BadRequestException("Sales rep must belong to the customer office");
    }
  }

  private async ensureRouteAllowed(routeId: number, officeId: number) {
    const route = await this.prisma.route.findFirst({
      where: { id: routeId, officeId, status: { not: "DELETED" } }
    });

    if (!route) {
      throw new BadRequestException("Route is invalid for the selected office");
    }
  }

  private async setPrimaryRouteInTransaction(
    tx: Prisma.TransactionClient,
    customerId: number,
    routeId: number,
    actorUserId: number
  ) {
    await tx.routeCustomer.updateMany({
      data: { isPrimary: false },
      where: { customerId, isPrimary: true, status: "ACTIVE" }
    });

    await tx.routeCustomer.upsert({
      create: {
        assignedById: actorUserId,
        customerId,
        isPrimary: true,
        routeId
      },
      update: {
        assignedById: actorUserId,
        assignedAt: new Date(),
        isPrimary: true,
        status: "ACTIVE"
      },
      where: { routeId_customerId: { customerId, routeId } }
    });
  }

  private async getSalesRepContext(userId: number) {
    const salesRep = await this.prisma.salesRep.findFirst({
      where: {
        status: "ACTIVE",
        userId
      }
    });

    if (!salesRep) {
      throw new BadRequestException("Authenticated user is not linked to an active sales rep");
    }

    return salesRep;
  }

  private async resolveUniqueCode(code?: string) {
    if (code) {
      await this.ensureUniqueCode(code);
      return normalizeCode(code);
    }

    const lastCode = await this.prisma.customer.findFirst({
      orderBy: { code: "desc" },
      select: { code: true },
      where: { code: { startsWith: "CUS-" } }
    });
    const generatedCode = nextSequentialCode("CUS", lastCode?.code);
    await this.ensureUniqueCode(generatedCode);
    return generatedCode;
  }

  private async ensureUniqueCode(code: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { code: normalizeCode(code) }
    });

    if (customer) {
      throw new ConflictException("Customer code already exists");
    }
  }

  private async findActiveCustomer(id: number) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, status: { not: "DELETED" } }
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    return customer;
  }

  private async findPendingChangeRequest(id: number) {
    const request = await this.prisma.customerChangeRequest.findFirst({
      where: { id, status: "PENDING" }
    });

    if (!request) {
      throw new NotFoundException("Pending customer change request not found");
    }

    return request;
  }

  private validateCustomerShape(
    customerType: string,
    value: {
      displayName?: string | null;
      nic?: string | null;
      registrationNumber?: string | null;
    }
  ) {
    if (!value.displayName || value.displayName.trim().length < 2) {
      throw new BadRequestException("Customer name is required");
    }

    if (customerType === "BUSINESS" && !value.registrationNumber) {
      throw new BadRequestException("Business customer registration number is required");
    }

    if (customerType === "INDIVIDUAL" && !value.nic) {
      throw new BadRequestException("Individual customer NIC is required");
    }
  }

  private pickAllowedCustomerChanges(input: Record<string, unknown>) {
    const changes: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      if (allowedChangeFields.has(key)) {
        changes[key] = value;
      }
    }

    return changes;
  }

  private toCustomerUpdateData(
    input: Record<string, unknown>,
    actorUserId: number
  ): Prisma.CustomerUpdateInput {
    return {
      address: input.address as string | undefined,
      contactPerson: input.contactPerson as string | undefined,
      displayName:
        typeof input.displayName === "string"
          ? input.displayName.trim()
          : undefined,
      email: input.email as string | undefined,
      geoAccuracyMeters:
        input.geoAccuracyMeters === undefined
          ? undefined
          : Number(input.geoAccuracyMeters),
      geoCapturedAt:
        input.latitude === undefined && input.longitude === undefined
          ? undefined
          : new Date(),
      latitude:
        input.latitude === undefined ? undefined : Number(input.latitude),
      longitude:
        input.longitude === undefined ? undefined : Number(input.longitude),
      nic: input.nic as string | undefined,
      office:
        input.officeId === undefined
          ? undefined
          : { connect: { id: Number(input.officeId) } },
      registrationNumber: input.registrationNumber as string | undefined,
      salesRep:
        input.salesRepId === undefined
          ? undefined
          : { connect: { id: Number(input.salesRepId) } },
      status: input.status as Prisma.EnumRecordStatusFieldUpdateOperationsInput["set"],
      telephone: input.telephone as string | undefined,
      updatedById: actorUserId,
      vatRegistrationNumber: input.vatRegistrationNumber as string | undefined
    };
  }

  private validateGeoPair(latitude?: number, longitude?: number) {
    if (
      (latitude === undefined || Number.isNaN(latitude)) &&
      (longitude === undefined || Number.isNaN(longitude))
    ) {
      return;
    }

    if (
      latitude === undefined ||
      Number.isNaN(latitude) ||
      longitude === undefined ||
      Number.isNaN(longitude)
    ) {
      throw new BadRequestException(
        "Latitude and longitude must be provided together"
      );
    }
  }

  private calculateDistanceKm(
    fromLatitude: number,
    fromLongitude: number,
    toLatitude: number,
    toLongitude: number
  ) {
    const earthRadiusKm = 6371;
    const latitudeDelta = this.toRadians(toLatitude - fromLatitude);
    const longitudeDelta = this.toRadians(toLongitude - fromLongitude);
    const fromLatitudeRad = this.toRadians(fromLatitude);
    const toLatitudeRad = this.toRadians(toLatitude);
    const haversine =
      Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
      Math.cos(fromLatitudeRad) *
        Math.cos(toLatitudeRad) *
        Math.sin(longitudeDelta / 2) *
        Math.sin(longitudeDelta / 2);
    return Number(
      (earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))).toFixed(3)
    );
  }

  private toRadians(value: number) {
    return (value * Math.PI) / 180;
  }
}
