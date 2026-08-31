# Implementation Changelog

## Scope

Implemented the approved authorization, Sales Rep warehouse, customer route, Sales Rep order creation, structured order item editor, user role checkbox, customer creation, responsive UX, healing, and documentation changes without introducing a new permission architecture.

## Changed Modules

- Backend authorization remains on the existing `User -> Role -> Permission` model with `JwtAuthGuard` and `PermissionsGuard`.
- Backend order creation now derives Sales Rep order context server-side.
- Backend customer and route services now support primary active route assignment through existing `RouteCustomer`.
- Backend Sales Rep service now supports one primary warehouse relationship.
- Frontend navigation and route guards now filter by logged-in user permissions.
- Frontend users form now uses role checkboxes.
- Frontend customers form now uses route selection instead of manual geo fields in the primary form.
- Frontend orders form now uses a structured responsive order item editor.

## Database Changes

- Added `sales_reps.warehouse_id` as the primary warehouse link for a Sales Rep.
- Added `route_customers.is_primary` and `route_customers.status` to support multiple customer routes with one primary active route.
- Added supporting indexes for Sales Rep warehouse and primary active route lookups.
- Migration script: `backend/sql/016_sales_rep_warehouse_primary_route.sql`.

Existing data requires a backfill. The SQL script backfills one primary route per customer from existing `route_customers` rows and backfills Sales Rep warehouse from the first active office warehouse where possible. Review Sales Reps without a warehouse after running the script.

## APIs Changed Or Added

- `POST /api/orders`: Sales Rep order context is derived from authenticated user relationships. Frontend-sent `salesRepId`, `officeId`, `warehouseId`, and `routeId` are not trusted for Sales Rep-scoped order creation.
- `GET /api/orders`: Sales Rep users are scoped to their linked Sales Rep.
- `GET /api/orders/:id`: Sales Rep users are scoped to their linked Sales Rep.
- `GET /api/orders/catalogue-products`: product catalogue for order entry.
- `POST /api/orders/quote-items`: backend-authoritative item pricing and discount quote.
- Customer create/update accepts `routeId` and persists it as the primary active route assignment.
- Route list/detail responses are scoped for Sales Rep users.
- Sales Rep create/update accepts `warehouseId`.
- User creation and role assignment validate role presence and privileged role assignment.

## Permission Changes

No new permission architecture was introduced. Frontend navigation and route guards consume the permissions already returned for the authenticated user. Backend controllers continue to enforce permissions with the existing guards.

## Order Creation Flow

For a Sales Rep creating an order:

```text
authenticated user
  -> Sales Rep
  -> Office
  -> primary warehouse
  -> selected Customer
  -> customer's primary active Route
```

The backend rejects invalid relationships, missing primary warehouse, missing primary active route, customer office mismatch, route office mismatch, and customer assignment to another Sales Rep.

## Route Assignment Behavior

Customers can belong to multiple routes because `RouteCustomer` uses a composite route/customer key. The app now treats one active assignment as primary. Customer create/update sets the selected route as the primary active assignment and clears other active primary flags for that customer.

## Warehouse Relationship

Sales Reps now have one linked primary warehouse. The backend validates that an office-bound warehouse belongs to the Sales Rep office.

## Tests Performed

- `npm run prisma:validate`
- `npm run prisma:generate`
- `npm run build -w backend`
- `npm run build -w frontend`
- `npm run lint -w backend`
- `npm run lint -w frontend`
- `npm run build`
- `npm run --workspaces --if-present test`

## Deployment Notes

Run `backend/sql/016_sales_rep_warehouse_primary_route.sql` manually before deploying backend code that expects the new columns. Then run `npm run prisma:generate`, `npm run prisma:validate`, `npm run lint`, and `npm run build`.
