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
import { AssignUserRolesDto } from "./dto/assign-user-roles.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserQueryDto } from "./dto/user-query.dto";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions("users.read")
  list(@Query() query: UserQueryDto) {
    return this.usersService.list(query);
  }

  @Post()
  @Permissions("users.create")
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.usersService.create(dto, this.getContext(actor, request));
  }

  @Get(":id")
  @Permissions("users.read")
  findById(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.findById(id);
  }

  @Patch(":id")
  @Permissions("users.update")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.usersService.update(id, dto, this.getContext(actor, request));
  }

  @Delete(":id")
  @Permissions("users.delete")
  softDelete(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.usersService.softDelete(id, this.getContext(actor, request));
  }

  @Put(":id/roles")
  @Permissions("users.assign_roles")
  assignRoles(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AssignUserRolesDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.usersService.assignRoles(id, dto, this.getContext(actor, request));
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

