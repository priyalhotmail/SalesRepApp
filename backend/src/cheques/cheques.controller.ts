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
import { ChequesService } from "./cheques.service";
import { ChequeQueryDto, ReturnChequeDto } from "./dto/cheque.dto";

@Controller("cheques")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChequesController {
  constructor(private readonly service: ChequesService) {}

  @Get()
  @Permissions("cheques.read")
  listCheques(@Query() query: ChequeQueryDto) {
    return this.service.listCheques(query);
  }

  @Get(":id")
  @Permissions("cheques.read")
  findChequeById(@Param("id", ParseIntPipe) id: number) {
    return this.service.findChequeById(id);
  }

  @Post(":id/deposit")
  @Permissions("cheques.update")
  depositCheque(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.depositCheque(id, buildRequestContext(actor, request));
  }

  @Post(":id/realize")
  @Permissions("cheques.update")
  realizeCheque(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.realizeCheque(id, buildRequestContext(actor, request));
  }

  @Post(":id/return")
  @Permissions("cheques.update")
  returnCheque(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReturnChequeDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.service.returnCheque(
      id,
      dto,
      buildRequestContext(actor, request)
    );
  }
}
