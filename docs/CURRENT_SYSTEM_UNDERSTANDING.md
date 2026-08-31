# Current System Understanding

## Architecture

- **Repository:** npm workspace with a React frontend in `frontend/` and a NestJS backend in `backend/`.
- **Frontend:** React 19, TypeScript, Vite 6, Material UI 6, React Router 7. It is responsive and PWA-ready.
- **Backend:** NestJS 10 REST API, mounted under `/api`.
- **Database:** MySQL 8-compatible schema, accessed through Prisma 6 (`backend/prisma/schema.prisma`).
- **Migrations:** phase-based manual MySQL scripts in `backend/sql/`; there is no Prisma migrations directory.
- **API client:** `frontend/src/api/client.ts`; it sends a bearer token to `VITE_API_BASE_URL` (default `http://localhost:3000/api`).

## Authentication and authorization

- Login is `POST /api/auth/login`; the backend issues a JWT and the frontend stores it in local storage.
- `JwtAuthGuard` reloads each active user with roles and permissions on protected requests.
- The role model is `User -> UserRole -> Role -> RolePermission -> Permission`.
- `PermissionsGuard` enforces controller/handler `@Permissions(...)` requirements; `SUPER_ADMIN` bypasses individual permission checks.
- The authenticated frontend user has role-code and permission-code arrays from `GET /api/auth/me`.
- The seeded role set includes Super Admin, main-office/branch/office users, warehouse user, Sales Rep, and delivery person.

## Modules and API surface

The registered backend modules cover users, roles/permissions, audit, company structure, sales reps, customers, product catalogue, price lists, discounts, inventory, routes, orders, delivery, invoices, payments, cheques, returns, credit control, targets, commissions, warehouse transfers, visits, attachments, notifications, dashboard, reports, settings, and health.

Most frontend CRUD screens use `ResourceModulePage`, `ResourcePage`, and `resourceConfigs`. Reusable responsive components include `ResponsiveDataView`, `PageHeader`, `DataState`, and `AccessDenied`. Discounts and commissions use tabbed resource pages.

## Data model relevant to this change

- A `SalesRep` belongs to an `Office`, is optionally linked to a `User`, and now has an optional `warehouseId` primary warehouse.
- A `Warehouse` may belong to an office; the Sales Rep primary warehouse relation is explicit in Prisma.
- A `Customer` belongs to an office and may have a Sales Rep. Geographic fields remain in the database for field-operation compatibility.
- A `Route` belongs to an office. Customer routes use `RouteCustomer`; the current working tree adds `isPrimary` and `status` so a customer has a selected active primary route without duplicating a route FK.
- An `Order` stores customer, sales rep, office, route, warehouse, financial totals, workflow status, and `OrderItem` children.
- An `OrderItem` stores product, optional packaging option, quantity, free quantity, server-calculated unit price, discount, and line total.
- Sales invoices already exist and can be created from orders (`POST /api/sales-invoices/from-order`).

## Current order and customer behaviour

The uncommitted working tree already changes the previous generic forms substantially:

- Orders expose `GET /api/orders/catalogue-products` and `POST /api/orders/quote-items` for backend-sourced catalogue/pricing/discount quotes.
- The order form uses a structured item entry component: product selector, positive quantity, duplicate prevention, server quote, editable quantity, removal, totals, desktop table, and mobile cards.
- `OrdersService.createOrder` scopes Sales Rep users to their linked active Sales Rep, office, primary warehouse, and the selected customer's primary active route. Client-supplied sensitive IDs are ignored for that scope.
- Customer create/update accepts `routeId`, validates it against the effective office, and writes a single active primary `RouteCustomer` relationship. Sales Reps are constrained to their own office and Sales Rep identity.
- The generic customer screen now selects a route instead of exposing latitude/longitude/geo-accuracy fields.

## Navigation and frontend protection

- `AppShell` has a permission-tagged navigation configuration and filters links using the authenticated user permissions.
- `AppRouter` wraps protected pages in permission gates and shows `AccessDenied` for authenticated users who lack the required permission. Unauthenticated users go to login.
- Permission checks are frontend usability/defence in depth; Nest guards remain authoritative for API protection.

## User role selection

- The user resource configuration uses `multiReference` for `roleIds`.
- `ResourcePage` loads roles and renders checkbox selection rather than a JSON/ID text area.
- User creation and role-assignment APIs are already permission guarded and record audit events. The exact privileged-role assignment policy needs a targeted verification pass.

## Auditing

Audit logging exists through `AuditService`. The current working tree records customer route assignment, order creation/update, user-role assignment, and related privileged actions.

## Migration and repository state

- `backend/sql/016_sales_rep_warehouse_primary_route.sql` adds the Sales Rep warehouse and primary-route metadata, then backfills conservatively.
- `backend/sql/017_order_workflow_permission_cleanup.sql` removes Sales Rep permissions that would allow restricted order workflow actions.
- Both scripts are uncommitted, as are the related Prisma and application changes.
- The working tree is intentionally dirty. These changes must be preserved; this discovery phase has not reset, checked out, or recreated any data.

## Remaining verification/gaps

1. Run compile/lint/type checks and API-level tests; they have not yet been run in this recovery pass.
2. Confirm SQL 016 is applied before Prisma generation/runtime use against an existing database.
3. Verify every controller list/read/update endpoint that is exposed to Sales Reps has the intended record scope, especially adjacent operational modules.
4. Define and test the privileged-role assignment boundary for non-super-admin role managers.
5. Confirm whether retaining geo columns (hidden from the customer form) is sufficient for existing field workflows.
