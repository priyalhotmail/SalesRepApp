import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from "@nestjs/common";
import { Permissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { AuditService } from "./audit.service";
import {
  AuditLogExportQueryDto,
  AuditLogQueryDto
} from "./dto/audit-log-query.dto";

@Controller("audit-logs")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions("audit.read")
  list(@Query() query: AuditLogQueryDto) {
    return this.auditService.list(query);
  }

  @Get("export")
  @Permissions("audit.read")
  exportLogs(@Query() query: AuditLogExportQueryDto) {
    return this.auditService.export(query);
  }

  @Get("entity/:entityType/:entityId")
  @Permissions("audit.read")
  listEntityHistory(
    @Param("entityType") entityType: string,
    @Param("entityId") entityId: string,
    @Query() query: AuditLogQueryDto
  ) {
    return this.auditService.list({
      ...query,
      entityId,
      entityType
    });
  }

  @Get(":id")
  @Permissions("audit.read")
  findById(@Param("id", ParseIntPipe) id: number) {
    return this.auditService.findById(id);
  }
}
