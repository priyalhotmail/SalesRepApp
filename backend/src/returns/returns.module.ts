import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ReturnsController } from "./returns.controller";
import { ReturnsService } from "./returns.service";

@Module({
  controllers: [ReturnsController],
  imports: [AuditModule, PrismaModule],
  providers: [ReturnsService]
})
export class ReturnsModule {}
