import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
import { CreateSalesRepDto } from "./dto/create-sales-rep.dto";
import { SalesRepQueryDto } from "./dto/sales-rep-query.dto";
import { UpdateSalesRepDto } from "./dto/update-sales-rep.dto";
import { SalesRepsService } from "./sales-reps.service";

@Controller("sales-reps")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalesRepsController {
  constructor(private readonly service: SalesRepsService) {}

  @Get()
  @Permissions("sales_reps.read")
  list(@Query() query: SalesRepQueryDto) {
    return this.service.list(query);
  }

  @Post()
  @Permissions("sales_reps.create")
  create(
    @Body() dto: CreateSalesRepDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.create(dto, buildRequestContext(actor, request));
  }

  @Get(":id")
  @Permissions("sales_reps.read")
  findById(@Param("id", ParseIntPipe) id: number) {
    return this.service.findById(id);
  }

  @Patch(":id")
  @Permissions("sales_reps.update")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateSalesRepDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.update(id, dto, buildRequestContext(actor, request));
  }

  @Delete(":id")
  @Permissions("sales_reps.delete")
  softDelete(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.softDelete(id, buildRequestContext(actor, request));
  }
}

