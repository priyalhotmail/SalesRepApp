import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
import { CreateRoleDto } from "./dto/create-role.dto";
import { RoleQueryDto } from "./dto/role-query.dto";
import { UpdateRolePermissionsDto } from "./dto/update-role-permissions.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { RolesPermissionsService } from "./roles-permissions.service";

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesPermissionsController {
  constructor(private readonly service: RolesPermissionsService) {}

  @Get("roles")
  @Permissions("roles.read")
  listRoles(@Query() query: RoleQueryDto) {
    return this.service.listRoles(query);
  }

  @Post("roles")
  @Permissions("roles.create")
  createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.createRole(dto, this.getContext(actor, request));
  }

  @Get("roles/:id")
  @Permissions("roles.read")
  getRole(@Param("id", ParseIntPipe) id: number) {
    return this.service.getRole(id);
  }

  @Patch("roles/:id")
  @Permissions("roles.update")
  updateRole(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.updateRole(id, dto, this.getContext(actor, request));
  }

  @Delete("roles/:id")
  @Permissions("roles.delete")
  softDeleteRole(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.softDeleteRole(id, this.getContext(actor, request));
  }

  @Put("roles/:id/permissions")
  @Permissions("roles.assign_permissions")
  updateRolePermissions(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.updateRolePermissions(
      id,
      dto,
      this.getContext(actor, request)
    );
  }

  @Get("permissions")
  @Permissions("roles.read")
  listPermissions() {
    return this.service.listPermissions();
  }

  private getContext(actor: AuthenticatedUser, request: Request) {
    const userAgent = request.headers["user-agent"];

    return {
      actor,
      ipAddress: request.ip,
      userAgent: Array.isArray(userAgent) ? userAgent.join(", ") : userAgent
    };
  }
}

