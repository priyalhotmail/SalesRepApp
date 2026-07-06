import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
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
  SystemSettingQueryDto,
  UpsertSystemSettingDto
} from "./dto/system-setting.dto";
import { SystemSettingsService } from "./system-settings.service";

@Controller("system-settings")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SystemSettingsController {
  constructor(private readonly service: SystemSettingsService) {}

  @Get()
  @Permissions("system_config.read")
  list(@Query() query: SystemSettingQueryDto) {
    return this.service.list(query);
  }

  @Get(":key")
  @Permissions("system_config.read")
  findByKey(@Param("key") key: string) {
    return this.service.findByKey(key);
  }

  @Put(":key")
  @Permissions("system_config.update")
  upsert(
    @Param("key") key: string,
    @Body() dto: UpsertSystemSettingDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.upsert(key, dto, buildRequestContext(actor, request));
  }

  @Delete(":key")
  @Permissions("system_config.update")
  delete(
    @Param("key") key: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.delete(key, buildRequestContext(actor, request));
  }
}
