import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { DiscountsController } from "./discounts.controller";
import { DiscountsService } from "./discounts.service";

@Module({
  controllers: [DiscountsController],
  imports: [AuditModule],
  providers: [DiscountsService]
})
export class DiscountsModule {}

