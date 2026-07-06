import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  controllers: [DashboardController],
  imports: [PrismaModule],
  providers: [DashboardService]
})
export class DashboardModule {}
