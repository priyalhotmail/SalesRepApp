import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";

@Module({
  controllers: [InventoryController],
  imports: [AuditModule, PrismaModule],
  providers: [InventoryService]
})
export class InventoryModule {}
