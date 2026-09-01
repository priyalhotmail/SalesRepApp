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
import { UpdateCompanyDto } from "./dto/company.dto";
import { CreateFactoryDto, UpdateFactoryDto } from "./dto/factory.dto";
import { CreateOfficeDto, UpdateOfficeDto } from "./dto/office.dto";
import { StructureQueryDto } from "./dto/structure-query.dto";
import { CreateWarehouseDto, UpdateWarehouseDto } from "./dto/warehouse.dto";

@Injectable()
export class CompanyStructureService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async getCurrentCompany() {
    const company = await this.prisma.company.findFirst({
      orderBy: {
        id: "asc"
      },
      where: {
        status: {
          not: "DELETED"
        }
      }
    });

    if (!company) {
      throw new NotFoundException("Company not found");
    }

    return company;
  }

  async updateCurrentCompany(dto: UpdateCompanyDto, context: RequestContext) {
    const company = await this.getCurrentCompany();
    const updatedCompany = await this.prisma.company.update({
      data: {
        address: dto.address,
        email: dto.email,
        name: dto.name?.trim(),
        registrationNumber: dto.registrationNumber,
        telephone: dto.telephone,
        updatedById: context.actor.id,
        vatRegistrationNumber: dto.vatRegistrationNumber
      },
      where: {
        id: company.id
      }
    });

    await this.auditService.record({
      action: "COMPANY_UPDATED",
      actorUserId: context.actor.id,
      entityId: company.id,
      entityType: "company",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: toAuditJson(company),
      userAgent: context.userAgent
    });

    return updatedCompany;
  }

  async listOffices(query: StructureQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.OfficeWhereInput = {
      ...this.getRecordWhere(query),
      officeType: query.officeType
    };

    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
        { contactPerson: { contains: query.search } }
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.office.findMany({
        include: { company: true },
        orderBy: { name: "asc" },
        skip,
        take,
        where
      }),
      this.prisma.office.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async createOffice(dto: CreateOfficeDto, context: RequestContext) {
    const companyId = await this.resolveCompanyId(dto.companyId);
    const code = await this.resolveUniqueCode("office", "OFF", dto.code);

    const office = await this.prisma.office.create({
      data: {
        address: dto.address,
        code,
        companyId,
        contactPerson: dto.contactPerson,
        createdById: context.actor.id,
        email: dto.email,
        name: dto.name.trim(),
        officeType: dto.officeType,
        telephone: dto.telephone
      }
    });

    await this.auditService.record({
      action: "OFFICE_CREATED",
      actorUserId: context.actor.id,
      entityId: office.id,
      entityType: "office",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(office),
      userAgent: context.userAgent
    });

    return office;
  }

  async updateOffice(id: number, dto: UpdateOfficeDto, context: RequestContext) {
    const office = await this.findActiveOffice(id);
    const updatedOffice = await this.prisma.office.update({
      data: {
        address: dto.address,
        contactPerson: dto.contactPerson,
        email: dto.email,
        name: dto.name?.trim(),
        officeType: dto.officeType,
        status: dto.status,
        telephone: dto.telephone,
        updatedById: context.actor.id
      },
      where: { id }
    });

    await this.auditService.record({
      action: "OFFICE_UPDATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "office",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: toAuditJson(office),
      userAgent: context.userAgent
    });

    return updatedOffice;
  }

  async deleteOffice(id: number, context: RequestContext) {
    const office = await this.findActiveOffice(id);
    const dependentCount =
      (await this.prisma.warehouse.count({ where: { officeId: id, status: { not: "DELETED" } } })) +
      (await this.prisma.salesRep.count({ where: { officeId: id, status: { not: "DELETED" } } })) +
      (await this.prisma.customer.count({ where: { officeId: id, status: { not: "DELETED" } } }));

    if (dependentCount > 0) {
      throw new BadRequestException("Office has active warehouses, sales reps, or customers");
    }

    const deletedOffice = await this.prisma.office.update({
      data: {
        deletedAt: new Date(),
        deletedById: context.actor.id,
        status: "DELETED",
        updatedById: context.actor.id
      },
      where: { id }
    });

    await this.auditService.record({
      action: "OFFICE_SOFT_DELETED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "office",
      ipAddress: context.ipAddress,
      oldValues: toAuditJson(office),
      userAgent: context.userAgent
    });

    return deletedOffice;
  }

  async listFactories(query: StructureQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.FactoryWhereInput = this.getRecordWhere(query);

    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
        { contactPerson: { contains: query.search } }
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.factory.findMany({
        include: { company: true },
        orderBy: { name: "asc" },
        skip,
        take,
        where
      }),
      this.prisma.factory.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async createFactory(dto: CreateFactoryDto, context: RequestContext) {
    const companyId = await this.resolveCompanyId(dto.companyId);
    const code = await this.resolveUniqueCode("factory", "FAC", dto.code);

    const factory = await this.prisma.factory.create({
      data: {
        address: dto.address,
        code,
        companyId,
        contactPerson: dto.contactPerson,
        createdById: context.actor.id,
        email: dto.email,
        name: dto.name.trim(),
        telephone: dto.telephone
      }
    });

    await this.auditService.record({
      action: "FACTORY_CREATED",
      actorUserId: context.actor.id,
      entityId: factory.id,
      entityType: "factory",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(factory),
      userAgent: context.userAgent
    });

    return factory;
  }

  async updateFactory(id: number, dto: UpdateFactoryDto, context: RequestContext) {
    const factory = await this.findActiveFactory(id);
    const updatedFactory = await this.prisma.factory.update({
      data: {
        address: dto.address,
        contactPerson: dto.contactPerson,
        email: dto.email,
        name: dto.name?.trim(),
        status: dto.status,
        telephone: dto.telephone,
        updatedById: context.actor.id
      },
      where: { id }
    });

    await this.auditService.record({
      action: "FACTORY_UPDATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "factory",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: toAuditJson(factory),
      userAgent: context.userAgent
    });

    return updatedFactory;
  }

  async deleteFactory(id: number, context: RequestContext) {
    const factory = await this.findActiveFactory(id);
    const activeWarehouses = await this.prisma.warehouse.count({
      where: { factoryId: id, status: { not: "DELETED" } }
    });

    if (activeWarehouses > 0) {
      throw new BadRequestException("Factory has active warehouses");
    }

    const deletedFactory = await this.prisma.factory.update({
      data: {
        deletedAt: new Date(),
        deletedById: context.actor.id,
        status: "DELETED",
        updatedById: context.actor.id
      },
      where: { id }
    });

    await this.auditService.record({
      action: "FACTORY_SOFT_DELETED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "factory",
      ipAddress: context.ipAddress,
      oldValues: toAuditJson(factory),
      userAgent: context.userAgent
    });

    return deletedFactory;
  }

  async listWarehouses(query: StructureQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.WarehouseWhereInput = this.getRecordWhere(query);

    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
        { contactPerson: { contains: query.search } }
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.warehouse.findMany({
        include: { company: true, factory: true, office: true },
        orderBy: { name: "asc" },
        skip,
        take,
        where
      }),
      this.prisma.warehouse.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async createWarehouse(dto: CreateWarehouseDto, context: RequestContext) {
    const companyId = await this.resolveCompanyId(dto.companyId);
    const code = await this.resolveUniqueCode("warehouse", "WH", dto.code);
    await this.ensureWarehouseOwner({ ...dto, companyId });

    const warehouse = await this.prisma.warehouse.create({
      data: {
        address: dto.address,
        code,
        companyId,
        contactPerson: dto.contactPerson,
        createdById: context.actor.id,
        email: dto.email,
        factoryId: dto.factoryId,
        name: dto.name.trim(),
        officeId: dto.officeId,
        telephone: dto.telephone,
        warehouseType: dto.warehouseType
      }
    });

    await this.auditService.record({
      action: "WAREHOUSE_CREATED",
      actorUserId: context.actor.id,
      entityId: warehouse.id,
      entityType: "warehouse",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(warehouse),
      userAgent: context.userAgent
    });

    return warehouse;
  }

  async updateWarehouse(
    id: number,
    dto: UpdateWarehouseDto,
    context: RequestContext
  ) {
    const warehouse = await this.findActiveWarehouse(id);
    const nextWarehouse = {
      companyId: warehouse.companyId,
      factoryId: dto.factoryId ?? warehouse.factoryId ?? undefined,
      officeId: dto.officeId ?? warehouse.officeId ?? undefined,
      warehouseType: dto.warehouseType ?? warehouse.warehouseType
    };
    await this.ensureWarehouseOwner(nextWarehouse);

    const updatedWarehouse = await this.prisma.warehouse.update({
      data: {
        address: dto.address,
        contactPerson: dto.contactPerson,
        email: dto.email,
        factoryId: dto.factoryId,
        name: dto.name?.trim(),
        officeId: dto.officeId,
        status: dto.status,
        telephone: dto.telephone,
        updatedById: context.actor.id,
        warehouseType: dto.warehouseType
      },
      where: { id }
    });

    await this.auditService.record({
      action: "WAREHOUSE_UPDATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "warehouse",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: toAuditJson(warehouse),
      userAgent: context.userAgent
    });

    return updatedWarehouse;
  }

  async deleteWarehouse(id: number, context: RequestContext) {
    const warehouse = await this.findActiveWarehouse(id);
    const deletedWarehouse = await this.prisma.warehouse.update({
      data: {
        deletedAt: new Date(),
        deletedById: context.actor.id,
        status: "DELETED",
        updatedById: context.actor.id
      },
      where: { id }
    });

    await this.auditService.record({
      action: "WAREHOUSE_SOFT_DELETED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "warehouse",
      ipAddress: context.ipAddress,
      oldValues: toAuditJson(warehouse),
      userAgent: context.userAgent
    });

    return deletedWarehouse;
  }

  private getRecordWhere(query: StructureQueryDto) {
    return {
      status: query.status ?? { not: "DELETED" as const }
    };
  }

  private async resolveCompanyId(companyId?: number) {
    if (companyId) {
      await this.ensureCompany(companyId);
      return companyId;
    }

    return (await this.getCurrentCompany()).id;
  }

  private async resolveUniqueCode(
    entity: "office" | "factory" | "warehouse",
    prefix: string,
    code?: string
  ) {
    if (code) {
      await this.ensureUniqueCode(entity, code);
      return normalizeCode(code);
    }

    const lastCode = await this.findLastCode(entity, prefix);
    const generatedCode = nextSequentialCode(prefix, lastCode);
    await this.ensureUniqueCode(entity, generatedCode);
    return generatedCode;
  }

  private async findLastCode(
    entity: "office" | "factory" | "warehouse",
    prefix: string
  ) {
    const where = { code: { startsWith: `${prefix}-` } };
    if (entity === "office") {
      return (
        await this.prisma.office.findFirst({
          orderBy: { code: "desc" },
          select: { code: true },
          where
        })
      )?.code;
    }
    if (entity === "factory") {
      return (
        await this.prisma.factory.findFirst({
          orderBy: { code: "desc" },
          select: { code: true },
          where
        })
      )?.code;
    }
    return (
      await this.prisma.warehouse.findFirst({
        orderBy: { code: "desc" },
        select: { code: true },
        where
      })
    )?.code;
  }

  private async ensureCompany(companyId: number) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, status: { not: "DELETED" } }
    });

    if (!company) {
      throw new BadRequestException("Company is invalid");
    }
  }

  private async ensureUniqueCode(
    entity: "office" | "factory" | "warehouse",
    code: string
  ) {
    const normalizedCode = normalizeCode(code);
    const exists =
      entity === "office"
        ? await this.prisma.office.findUnique({ where: { code: normalizedCode } })
        : entity === "factory"
          ? await this.prisma.factory.findUnique({ where: { code: normalizedCode } })
          : await this.prisma.warehouse.findUnique({
              where: { code: normalizedCode }
            });

    if (exists) {
      throw new ConflictException(`${entity} code already exists`);
    }
  }

  private async findActiveOffice(id: number) {
    const office = await this.prisma.office.findFirst({
      where: { id, status: { not: "DELETED" } }
    });
    if (!office) {
      throw new NotFoundException("Office not found");
    }
    return office;
  }

  private async findActiveFactory(id: number) {
    const factory = await this.prisma.factory.findFirst({
      where: { id, status: { not: "DELETED" } }
    });
    if (!factory) {
      throw new NotFoundException("Factory not found");
    }
    return factory;
  }

  private async findActiveWarehouse(id: number) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id, status: { not: "DELETED" } }
    });
    if (!warehouse) {
      throw new NotFoundException("Warehouse not found");
    }
    return warehouse;
  }

  private async ensureWarehouseOwner(input: {
    companyId: number;
    factoryId?: number | null;
    officeId?: number | null;
    warehouseType: string;
  }) {
    if (input.warehouseType === "FACTORY_FINAL_PRODUCT") {
      if (!input.factoryId || input.officeId) {
        throw new BadRequestException("Factory warehouse requires only factoryId");
      }
      const factory = await this.prisma.factory.findFirst({
        where: {
          companyId: input.companyId,
          id: input.factoryId,
          status: { not: "DELETED" }
        }
      });
      if (!factory) {
        throw new BadRequestException("Factory is invalid for this warehouse");
      }
      return;
    }

    if (!input.officeId || input.factoryId) {
      throw new BadRequestException("Main or branch warehouse requires only officeId");
    }

    const office = await this.prisma.office.findFirst({
      where: {
        companyId: input.companyId,
        id: input.officeId,
        status: { not: "DELETED" }
      }
    });

    if (!office) {
      throw new BadRequestException("Office is invalid for this warehouse");
    }
  }
}
