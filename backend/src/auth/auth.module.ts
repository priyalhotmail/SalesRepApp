import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  controllers: [AuthController],
  imports: [AuditModule],
  providers: [AuthService]
})
export class AuthModule {}
