import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { toAuditJson } from "../common/utils/audit-json.util";
import { getPagination, toPaginatedResult } from "../common/utils/pagination.util";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { RoleQueryDto } from "./dto/role-query.dto";
import { UpdateRolePermissionsDto } from "./dto/update-role-permissions.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";

const roleInclude = {
  permissions: {
    include: {
      permission: true
    }
  }
} satisfies Prisma.RoleInclude;

type RequestContext = {
  actor: AuthenticatedUser;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class RolesPermissionsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async listRoles(query: RoleQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.RoleWhereInput = {
      status: query.status ?? {
        not: "DELETED"
      }
    };

    if (query.search) {
      where.OR = [
        {
          code: {
            contains: query.search
          }
        },
        {
          name: {
            contains: query.search
          }
        }
      ];
    }

    const [roles, total] = await this.prisma.$transaction([
      this.prisma.role.findMany({
        include: roleInclude,
        orderBy: {
          name: "asc"
        },
        skip,
        take,
        where
      }),
      this.prisma.role.count({ where })
    ]);

    return toPaginatedResult(roles.map(this.toRoleResponse), total, page, limit);
  }

  async createRole(dto: CreateRoleDto, context: RequestContext) {
    const code = dto.code.trim().toUpperCase();
    const existingRole = await this.prisma.role.findUnique({
      where: {
        code
      }
    });

    if (existingRole) {
      throw new ConflictException("A role with this code already exists");
    }

    await this.ensurePermissionsExist(dto.permissionIds ?? []);

    const role = await this.prisma.$transaction(async (tx) => {
      const createdRole = await tx.role.create({
        data: {
          code,
          createdById: context.actor.id,
          description: dto.description,
          isSystem: false,
          name: dto.name.trim()
        }
      });

      if (dto.permissionIds?.length) {
        await tx.rolePermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({
            assignedById: context.actor.id,
            permissionId,
            roleId: createdRole.id
          })),
          skipDuplicates: true
        });
      }

      return tx.role.findUniqueOrThrow({
        include: roleInclude,
        where: {
          id: createdRole.id
        }
      });
    });

    await this.auditService.record({
      action: "ROLE_CREATED",
      actorUserId: context.actor.id,
      entityId: role.id,
      entityType: "role",
      ipAddress: context.ipAddress,
      newValues: {
        code: role.code,
        permissionIds: dto.permissionIds ?? []
      },
      userAgent: context.userAgent
    });

    return this.toRoleResponse(role);
  }

  async getRole(id: number) {
    const role = await this.prisma.role.findFirst({
      include: roleInclude,
      where: {
        id
      }
    });

    if (!role) {
      throw new NotFoundException("Role not found");
    }

    return this.toRoleResponse(role);
  }

  async updateRole(id: number, dto: UpdateRoleDto, context: RequestContext) {
    const existingRole = await this.prisma.role.findFirst({
      where: {
        id,
        status: {
          not: "DELETED"
        }
      }
    });

    if (!existingRole) {
      throw new NotFoundException("Role not found");
    }

    const updatedRole = await this.prisma.role.update({
      data: {
        description: dto.description,
        name: dto.name?.trim(),
        status: dto.status,
        updatedById: context.actor.id
      },
      include: roleInclude,
      where: {
        id
      }
    });

    await this.auditService.record({
      action: "ROLE_UPDATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "role",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: {
        description: existingRole.description,
        name: existingRole.name,
        status: existingRole.status
      },
      userAgent: context.userAgent
    });

    return this.toRoleResponse(updatedRole);
  }

  async softDeleteRole(id: number, context: RequestContext) {
    const existingRole = await this.prisma.role.findFirst({
      where: {
        id,
        status: {
          not: "DELETED"
        }
      }
    });

    if (!existingRole) {
      throw new NotFoundException("Role not found");
    }

    if (existingRole.isSystem) {
      throw new BadRequestException("System roles cannot be deleted");
    }

    const assignedUsers = await this.prisma.userRole.count({
      where: {
        roleId: id
      }
    });

    if (assignedUsers > 0) {
      throw new BadRequestException("Cannot delete a role assigned to users");
    }

    const deletedRole = await this.prisma.role.update({
      data: {
        deletedAt: new Date(),
        deletedById: context.actor.id,
        status: "DELETED",
        updatedById: context.actor.id
      },
      include: roleInclude,
      where: {
        id
      }
    });

    await this.auditService.record({
      action: "ROLE_SOFT_DELETED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "role",
      ipAddress: context.ipAddress,
      oldValues: {
        code: existingRole.code,
        status: existingRole.status
      },
      userAgent: context.userAgent
    });

    return this.toRoleResponse(deletedRole);
  }

  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [
        {
          module: "asc"
        },
        {
          code: "asc"
        }
      ]
    });
  }

  async updateRolePermissions(
    id: number,
    dto: UpdateRolePermissionsDto,
    context: RequestContext
  ) {
    await this.ensurePermissionsExist(dto.permissionIds);

    const role = await this.prisma.role.findFirst({
      include: {
        permissions: true
      },
      where: {
        id,
        status: {
          not: "DELETED"
        }
      }
    });

    if (!role) {
      throw new NotFoundException("Role not found");
    }

    const oldPermissionIds = role.permissions.map(
      (permission) => permission.permissionId
    );

    const updatedRole = await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: {
          roleId: id
        }
      });

      if (dto.permissionIds.length) {
        await tx.rolePermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({
            assignedById: context.actor.id,
            permissionId,
            roleId: id
          })),
          skipDuplicates: true
        });
      }

      return tx.role.findUniqueOrThrow({
        include: roleInclude,
        where: {
          id
        }
      });
    });

    await this.auditService.record({
      action: "ROLE_PERMISSIONS_UPDATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "role",
      ipAddress: context.ipAddress,
      newValues: {
        permissionIds: dto.permissionIds
      },
      oldValues: {
        permissionIds: oldPermissionIds
      },
      userAgent: context.userAgent
    });

    return this.toRoleResponse(updatedRole);
  }

  private async ensurePermissionsExist(permissionIds: number[]) {
    if (permissionIds.length === 0) {
      return;
    }

    const permissions = await this.prisma.permission.findMany({
      where: {
        id: {
          in: permissionIds
        }
      }
    });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException("One or more permissions are invalid");
    }
  }

  private toRoleResponse(
    role: Prisma.RoleGetPayload<{
      include: typeof roleInclude;
    }>
  ) {
    return {
      code: role.code,
      description: role.description,
      id: role.id,
      isSystem: role.isSystem,
      name: role.name,
      permissions: role.permissions.map((rolePermission) => ({
        code: rolePermission.permission.code,
        id: rolePermission.permission.id,
        module: rolePermission.permission.module,
        name: rolePermission.permission.name
      })),
      status: role.status
    };
  }
}
