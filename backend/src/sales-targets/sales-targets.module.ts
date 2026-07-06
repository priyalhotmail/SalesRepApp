import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SalesTargetsController } from "./sales-targets.controller";
import { SalesTargetsService } from "./sales-targets.service";

@Module({
  controllers: [SalesTargetsController],
  imports: [AuditModule, PrismaModule],
  providers: [SalesTargetsService]
})
export class SalesTargetsModule {}
