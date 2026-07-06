import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CustomerVisitsController } from "./customer-visits.controller";
import { CustomerVisitsService } from "./customer-visits.service";

@Module({
  controllers: [CustomerVisitsController],
  imports: [AuditModule, PrismaModule],
  providers: [CustomerVisitsService]
})
export class CustomerVisitsModule {}
