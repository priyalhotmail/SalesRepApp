import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { AuditService } from "../audit/audit.service";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { getPagination, toPaginatedResult } from "../common/utils/pagination.util";
import { toAuditJson } from "../common/utils/audit-json.util";
import { toSafeUser, userAuthInclude } from "../common/utils/auth-user.util";
import { PrismaService } from "../prisma/prisma.service";
import { AssignUserRolesDto } from "./dto/assign-user-roles.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserQueryDto } from "./dto/user-query.dto";

type RequestContext = {
  actor: AuthenticatedUser;
  ipAddress?: string;
  userAgent?: string;
};

const privilegedRoleCodes = new Set([
  "SUPER_ADMIN",
  "MAIN_OFFICE_AUTHORIZED_USER",
  "BRANCH_AUTHORIZED_USER"
]);

@Injectable()
export class UsersService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async list(query: UserQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.UserWhereInput = {
      status: query.status ?? {
        not: "DELETED"
      }
    };

    if (query.search) {
      where.OR = [
        {
          email: {
            contains: query.search
          }
        },
        {
          displayName: {
            contains: query.search
          }
        }
      ];
    }

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        include: userAuthInclude,
        orderBy: {
          createdAt: "desc"
        },
        skip,
        take,
        where
      }),
      this.prisma.user.count({ where })
    ]);

    return toPaginatedResult(users.map(toSafeUser), total, page, limit);
  }

  async create(dto: CreateUserDto, context: RequestContext) {
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email
      }
    });

    if (existingUser) {
      throw new ConflictException("A user with this email already exists");
    }

    await this.ensureRolesAssignable(dto.roleIds ?? [], context.actor);

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const createdUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          createdById: context.actor.id,
          displayName: dto.displayName.trim(),
          email,
          passwordHash,
          telephone: dto.telephone
        }
      });

      if (dto.roleIds?.length) {
        await tx.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({
            assignedById: context.actor.id,
            roleId,
            userId: user.id
          })),
          skipDuplicates: true
        });
      }

      return tx.user.findUniqueOrThrow({
        include: userAuthInclude,
        where: {
          id: user.id
        }
      });
    });

    await this.auditService.record({
      action: "USER_CREATED",
      actorUserId: context.actor.id,
      entityId: createdUser.id,
      entityType: "user",
      ipAddress: context.ipAddress,
      newValues: {
        email: createdUser.email,
        roleIds: dto.roleIds ?? [],
        status: createdUser.status
      },
      userAgent: context.userAgent
    });

    return toSafeUser(createdUser);
  }

  async findById(id: number) {
    const user = await this.prisma.user.findFirst({
      include: userAuthInclude,
      where: {
        id
      }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return toSafeUser(user);
  }

  async update(id: number, dto: UpdateUserDto, context: RequestContext) {
    const currentUser = await this.prisma.user.findFirst({
      where: {
        id,
        status: {
          not: "DELETED"
        }
      }
    });

    if (!currentUser) {
      throw new NotFoundException("User not found");
    }

    const updatedUser = await this.prisma.user.update({
      data: {
        displayName: dto.displayName?.trim(),
        status: dto.status,
        telephone: dto.telephone,
        updatedById: context.actor.id
      },
      include: userAuthInclude,
      where: {
        id
      }
    });

    await this.auditService.record({
      action: "USER_UPDATED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "user",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      oldValues: {
        displayName: currentUser.displayName,
        status: currentUser.status,
        telephone: currentUser.telephone
      },
      userAgent: context.userAgent
    });

    return toSafeUser(updatedUser);
  }

  async softDelete(id: number, context: RequestContext) {
    if (id === context.actor.id) {
      throw new BadRequestException("You cannot delete your own account");
    }

    const currentUser = await this.prisma.user.findFirst({
      where: {
        id,
        status: {
          not: "DELETED"
        }
      }
    });

    if (!currentUser) {
      throw new NotFoundException("User not found");
    }

    const deletedUser = await this.prisma.user.update({
      data: {
        deletedAt: new Date(),
        deletedById: context.actor.id,
        status: "DELETED",
        updatedById: context.actor.id
      },
      include: userAuthInclude,
      where: {
        id
      }
    });

    await this.auditService.record({
      action: "USER_SOFT_DELETED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "user",
      ipAddress: context.ipAddress,
      oldValues: {
        email: currentUser.email,
        status: currentUser.status
      },
      userAgent: context.userAgent
    });

    return toSafeUser(deletedUser);
  }

  async assignRoles(id: number, dto: AssignUserRolesDto, context: RequestContext) {
    await this.ensureRolesAssignable(dto.roleIds, context.actor);

    const user = await this.prisma.user.findFirst({
      include: {
        roles: true
      },
      where: {
        id,
        status: {
          not: "DELETED"
        }
      }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const oldRoleIds = user.roles.map((role) => role.roleId);
    const updatedUser = await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: {
          userId: id
        }
      });

      if (dto.roleIds.length) {
        await tx.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({
            assignedById: context.actor.id,
            roleId,
            userId: id
          })),
          skipDuplicates: true
        });
      }

      return tx.user.findUniqueOrThrow({
        include: userAuthInclude,
        where: {
          id
        }
      });
    });

    await this.auditService.record({
      action: "USER_ROLES_ASSIGNED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "user",
      ipAddress: context.ipAddress,
      newValues: {
        roleIds: dto.roleIds
      },
      oldValues: {
        roleIds: oldRoleIds
      },
      userAgent: context.userAgent
    });

    return toSafeUser(updatedUser);
  }

  private async ensureRolesExist(roleIds: number[]) {
    if (roleIds.length === 0) {
      return;
    }

    const roles = await this.prisma.role.findMany({
      where: {
        id: {
          in: roleIds
        },
        status: "ACTIVE"
      }
    });

    if (roles.length !== roleIds.length) {
      throw new BadRequestException("One or more roles are invalid");
    }
  }

  private async ensureRolesAssignable(
    roleIds: number[],
    actor: AuthenticatedUser
  ) {
    if (roleIds.length === 0) {
      throw new BadRequestException("At least one role is required");
    }

    await this.ensureRolesExist(roleIds);

    if (actor.roles.includes("SUPER_ADMIN")) {
      return;
    }

    const privilegedCount = await this.prisma.role.count({
      where: {
        code: { in: Array.from(privilegedRoleCodes) },
        id: { in: roleIds }
      }
    });

    if (privilegedCount > 0) {
      throw new BadRequestException("You cannot assign privileged roles");
    }
  }
}
