import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  controllers: [UsersController],
  imports: [AuditModule],
  providers: [UsersService]
})
export class UsersModule {}

