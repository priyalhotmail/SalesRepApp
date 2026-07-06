import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { SalesRepsController } from "./sales-reps.controller";
import { SalesRepsService } from "./sales-reps.service";

@Module({
  controllers: [SalesRepsController],
  imports: [AuditModule],
  providers: [SalesRepsService]
})
export class SalesRepsModule {}

