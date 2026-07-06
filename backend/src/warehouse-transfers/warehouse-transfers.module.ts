import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { WarehouseTransfersController } from "./warehouse-transfers.controller";
import { WarehouseTransfersService } from "./warehouse-transfers.service";

@Module({
  controllers: [WarehouseTransfersController],
  imports: [AuditModule, PrismaModule],
  providers: [WarehouseTransfersService]
})
export class WarehouseTransfersModule {}
