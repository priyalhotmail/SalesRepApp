import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { buildRequestContext } from "../common/types/request-context.type";
import {
  CreateNotificationDto,
  NotificationQueryDto
} from "./dto/notification.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @Permissions("notifications.read")
  list(
    @Query() query: NotificationQueryDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.list(query, actor.id);
  }

  @Get("unread-count")
  @Permissions("notifications.read")
  unreadCount(@CurrentUser() actor: AuthenticatedUser) {
    return this.service.unreadCount(actor.id);
  }

  @Post()
  @Permissions("notifications.create")
  create(
    @Body() dto: CreateNotificationDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.create(dto, buildRequestContext(actor, request));
  }

  @Post(":id/read")
  @Permissions("notifications.update")
  markRead(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.markRead(id, buildRequestContext(actor, request));
  }

  @Post("mark-all-read")
  @Permissions("notifications.update")
  markAllRead(
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.markAllRead(buildRequestContext(actor, request));
  }
}
