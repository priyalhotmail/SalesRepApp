import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AttachmentsController } from "./attachments.controller";
import { AttachmentsService } from "./attachments.service";

@Module({
  controllers: [AttachmentsController],
  imports: [AuditModule, PrismaModule],
  providers: [AttachmentsService]
})
export class AttachmentsModule {}
