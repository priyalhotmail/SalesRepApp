import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PriceListsController } from "./price-lists.controller";
import { PriceListsService } from "./price-lists.service";

@Module({
  controllers: [PriceListsController],
  imports: [AuditModule],
  providers: [PriceListsService],
  exports: [PriceListsService]
})
export class PriceListsModule {}
