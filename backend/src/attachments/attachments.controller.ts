import {
  Body,
  Controller,
  Delete,
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
import { AttachmentsService } from "./attachments.service";
import { AttachmentQueryDto, CreateAttachmentDto } from "./dto/attachment.dto";

@Controller("attachments")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttachmentsController {
  constructor(private readonly service: AttachmentsService) {}

  @Get()
  @Permissions("attachments.read")
  list(@Query() query: AttachmentQueryDto) {
    return this.service.list(query);
  }

  @Post()
  @Permissions("attachments.create")
  create(
    @Body() dto: CreateAttachmentDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.create(dto, buildRequestContext(actor, request));
  }

  @Delete(":id")
  @Permissions("attachments.delete")
  delete(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.delete(id, buildRequestContext(actor, request));
  }
}
