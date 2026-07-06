import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ProductCatalogueController } from "./product-catalogue.controller";
import { ProductCatalogueService } from "./product-catalogue.service";

@Module({
  controllers: [ProductCatalogueController],
  imports: [AuditModule],
  providers: [ProductCatalogueService]
})
export class ProductCatalogueModule {}

