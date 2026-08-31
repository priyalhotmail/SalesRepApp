import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { DiscountsModule } from "../discounts/discounts.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PriceListsModule } from "../price-lists/price-lists.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  controllers: [OrdersController],
  imports: [AuditModule, DiscountsModule, PriceListsModule, PrismaModule],
  providers: [OrdersService]
})
export class OrdersModule {}
