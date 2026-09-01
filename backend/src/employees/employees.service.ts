import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { RequestContext } from "../common/types/request-context.type";
import { toAuditJson } from "../common/utils/audit-json.util";
import { nextSequentialCode } from "../common/utils/code-generator.util";
import { getPagination, toPaginatedResult } from "../common/utils/pagination.util";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEmployeeDto, EmployeeQueryDto, UpdateEmployeeDto } from "./dto/employee.dto";

const employeeInclude = {
  branch: true,
  office: true,
  user: { select: { displayName: true, email: true, id: true } },
  warehouse: true
} satisfies Prisma.EmployeeInclude;

@Injectable()
export class EmployeesService {
  constructor(private readonly audit: AuditService, private readonly prisma: PrismaService) {}

  async list(query: EmployeeQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.EmployeeWhereInput = { status: query.status ?? { not: "DELETED" } };
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { designation: { contains: query.search } },
        { user: { displayName: { contains: query.search } } },
        { user: { email: { contains: query.search } } }
      ];
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({ include: employeeInclude, orderBy: { code: "asc" }, skip, take, where }),
      this.prisma.employee.count({ where })
    ]);
    return toPaginatedResult(data, total, page, limit);
  }

  async listAvailableUsers(query: EmployeeQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.UserWhereInput = {
      OR: [
        { employee: { is: null } },
        { employee: { is: { status: "DELETED" } } }
      ],
      status: "ACTIVE"
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        orderBy: { displayName: "asc" },
        select: { displayName: true, email: true, id: true },
        skip,
        take,
        where
      }),
      this.prisma.user.count({ where })
    ]);
    return toPaginatedResult(data, total, page, limit);
  }

  async findById(id: number) {
    return this.findActive(id);
  }

  async create(dto: CreateEmployeeDto, context: RequestContext) {
    const deletedEmployee = await this.prisma.employee.findFirst({
      where: { status: "DELETED", userId: dto.userId }
    });
    if (deletedEmployee) {
      await this.prisma.employee.delete({ where: { id: deletedEmployee.id } });
    }
    await this.validateReferences(dto);
    const code = await this.nextCode();
    const employee = await this.prisma.employee.create({
      data: { ...dto, code, createdById: context.actor.id },
      include: employeeInclude
    });
    await this.record("EMPLOYEE_CREATED", employee.id, employee, context);
    return employee;
  }

  async update(id: number, dto: UpdateEmployeeDto, context: RequestContext) {
    const existing = await this.findActive(id);
    await this.validateReferences({
      branchId: dto.branchId ?? existing.branchId ?? undefined,
      officeId: dto.officeId ?? existing.officeId,
      userId: existing.userId,
      warehouseId: dto.warehouseId ?? existing.warehouseId
    }, id);
    const employee = await this.prisma.employee.update({
      data: { ...dto, updatedById: context.actor.id },
      include: employeeInclude,
      where: { id }
    });
    await this.record("EMPLOYEE_UPDATED", id, employee, context, existing);
    return employee;
  }

  async softDelete(id: number, context: RequestContext) {
    const existing = await this.findActive(id);
    await this.prisma.employee.delete({ where: { id } });
    await this.record("EMPLOYEE_DELETED", id, existing, context, existing);
    return { id };
  }

  private async validateReferences(dto: Pick<CreateEmployeeDto, "branchId" | "officeId" | "userId" | "warehouseId">, employeeId?: number) {
    const [user, office, branch, warehouse, existing] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: dto.userId, status: "ACTIVE" } }),
      this.prisma.office.findFirst({ where: { id: dto.officeId, status: { not: "DELETED" } } }),
      dto.branchId
        ? this.prisma.office.findFirst({ where: { id: dto.branchId, officeType: "BRANCH", status: { not: "DELETED" } } })
        : Promise.resolve(null),
      this.prisma.warehouse.findFirst({ where: { id: dto.warehouseId, status: { not: "DELETED" } } }),
      this.prisma.employee.findUnique({ where: { userId: dto.userId } })
    ]);
    if (!user || !office || !warehouse) throw new BadRequestException("User account, office, or warehouse is invalid");
    if (office.officeType === "MAIN") {
      if (dto.branchId) throw new BadRequestException("Main office employees cannot be assigned to a branch");
      if (warehouse.officeId !== office.id) throw new BadRequestException("Warehouse must belong to the selected main office");
    } else {
      if (!branch) throw new BadRequestException("A branch is required for employees assigned to a branch office");
      if (warehouse.officeId !== branch.id) throw new BadRequestException("Warehouse must belong to the selected branch");
    }
    if (existing && existing.id !== employeeId) throw new ConflictException("User account is already linked to an employee");
  }

  private async findActive(id: number) {
    const employee = await this.prisma.employee.findFirst({ include: employeeInclude, where: { id, status: { not: "DELETED" } } });
    if (!employee) throw new NotFoundException("Employee not found");
    return employee;
  }

  private async nextCode() {
    const last = await this.prisma.employee.findFirst({ orderBy: { code: "desc" }, select: { code: true }, where: { code: { startsWith: "EMP-" } } });
    return nextSequentialCode("EMP", last?.code);
  }

  private record(action: string, id: number, value: unknown, context: RequestContext, oldValue?: unknown) {
    return this.audit.record({
      action,
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "employee",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(value),
      oldValues: oldValue === undefined ? undefined : toAuditJson(oldValue),
      userAgent: context.userAgent
    });
  }
}
