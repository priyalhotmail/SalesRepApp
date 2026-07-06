import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { DeliveryController } from "./delivery.controller";
import { DeliveryService } from "./delivery.service";

@Module({
  controllers: [DeliveryController],
  imports: [AuditModule, PrismaModule],
  providers: [DeliveryService]
})
export class DeliveryModule {}
