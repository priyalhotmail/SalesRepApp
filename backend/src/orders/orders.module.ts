import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  controllers: [OrdersController],
  imports: [AuditModule, PrismaModule],
  providers: [OrdersService]
})
export class OrdersModule {}
