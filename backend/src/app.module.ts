import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { AttachmentsModule } from "./attachments/attachments.module";
import { CompanyStructureModule } from "./company-structure/company-structure.module";
import { CommissionsModule } from "./commissions/commissions.module";
import { configuration } from "./config/configuration";
import { CreditControlModule } from "./credit-control/credit-control.module";
import { CustomerVisitsModule } from "./customer-visits/customer-visits.module";
import { CustomersModule } from "./customers/customers.module";
import { ChequesModule } from "./cheques/cheques.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { DeliveryModule } from "./delivery/delivery.module";
import { DiscountsModule } from "./discounts/discounts.module";
import { HealthModule } from "./health/health.module";
import { InventoryModule } from "./inventory/inventory.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { OrdersModule } from "./orders/orders.module";
import { PaymentsModule } from "./payments/payments.module";
import { PriceListsModule } from "./price-lists/price-lists.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProductCatalogueModule } from "./product-catalogue/product-catalogue.module";
import { ReportsModule } from "./reports/reports.module";
import { ReturnsModule } from "./returns/returns.module";
import { RolesPermissionsModule } from "./roles-permissions/roles-permissions.module";
import { RoutesModule } from "./routes/routes.module";
import { SalesInvoicesModule } from "./sales-invoices/sales-invoices.module";
import { SalesTargetsModule } from "./sales-targets/sales-targets.module";
import { SalesRepsModule } from "./sales-reps/sales-reps.module";
import { SecurityModule } from "./security/security.module";
import { SystemSettingsModule } from "./system-settings/system-settings.module";
import { UsersModule } from "./users/users.module";
import { WarehouseTransfersModule } from "./warehouse-transfers/warehouse-transfers.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [".env"],
      isGlobal: true,
      load: [configuration]
    }),
    PrismaModule,
    SecurityModule,
    AuditModule,
    AuthModule,
    UsersModule,
    RolesPermissionsModule,
    CompanyStructureModule,
    SalesRepsModule,
    CustomersModule,
    ProductCatalogueModule,
    PriceListsModule,
    DiscountsModule,
    InventoryModule,
    RoutesModule,
    OrdersModule,
    DeliveryModule,
    SalesInvoicesModule,
    PaymentsModule,
    ChequesModule,
    ReturnsModule,
    CreditControlModule,
    SalesTargetsModule,
    CommissionsModule,
    WarehouseTransfersModule,
    CustomerVisitsModule,
    AttachmentsModule,
    NotificationsModule,
    DashboardModule,
    ReportsModule,
    SystemSettingsModule,
    HealthModule
  ]
})
export class AppModule {}
