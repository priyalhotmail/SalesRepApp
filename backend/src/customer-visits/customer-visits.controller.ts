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
import { CustomerVisitsService } from "./customer-visits.service";
import {
  CompleteCustomerVisitDto,
  CreateCustomerVisitDto,
  CustomerVisitQueryDto,
  VisitNoteDto
} from "./dto/customer-visit.dto";

@Controller("customer-visits")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustomerVisitsController {
  constructor(private readonly service: CustomerVisitsService) {}

  @Get()
  @Permissions("customer_visits.read")
  list(@Query() query: CustomerVisitQueryDto) {
    return this.service.list(query);
  }

  @Post()
  @Permissions("customer_visits.create")
  create(
    @Body() dto: CreateCustomerVisitDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.create(dto, buildRequestContext(actor, request));
  }

  @Post(":id/complete")
  @Permissions("customer_visits.update")
  complete(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CompleteCustomerVisitDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.complete(id, dto, buildRequestContext(actor, request));
  }

  @Post(":id/missed")
  @Permissions("customer_visits.update")
  markMissed(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: VisitNoteDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.markMissed(id, dto, buildRequestContext(actor, request));
  }

  @Post(":id/cancel")
  @Permissions("customer_visits.update")
  cancel(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: VisitNoteDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.cancel(id, dto, buildRequestContext(actor, request));
  }
}
