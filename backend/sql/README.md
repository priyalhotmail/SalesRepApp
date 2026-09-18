# Manual SQL Scripts

Run these scripts manually in MySQL when a phase asks for it.

Phase 1 only creates the database:

```sql
SOURCE backend/sql/001_phase1_database.sql;
```

Business tables, indexes, and seed data start in Phase 2.

Phase 2 creates the authentication, authorization, and audit tables:

```sql
SOURCE backend/sql/002_phase2_auth_schema.sql;
SOURCE backend/sql/003_phase2_seed_auth.sql;
```

Default admin login after the seed script:

```text
Email: admin@sales.local
Password: Admin@12345
```

Phase 3 creates company structure, sales reps, customers, and customer change request tables:

```sql
SOURCE backend/sql/004_phase3_company_customer_schema.sql;
SOURCE backend/sql/005_phase3_seed_company_customer.sql;
```

Phase 4 creates product catalogue, price list, and discount tables:

```sql
SOURCE backend/sql/006_phase4_product_pricing_discount_schema.sql;
SOURCE backend/sql/007_phase4_seed_product_pricing_discount.sql;
```

Phase 5 creates inventory, routes, order, amendment, reservation, and loading report support tables:

```sql
SOURCE backend/sql/008_phase5_inventory_routes_orders_schema.sql;
SOURCE backend/sql/009_phase5_seed_inventory_routes_orders.sql;
```

Phase 6 creates delivery, invoice, payment, cheque, return, and credit control support tables:

```sql
SOURCE backend/sql/010_phase6_delivery_invoice_payment_credit_schema.sql;
SOURCE backend/sql/011_phase6_seed_delivery_invoice_payment_credit.sql;
```

Phase 7 creates Version 1.0 field feature tables for sales targets, commissions, warehouse transfers, customer visits, attachment metadata, notifications, customer geo fields, and transfer stock movement types:

```sql
SOURCE backend/sql/012_phase7_v1_field_features_schema.sql;
SOURCE backend/sql/013_phase7_seed_v1_field_features.sql;
```

Phase 8 creates system configuration storage and seeds dashboard/report/config permissions:

```sql
SOURCE backend/sql/014_phase8_reports_dashboard_config_schema.sql;
SOURCE backend/sql/015_phase8_seed_reports_dashboard_config.sql;
```

Phase 9 adds Sales Rep primary warehouse assignment and primary active customer route support:

```sql
SOURCE backend/sql/016_sales_rep_warehouse_primary_route.sql;
```

Phase 10 adds employee records linked to an existing user account, office, branch, and warehouse:

```sql
SOURCE backend/sql/019_employees_schema_and_permissions.sql;
```

If Phase 10 was already applied, make the employee branch assignment optional for main-office employees:

```sql
SOURCE backend/sql/020_employee_main_office_optional_branch.sql;
```

Phase 11 adds employee operational categories and employment types:

```sql
SOURCE backend/sql/021_employee_category_and_employment_type.sql;
```

Phase 12 adds route driver assignment and persistent delivery-plan tables:

```sql
SOURCE backend/sql/022_route_drivers_and_delivery_plans.sql;
```

Run this corrective permission sync for Delivery Plan access on an existing database:

```sql
SOURCE backend/sql/023_delivery_plan_role_permission_sync.sql;
```

Run this permission sync for Branch Authorized route access:

```sql
SOURCE backend/sql/024_branch_route_read_permission.sql;
```

If a Branch Authorized User still cannot open Delivery Plans or Routes, run this self-contained access repair:

```sql
SOURCE backend/sql/025_branch_delivery_and_routes_access_repair.sql;
```

Allow Delivery Person users to generate an invoice after confirming their delivery:

```sql
SOURCE backend/sql/026_delivery_person_invoice_create_permission.sql;
```

Temporary cash and cheque collection (apply once before starting the updated app):

```sql
SOURCE backend/sql/027_temporary_payment_collection.sql;
```

Then regenerate the Prisma client and restart the backend. Sign in again to refresh role permissions. Existing posted receipts remain unchanged. New receipts are temporary; cash settles at handover and cheques settle at bank reconciliation. Customer-level receipts allocate to oldest due invoices.

Driver day summary and empty-can returns (apply once after 027):

```sql
SOURCE backend/sql/028_driver_day_and_can_returns.sql;
```

Regenerate Prisma, restart the backend and sign in again. Configure sizes and LKR return values in Returnable Can Settings, explicitly assigning products sold as individual cans. One delivered product unit is one can; do not assign bulk litres or cartons. Products, return value and active status are editable; capacity remains fixed. Changing products recalculates can-return eligibility using the new selection. Existing return receipts and posted credits keep their recorded quantities and values. Only recorded delivered quantities qualify (including paid invoices). Temporary receipts reserve quantities; confirmation applies credits oldest invoice first, with the remainder automatically applied when the next invoice is created. Product returns remain separate. Undelivered receipt confirms custody only because existing delivery finalization deducts delivered stock only. Driver summary dates currently use UTC and collections are attributed to their recording user.

### Windows Prisma generation lock

`EPERM ... rename ... query_engine-windows.dll.node` means a running backend may have the engine loaded. Stopping only a child PID is insufficient if the Nest watcher restarts it. From the project root or backend folder, run:

```powershell
npm run prisma:generate:safe
```

This command identifies only this checkout's backend and Nest launcher, stops their process trees, regenerates Prisma, and leaves the backend stopped. It does not stop the frontend or unrelated Node applications. After generation, run `npm run dev:backend` from the root, or `npm run dev` from the backend folder. Normal `npm run prisma:generate` now reports the current blocking PIDs and the recovery command before attempting generation.
