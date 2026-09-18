import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import {
  CollectionQuery,
  ReviewCollectionDto,
  SendCollectionDto,
} from "./collections.dto";
import { CollectionsService } from "./collections.service";
@Controller("collections")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CollectionsController {
  constructor(private readonly service: CollectionsService) {}
  @Get("dashboard") @Permissions("collections.read") dashboard(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: CollectionQuery,
  ) {
    return this.service.dashboard(actor, query);
  }
  @Get("available") @Permissions("collections.read") available(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: CollectionQuery,
  ) {
    return this.service.availablePayments(actor, query);
  }
  @Get("history") @Permissions("collections.read") history(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: CollectionQuery,
  ) {
    return this.service.history(actor, query);
  }
  @Post() @Permissions("collections.send") send(
    @Body() dto: SendCollectionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.send(dto, actor);
  }
  @Post(":id/review") @Permissions("collections.receive") review(
    @Param("id") id: string,
    @Body() dto: ReviewCollectionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.review(id, dto, actor);
  }
}
