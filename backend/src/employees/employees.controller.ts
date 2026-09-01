import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { buildRequestContext } from "../common/types/request-context.type";
import { CreateEmployeeDto, EmployeeQueryDto, UpdateEmployeeDto } from "./dto/employee.dto";
import { EmployeesService } from "./employees.service";

@Controller("employees")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}
  @Get("available-users") @Permissions("employees.create") availableUsers(@Query() query: EmployeeQueryDto) { return this.service.listAvailableUsers(query); }
  @Get() @Permissions("employees.read") list(@Query() query: EmployeeQueryDto) { return this.service.list(query); }
  @Get(":id") @Permissions("employees.read") findById(@Param("id", ParseIntPipe) id: number) { return this.service.findById(id); }
  @Post() @Permissions("employees.create") create(@Body() dto: CreateEmployeeDto, @CurrentUser() actor: AuthenticatedUser, @Req() request: Request) { return this.service.create(dto, buildRequestContext(actor, request)); }
  @Patch(":id") @Permissions("employees.update") update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateEmployeeDto, @CurrentUser() actor: AuthenticatedUser, @Req() request: Request) { return this.service.update(id, dto, buildRequestContext(actor, request)); }
  @Delete(":id") @Permissions("employees.delete") remove(@Param("id", ParseIntPipe) id: number, @CurrentUser() actor: AuthenticatedUser, @Req() request: Request) { return this.service.softDelete(id, buildRequestContext(actor, request)); }
}
