import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, SystemSetting, SystemSettingValueType } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { RequestContext } from "../common/types/request-context.type";
import { toAuditJson } from "../common/utils/audit-json.util";
import { getPagination, toPaginatedResult } from "../common/utils/pagination.util";
import { PrismaService } from "../prisma/prisma.service";
import {
  SystemSettingQueryDto,
  UpsertSystemSettingDto
} from "./dto/system-setting.dto";

@Injectable()
export class SystemSettingsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async list(query: SystemSettingQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.SystemSettingWhereInput = {
      category: query.category,
      status: query.status ?? { not: "DELETED" }
    };
    if (query.search) {
      where.OR = [
        { key: { contains: query.search } },
        { description: { contains: query.search } }
      ];
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.systemSetting.findMany({
        orderBy: [{ category: "asc" }, { key: "asc" }],
        skip,
        take,
        where
      }),
      this.prisma.systemSetting.count({ where })
    ]);

    return toPaginatedResult(
      data.map((setting) => this.toResponse(setting)),
      total,
      page,
      limit
    );
  }

  async findByKey(key: string) {
    this.validateKey(key);
    const setting = await this.prisma.systemSetting.findFirst({
      where: { key, status: { not: "DELETED" } }
    });
    if (!setting) {
      throw new NotFoundException("System setting not found");
    }
    return this.toResponse(setting);
  }

  async upsert(key: string, dto: UpsertSystemSettingDto, context: RequestContext) {
    this.validateKey(key);
    this.validateValue(dto.value, dto.valueType);

    const existingSetting = await this.prisma.systemSetting.findUnique({
      where: { key }
    });
    const savedSetting = existingSetting
      ? await this.prisma.systemSetting.update({
          data: {
            category: dto.category.trim(),
            description: dto.description?.trim(),
            isSensitive: dto.isSensitive,
            status: dto.status ?? existingSetting.status,
            updatedById: context.actor.id,
            value: this.toJsonValue(dto.value),
            valueType: dto.valueType
          },
          where: { key }
        })
      : await this.prisma.systemSetting.create({
          data: {
            category: dto.category.trim(),
            createdById: context.actor.id,
            description: dto.description?.trim(),
            isSensitive: dto.isSensitive ?? false,
            key,
            status: dto.status ?? "ACTIVE",
            updatedById: context.actor.id,
            value: this.toJsonValue(dto.value),
            valueType: dto.valueType
          }
        });

    await this.auditService.record({
      action: existingSetting ? "SYSTEM_SETTING_UPDATED" : "SYSTEM_SETTING_CREATED",
      actorUserId: context.actor.id,
      entityId: savedSetting.id,
      entityType: "system_setting",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(this.toAuditShape(savedSetting)),
      oldValues: existingSetting
        ? toAuditJson(this.toAuditShape(existingSetting))
        : undefined,
      userAgent: context.userAgent
    });

    return this.toResponse(savedSetting);
  }

  async delete(key: string, context: RequestContext) {
    this.validateKey(key);
    const setting = await this.prisma.systemSetting.findFirst({
      where: { key, status: { not: "DELETED" } }
    });
    if (!setting) {
      throw new NotFoundException("System setting not found");
    }
    const deletedSetting = await this.prisma.systemSetting.update({
      data: {
        deletedAt: new Date(),
        deletedById: context.actor.id,
        status: "DELETED",
        updatedById: context.actor.id
      },
      where: { key }
    });

    await this.auditService.record({
      action: "SYSTEM_SETTING_SOFT_DELETED",
      actorUserId: context.actor.id,
      entityId: deletedSetting.id,
      entityType: "system_setting",
      ipAddress: context.ipAddress,
      oldValues: toAuditJson(this.toAuditShape(setting)),
      userAgent: context.userAgent
    });

    return this.toResponse(deletedSetting);
  }

  private validateKey(key: string) {
    if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(key)) {
      throw new BadRequestException(
        "Setting key must use lowercase letters, numbers, dots, underscores, or hyphens"
      );
    }
  }

  private validateValue(value: unknown, valueType: SystemSettingValueType) {
    if (valueType === "STRING" && typeof value !== "string") {
      throw new BadRequestException("STRING settings require a string value");
    }
    if (valueType === "NUMBER" && typeof value !== "number") {
      throw new BadRequestException("NUMBER settings require a number value");
    }
    if (valueType === "BOOLEAN" && typeof value !== "boolean") {
      throw new BadRequestException("BOOLEAN settings require a boolean value");
    }
    try {
      JSON.stringify(value);
    } catch {
      throw new BadRequestException("Setting value must be JSON serializable");
    }
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private toResponse(setting: SystemSetting) {
    return {
      ...setting,
      value: setting.isSensitive ? "[REDACTED]" : setting.value
    };
  }

  private toAuditShape(setting: SystemSetting) {
    return {
      ...setting,
      value: setting.isSensitive ? "[REDACTED]" : setting.value
    };
  }
}
