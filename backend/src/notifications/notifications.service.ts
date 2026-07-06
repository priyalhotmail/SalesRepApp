import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { RequestContext } from "../common/types/request-context.type";
import { toAuditJson } from "../common/utils/audit-json.util";
import { getPagination, toPaginatedResult } from "../common/utils/pagination.util";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateNotificationDto,
  NotificationQueryDto
} from "./dto/notification.dto";

@Injectable()
export class NotificationsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async list(query: NotificationQueryDto, actorId: number) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.NotificationWhereInput = {
      status: query.status,
      userId: query.userId ?? actorId
    };
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { message: { contains: query.search } }
      ];
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take,
        where
      }),
      this.prisma.notification.count({ where })
    ]);
    return toPaginatedResult(data, total, page, limit);
  }

  async unreadCount(actorId: number) {
    return {
      unread: await this.prisma.notification.count({
        where: { status: "UNREAD", userId: actorId }
      })
    };
  }

  async create(dto: CreateNotificationDto, context: RequestContext) {
    if (dto.userId) {
      await this.ensureUser(dto.userId);
    }
    const notification = await this.prisma.notification.create({
      data: {
        createdById: context.actor.id,
        entityId: dto.entityId,
        entityType: dto.entityType,
        message: dto.message,
        module: dto.module,
        title: dto.title,
        type: dto.type ?? "INFO",
        userId: dto.userId
      }
    });
    await this.auditService.record({
      action: "NOTIFICATION_CREATED",
      actorUserId: context.actor.id,
      entityId: notification.id,
      entityType: "notification",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(notification),
      userAgent: context.userAgent
    });
    return notification;
  }

  async markRead(id: number, context: RequestContext) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId: context.actor.id }
    });
    if (!notification) {
      throw new NotFoundException("Notification not found");
    }
    const readNotification = await this.prisma.notification.update({
      data: { readAt: new Date(), status: "READ" },
      where: { id }
    });
    return readNotification;
  }

  async markAllRead(context: RequestContext) {
    await this.prisma.notification.updateMany({
      data: { readAt: new Date(), status: "READ" },
      where: { status: "UNREAD", userId: context.actor.id }
    });
    return this.unreadCount(context.actor.id);
  }

  private async ensureUser(userId: number) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: { not: "DELETED" } }
    });
    if (!user) {
      throw new BadRequestException("Notification user is invalid");
    }
  }
}
