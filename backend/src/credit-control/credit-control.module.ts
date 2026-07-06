import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CreditControlController } from "./credit-control.controller";
import { CreditControlService } from "./credit-control.service";

@Module({
  controllers: [CreditControlController],
  imports: [AuditModule, PrismaModule],
  providers: [CreditControlService]
})
export class CreditControlModule {}
