import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { EmployeesController } from "./employees.controller";
import { EmployeesService } from "./employees.service";

@Module({ controllers: [EmployeesController], imports: [AuditModule, PrismaModule], providers: [EmployeesService] })
export class EmployeesModule {}
