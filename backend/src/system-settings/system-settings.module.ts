import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SystemSettingsController } from "./system-settings.controller";
import { SystemSettingsService } from "./system-settings.service";

@Module({
  controllers: [SystemSettingsController],
  imports: [AuditModule, PrismaModule],
  providers: [SystemSettingsService]
})
export class SystemSettingsModule {}
