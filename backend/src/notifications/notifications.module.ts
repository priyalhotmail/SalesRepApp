import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  controllers: [NotificationsController],
  imports: [AuditModule, PrismaModule],
  providers: [NotificationsService]
})
export class NotificationsModule {}
