import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

@Module({
  controllers: [CustomersController],
  imports: [AuditModule],
  providers: [CustomersService]
})
export class CustomersModule {}

