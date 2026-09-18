import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import {
  CanReturnsController,
  DriverDayController,
} from "./can-returns.controller";
import { CanReturnsService } from "./can-returns.service";
import { DriverDayService } from "./driver-day.service";
@Module({
  imports: [PrismaModule],
  controllers: [CanReturnsController, DriverDayController],
  providers: [CanReturnsService, DriverDayService],
})
export class CanReturnsModule {}
