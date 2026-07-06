import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CommissionsController } from "./commissions.controller";
import { CommissionsService } from "./commissions.service";

@Module({
  controllers: [CommissionsController],
  imports: [AuditModule, PrismaModule],
  providers: [CommissionsService]
})
export class CommissionsModule {}
