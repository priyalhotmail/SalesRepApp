import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  controllers: [ReportsController],
  imports: [PrismaModule],
  providers: [ReportsService]
})
export class ReportsModule {}
