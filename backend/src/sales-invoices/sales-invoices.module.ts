import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SalesInvoicesController } from "./sales-invoices.controller";
import { SalesInvoicesService } from "./sales-invoices.service";

@Module({
  controllers: [SalesInvoicesController],
  imports: [AuditModule, PrismaModule],
  providers: [SalesInvoicesService]
})
export class SalesInvoicesModule {}
