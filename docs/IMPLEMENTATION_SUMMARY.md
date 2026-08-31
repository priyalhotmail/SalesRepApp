# Implementation Summary

## Files Changed

- Backend schema/API/services:
  - `backend/prisma/schema.prisma`
  - `backend/src/orders/*`
  - `backend/src/customers/*`
  - `backend/src/routes/*`
  - `backend/src/sales-reps/*`
  - `backend/src/users/users.service.ts`
  - `backend/src/common/utils/user-scope.util.ts`
  - `backend/src/price-lists/price-lists.module.ts`
  - `backend/src/discounts/discounts.module.ts`
- Frontend:
  - `frontend/src/auth/*`
  - `frontend/src/routes/AppRouter.tsx`
  - `frontend/src/layouts/AppShell.tsx`
  - `frontend/src/pages/ResourceModulePage.tsx`
  - `frontend/src/components/ResourcePage.tsx`
  - `frontend/src/components/AccessDenied.tsx`
  - `frontend/src/modules/resourceConfigs.ts`
- Database SQL:
  - `backend/sql/016_sales_rep_warehouse_primary_route.sql`
  - `backend/sql/README.md`
- Documentation:
  - `docs/CURRENT_SYSTEM_UNDERSTANDING.md`
  - `docs/CHANGE_PLAN.md`

## Database Changes

- Added optional `sales_reps.warehouse_id` as the primary warehouse relationship for a Sales Rep.
- Added `route_customers.is_primary` and `route_customers.status` so customers can remain on multiple routes while one active primary route is used for order derivation.
- Added indexes for Sales Rep warehouse and primary active route lookups.
- Added manual MySQL migration script `016_sales_rep_warehouse_primary_route.sql`.

## API Changes

- Orders:
  - Sales Rep order creation derives `salesRepId`, `officeId`, `warehouseId`, and `routeId` server-side.
  - Sales Rep order listing/detail access is scoped to the linked Sales Rep.
  - Sales Rep order updates cannot change route or warehouse.
  - Added `GET /api/orders/catalogue-products` guarded by `orders.create`.
  - Added `POST /api/orders/quote-items` guarded by `orders.create`.
- Customers:
  - Customer create/update accepts `routeId` and stores it as the primary active route assignment.
  - Sales Rep customer listing/detail access is scoped to the linked Sales Rep.
- Routes:
  - Sales Rep route listing/detail access is scoped to the Sales Rep office.
- Users:
  - Role assignment requires at least one role.
  - Non-Super Admin users cannot assign privileged roles.

## Frontend Changes

- Sidebar navigation now filters by authenticated user permissions.
- Module/special routes now show Access Denied when permissions are missing.
- User role IDs textarea was replaced with role checkboxes.
- Customer geo fields were removed from the customer form and replaced with a route selector.
- Sales Rep form includes primary warehouse.
- Order items JSON textarea was replaced with a structured responsive order-item editor.
- Order item prices/discounts are quoted from backend order-entry endpoints.

## Security Changes

- Reused the existing `User -> Role -> Permission` system.
- No new permission architecture was added.
- Sensitive Sales Rep order relationships are derived on the backend and not trusted from frontend payloads.
- Route/customer/order list and detail reads are scoped for Sales Rep users.
- Frontend guards are defense-in-depth; backend permission guards remain authoritative.

## Assumptions

- A Sales Rep should have one primary warehouse.
- A customer can belong to multiple routes because `RouteCustomer` uses `(routeId, customerId)` as its key.
- The selected customer route is treated as the primary active route, not the only route membership.
- Existing `orders.create` permission is sufficient for Sales Rep order-entry catalogue and quote endpoints.

## Tests Performed

- `npm run prisma:validate`
- `npm run prisma:generate`
- `npm run build -w backend`
- `npm run build -w frontend`
- `npm run lint -w backend`
- `npm run lint -w frontend`
- `npm run build`

## Remaining Notes

- Run `backend/sql/016_sales_rep_warehouse_primary_route.sql` manually against MySQL before deploying the backend that expects the new columns.
- Existing databases with multiple active primary route rows should be reviewed after migration if manual data edits happened outside the app.
- Git status could not be read in this workspace because Git reports this folder is not a repository, although a `.git` directory exists.
