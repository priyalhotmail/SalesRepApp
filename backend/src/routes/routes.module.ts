import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RoutesController } from "./routes.controller";
import { RoutesService } from "./routes.service";

@Module({
  controllers: [RoutesController],
  imports: [AuditModule, PrismaModule],
  providers: [RoutesService]
})
export class RoutesModule {}
