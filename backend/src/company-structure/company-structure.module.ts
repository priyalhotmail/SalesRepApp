import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CompanyStructureController } from "./company-structure.controller";
import { CompanyStructureService } from "./company-structure.service";

@Module({
  controllers: [CompanyStructureController],
  imports: [AuditModule],
  providers: [CompanyStructureService]
})
export class CompanyStructureModule {}

