import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { RolesPermissionsController } from "./roles-permissions.controller";
import { RolesPermissionsService } from "./roles-permissions.service";

@Module({
  controllers: [RolesPermissionsController],
  imports: [AuditModule],
  providers: [RolesPermissionsService]
})
export class RolesPermissionsModule {}

