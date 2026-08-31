# Change Plan

## Recovery baseline

This plan is based on the current source tree, including its uncommitted implementation. It does not assume an earlier development session. The principal requested code changes are already present in the working tree and should be validated and healed in small batches rather than rewritten.

## Batch 1 — establish a safe baseline

1. Preserve all existing uncommitted files.
2. Validate Prisma schema against SQL scripts 016 and 017; do not execute destructive or data-reset operations.
3. Run backend and frontend type/build/lint commands and record failures.
4. Resolve only failures attributable to the current requested work.

## Batch 2 — authorization and navigation

1. Verify the permission-tagged sidebar configuration produces the intended Sales Rep navigation: Dashboard, Orders, Sales Invoices, Sales Targets, Commissions, and only other explicitly granted operational pages.
2. Verify frontend `PermissionGate` denies direct URLs while preserving Super Admin access.
3. Verify guarded API routes return 403 for a user lacking the declared permission.
4. Review the privileged role-assignment policy in `UsersService`; prevent non-privileged users from assigning system/administrative roles.

## Batch 3 — Sales Rep operational context

1. Validate each Sales Rep has an active linked Sales Rep record, office, and primary warehouse.
2. Apply SQL 016 manually in the target MySQL environment before using the new Prisma relations; inspect its backfill result rather than overwriting assignments.
3. Test that order creation derives Sales Rep, office, warehouse, and primary customer route from server context and rejects an unlinked Sales Rep, cross-office customer, or customer without a primary route.
4. Test list/read scoping for Sales Rep orders, customers, and routes; extend scopes only where tests reveal an exposed operational record.

## Batch 4 — order item entry and pricing

1. Test `orders/catalogue-products` and `orders/quote-items` with a customer and products.
2. Verify product/quantity add, duplicate blocking, quantity changes, removal, discounts, totals, and the backend final recalculation.
3. Verify packaging/bulk behaviour remains supported by the existing order DTO/service where configured.
4. Test the responsive desktop table and mobile card presentation.

## Batch 5 — customer route selection

1. Test the route selector for Sales Rep, office/branch users, and Super Admin.
2. Verify `RouteCustomer.isPrimary` leaves exactly one active primary route for the customer and retains historical/non-primary assignments as intended.
3. Confirm geo fields remain available for any field-visit feature while absent from ordinary customer create/edit UI.
4. Verify order route derivation follows the customer primary route.

## Batch 6 — user roles and audit trail

1. Test role checkboxes load and save multiple valid role IDs for authorized administrators.
2. Test the at-least-one-role rule and privilege-escalation protection.
3. Check audit records for user role changes, customer route changes, order creation, and order item changes.

## Acceptance checks

- Super Admin sees and accesses administration; Sales Rep/non-admin users do not unless permission is explicitly granted.
- Direct frontend routes show Access Denied and unauthorized backend endpoints return 403.
- A Sales Rep cannot spoof sensitive order relationships through request JSON.
- Order pricing and totals originate from backend logic; raw JSON item entry is gone.
- Roles use checkboxes, not manually typed role IDs.
- Customer route selection is scoped and validated server-side.
- Desktop, tablet, and mobile workflows remain usable.

## Assumptions recorded for validation

- A Sales Rep's `warehouseId` is its primary warehouse; it must belong to the Sales Rep office when office-linked.
- A customer has one active primary route despite `RouteCustomer` retaining a many-to-many history/assignment shape.
- Existing MySQL data is preserved by additive SQL/backfill scripts only.
