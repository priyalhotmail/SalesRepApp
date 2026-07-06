import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ChequesController } from "./cheques.controller";
import { ChequesService } from "./cheques.service";

@Module({
  controllers: [ChequesController],
  imports: [AuditModule, PrismaModule],
  providers: [ChequesService]
})
export class ChequesModule {}
