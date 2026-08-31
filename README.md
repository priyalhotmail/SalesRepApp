# Sales Distribution Management System

Full-stack MVP + Version 1.0 implementation for sales, distribution, inventory, delivery, credit and collection management.

## Stack

- Frontend: React, TypeScript, Vite, Material UI
- Backend: NestJS, TypeScript
- Database: MySQL
- ORM: Prisma
- API: REST
- Auth: JWT with role-based access control
- Mobile: responsive UI with PWA-ready structure

## Project Structure

```text
.
├── backend/          # NestJS API and Prisma setup
├── frontend/         # Vite React app
├── docker-compose.yml
├── package.json
└── tsconfig.base.json
```

## Phase 1 Setup

Install dependencies:

```bash
npm install
```

Copy environment files:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Start MySQL with Docker, if you want a local database container:

```bash
docker compose up -d mysql
```

Create the database manually if you are not using Docker:

```sql
CREATE DATABASE IF NOT EXISTS sales_distribution_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Create a dedicated local MySQL user for the app:

```sql
CREATE USER IF NOT EXISTS 'sales_app'@'localhost'
  IDENTIFIED BY 'change_me';

GRANT ALL PRIVILEGES ON sales_distribution_db.* TO 'sales_app'@'localhost';

FLUSH PRIVILEGES;
```

Generate the Prisma client:

```bash
npm run prisma:generate
```

### Prisma Engine Download Troubleshooting

If Prisma fails with `unable to get local issuer certificate` while downloading
`schema-engine.exe`, Node does not trust the TLS certificate chain used by your
network/proxy. Export your company/root CA certificate as a Base-64 `.cer` or
`.pem` file, then configure Node/npm to use it:

```cmd
npm config set cafile "C:\path\to\company-root-ca.pem"
set NODE_EXTRA_CA_CERTS=C:\path\to\company-root-ca.pem
```

Then approve pending package install scripts and retry:

```cmd
npm approve-scripts --allow-scripts-pending
npm install
npm run prisma:generate
```

Approve the pending scripts for `prisma`, `@prisma/client`, `@prisma/engines`,
and `esbuild` when prompted. Avoid disabling TLS verification globally.

Run both apps in development mode:

```bash
npm run dev
```

Backend health check:

```text
GET http://localhost:3000/api/health
```

Frontend:

```text
http://localhost:5173
```

## Migration Policy

The user will manually run MySQL/Prisma migration scripts. Each phase will include:

- Prisma schema changes
- Manual SQL notes/scripts
- Seed data notes/scripts
- Commands to validate generated files

Phase 1 only creates the database shell and Prisma connection setup. Domain tables begin in Phase 2.

## Phase 2 Auth Setup

Run the Phase 2 schema and seed scripts after Phase 1:

```cmd
mysql -u root -p sales_distribution_db < backend\sql\002_phase2_auth_schema.sql
mysql -u root -p sales_distribution_db < backend\sql\003_phase2_seed_auth.sql
```

Or run the same scripts from inside the MySQL shell:

```sql
USE sales_distribution_db;

SOURCE backend/sql/002_phase2_auth_schema.sql;
SOURCE backend/sql/003_phase2_seed_auth.sql;
```

Useful verification queries:

```sql
SELECT id, email, display_name, status
FROM users
ORDER BY id;

SELECT id, code, name, is_system, status
FROM roles
ORDER BY id;

SELECT id, code, module
FROM permissions
ORDER BY module, code;

SELECT r.code AS role_code, p.code AS permission_code
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
ORDER BY r.code, p.code;

SELECT u.email, r.code AS role_code
FROM user_roles ur
JOIN users u ON u.id = ur.user_id
JOIN roles r ON r.id = ur.role_id
ORDER BY u.email, r.code;

SELECT action, entity_type, entity_id, created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 20;
```

Regenerate Prisma Client after schema changes:

```cmd
npm run prisma:generate
```

Default seeded admin:

```text
Email: admin@sales.local
Password: Admin@12345
```

Initial API routes:

```text
POST   /api/auth/login
GET    /api/auth/me
GET    /api/users
POST   /api/users
GET    /api/users/:id
PATCH  /api/users/:id
DELETE /api/users/:id
PUT    /api/users/:id/roles
GET    /api/roles
POST   /api/roles
GET    /api/roles/:id
PATCH  /api/roles/:id
DELETE /api/roles/:id
PUT    /api/roles/:id/permissions
GET    /api/permissions
GET    /api/audit-logs
```

## Phase 3 Company, Sales Rep, and Customer Setup

Run the Phase 3 schema and seed scripts after Phase 2:

```cmd
mysql -u root -p sales_distribution_db < backend\sql\004_phase3_company_customer_schema.sql
mysql -u root -p sales_distribution_db < backend\sql\005_phase3_seed_company_customer.sql
```

Regenerate Prisma Client after the schema changes. Stop any running `npm run dev`
process first on Windows, otherwise Prisma may fail to replace
`query_engine-windows.dll.node`:

```cmd
npm run prisma:generate
```

New Phase 3 API routes:

```text
GET    /api/companies/current
PATCH  /api/companies/current

GET    /api/offices
POST   /api/offices
PATCH  /api/offices/:id
DELETE /api/offices/:id

GET    /api/factories
POST   /api/factories
PATCH  /api/factories/:id
DELETE /api/factories/:id

GET    /api/warehouses
POST   /api/warehouses
PATCH  /api/warehouses/:id
DELETE /api/warehouses/:id

GET    /api/sales-reps
POST   /api/sales-reps
GET    /api/sales-reps/:id
PATCH  /api/sales-reps/:id
DELETE /api/sales-reps/:id

GET    /api/customers
POST   /api/customers
GET    /api/customers/:id
PATCH  /api/customers/:id
DELETE /api/customers/:id
POST   /api/customers/:id/change-requests
GET    /api/customers/:id/history

GET    /api/customer-change-requests
POST   /api/customer-change-requests/:id/approve
POST   /api/customer-change-requests/:id/reject
```

## API Payload Examples

Use this header for every protected API after login:

```text
Authorization: Bearer <accessToken>
Content-Type: application/json
```

### Auth

`POST /api/auth/login`

```json
{
  "email": "admin@sales.local",
  "password": "Admin@12345"
}
```

### Users

`POST /api/users`

```json
{
  "email": "salesrep1@sales.local",
  "displayName": "Sales Rep One",
  "password": "Sales12345",
  "telephone": "0771234567",
  "roleIds": [6]
}
```

`PATCH /api/users/:id`

```json
{
  "displayName": "Sales Rep One Updated",
  "telephone": "0777654321",
  "status": "ACTIVE"
}
```

`PUT /api/users/:id/roles`

```json
{
  "roleIds": [6]
}
```

`DELETE /api/users/:id`

```text
No request body. This performs a soft delete.
```

### Roles

`POST /api/roles`

```json
{
  "code": "TEST_ROLE",
  "name": "Test Role",
  "description": "Temporary role for API testing",
  "permissionIds": [12]
}
```

`PATCH /api/roles/:id`

```json
{
  "name": "Updated Test Role",
  "description": "Updated role description",
  "status": "ACTIVE"
}
```

`PUT /api/roles/:id/permissions`

```json
{
  "permissionIds": [1, 6, 11, 12]
}
```

`DELETE /api/roles/:id`

```text
No request body. This performs a soft delete. System roles cannot be deleted.
```

### Company

`PATCH /api/companies/current`

```json
{
  "name": "Default Company",
  "registrationNumber": "REG-001",
  "vatRegistrationNumber": "VAT-001",
  "address": "Main business address",
  "email": "info@sales.local",
  "telephone": "0110000000"
}
```

### Offices

`POST /api/offices`

```json
{
  "companyId": 1,
  "code": "BR-001",
  "name": "Branch Office One",
  "officeType": "BRANCH",
  "address": "Branch address",
  "email": "branch1@sales.local",
  "contactPerson": "Branch Manager",
  "telephone": "0111111111"
}
```

`PATCH /api/offices/:id`

```json
{
  "name": "Branch Office One Updated",
  "officeType": "BRANCH",
  "address": "Updated branch address",
  "email": "branch1@sales.local",
  "contactPerson": "Updated Manager",
  "telephone": "0111111112",
  "status": "ACTIVE"
}
```

`DELETE /api/offices/:id`

```text
No request body. This performs a soft delete if the office has no active warehouses, sales reps, or customers.
```

### Factories

`POST /api/factories`

```json
{
  "companyId": 1,
  "code": "FAC-002",
  "name": "Factory Two",
  "address": "Factory address",
  "email": "factory2@sales.local",
  "contactPerson": "Factory Manager",
  "telephone": "0112222222"
}
```

`PATCH /api/factories/:id`

```json
{
  "name": "Factory Two Updated",
  "address": "Updated factory address",
  "email": "factory2@sales.local",
  "contactPerson": "Updated Factory Manager",
  "telephone": "0112222223",
  "status": "ACTIVE"
}
```

`DELETE /api/factories/:id`

```text
No request body. This performs a soft delete if the factory has no active warehouses.
```

### Warehouses

`POST /api/warehouses` for an office warehouse:

```json
{
  "companyId": 1,
  "officeId": 1,
  "code": "WH-BR-001",
  "name": "Branch Warehouse One",
  "warehouseType": "BRANCH",
  "address": "Branch warehouse address",
  "email": "wh.branch1@sales.local",
  "contactPerson": "Warehouse Manager",
  "telephone": "0113333333"
}
```

`POST /api/warehouses` for a factory final-product warehouse:

```json
{
  "companyId": 1,
  "factoryId": 1,
  "code": "WH-FAC-002",
  "name": "Factory Two Final Product Warehouse",
  "warehouseType": "FACTORY_FINAL_PRODUCT",
  "address": "Factory warehouse address",
  "email": "wh.factory2@sales.local",
  "contactPerson": "Factory Warehouse Manager",
  "telephone": "0113333334"
}
```

`PATCH /api/warehouses/:id`

```json
{
  "name": "Branch Warehouse One Updated",
  "warehouseType": "BRANCH",
  "officeId": 1,
  "address": "Updated warehouse address",
  "email": "wh.branch1@sales.local",
  "contactPerson": "Updated Warehouse Manager",
  "telephone": "0113333335",
  "status": "ACTIVE"
}
```

`DELETE /api/warehouses/:id`

```text
No request body. This performs a soft delete.
```

### Sales Reps

`POST /api/sales-reps`

```json
{
  "officeId": 1,
  "userId": 2,
  "code": "SR-001",
  "name": "Sales Rep One",
  "nic": "900000000V",
  "address": "Sales rep address",
  "telephone": "0771234567",
  "email": "salesrep1@sales.local"
}
```

`PATCH /api/sales-reps/:id`

```json
{
  "officeId": 1,
  "userId": 2,
  "name": "Sales Rep One Updated",
  "nic": "900000000V",
  "address": "Updated sales rep address",
  "telephone": "0777654321",
  "email": "salesrep1@sales.local",
  "status": "ACTIVE"
}
```

`DELETE /api/sales-reps/:id`

```text
No request body. This performs a soft delete if the sales rep has no active customers.
```

### Customers

`POST /api/customers` for a business customer:

```json
{
  "officeId": 1,
  "salesRepId": 1,
  "code": "CUS-B-001",
  "customerType": "BUSINESS",
  "displayName": "ABC Traders",
  "registrationNumber": "BR-1001",
  "vatRegistrationNumber": "VAT-1001",
  "address": "Customer business address",
  "telephone": "0114444444",
  "contactPerson": "Customer Contact",
  "email": "abc@example.com"
}
```

`POST /api/customers` for an individual customer:

```json
{
  "officeId": 1,
  "salesRepId": 1,
  "code": "CUS-I-001",
  "customerType": "INDIVIDUAL",
  "displayName": "Individual Customer One",
  "nic": "910000000V",
  "vatRegistrationNumber": "VAT-2001",
  "address": "Customer home address",
  "telephone": "0774444444",
  "email": "customer@example.com"
}
```

`PATCH /api/customers/:id`

```json
{
  "officeId": 1,
  "salesRepId": 1,
  "displayName": "ABC Traders Updated",
  "registrationNumber": "BR-1001",
  "vatRegistrationNumber": "VAT-1001",
  "address": "Updated customer address",
  "telephone": "0115555555",
  "contactPerson": "Updated Contact",
  "email": "abc.updated@example.com",
  "status": "ACTIVE"
}
```

`POST /api/customers/:id/change-requests`

```json
{
  "requestedChanges": {
    "address": "Requested new customer address",
    "telephone": "0116666666",
    "contactPerson": "Requested Contact"
  },
  "reason": "Customer information changed during field visit"
}
```

`POST /api/customer-change-requests/:id/approve`

```json
{
  "reviewNote": "Verified with customer and approved"
}
```

`POST /api/customer-change-requests/:id/reject`

```json
{
  "reviewNote": "Supporting information is not sufficient"
}
```

`DELETE /api/customers/:id`

```text
No request body. This performs a soft delete.
```

Useful Phase 3 verification queries:

```sql
SELECT id, name, registration_number, status
FROM companies;

SELECT id, code, name, office_type, status
FROM offices
ORDER BY id;

SELECT id, code, name, status
FROM factories
ORDER BY id;

SELECT id, code, name, warehouse_type, office_id, factory_id, status
FROM warehouses
ORDER BY id;

SELECT id, code, name, office_id, user_id, status
FROM sales_reps
ORDER BY id;

SELECT id, code, customer_type, display_name, office_id, sales_rep_id, status
FROM customers
ORDER BY id;

SELECT id, customer_id, status, requested_changes, created_at
FROM customer_change_requests
ORDER BY created_at DESC;

SELECT id, customer_id, change_request_id, changed_at
FROM customer_change_history
ORDER BY changed_at DESC;
```

## Phase 4 Product, Pricing, and Discount Setup

Run the Phase 4 schema and seed scripts after Phase 3:

```cmd
mysql -u root -p sales_distribution_db < backend\sql\006_phase4_product_pricing_discount_schema.sql
mysql -u root -p sales_distribution_db < backend\sql\007_phase4_seed_product_pricing_discount.sql
```

Stop any running `npm run dev` process first on Windows, then regenerate Prisma Client:

```cmd
npm run prisma:generate
npm run dev
```

New Phase 4 API routes:

```text
GET/POST     /api/product-groups
PATCH/DELETE /api/product-groups/:id
GET/POST     /api/products
GET/PATCH/DELETE /api/products/:id
POST         /api/products/:id/packaging-options
PATCH        /api/packaging-options/:id
PUT          /api/products/:id/factories
POST         /api/products/calculate-packaging

GET/POST     /api/customer-groups
PATCH        /api/customer-groups/:id
PUT          /api/customer-groups/:id/customers
GET/POST     /api/price-lists
PATCH/DELETE /api/price-lists/:id
POST         /api/price-lists/:id/activate
PUT          /api/price-lists/:id/items
POST         /api/price-lists/:id/assignments
POST         /api/pricing/resolve

GET/POST     /api/discounts/classes
PATCH/DELETE /api/discounts/classes/:id
POST         /api/discounts/customer-assignments
GET/POST     /api/discounts/seasonal
PATCH/DELETE /api/discounts/seasonal/:id
GET/POST     /api/discounts/free-item-offers
PATCH/DELETE /api/discounts/free-item-offers/:id
POST         /api/discounts/additional-bill/request
GET          /api/discounts/additional-bill/requests
POST         /api/discounts/additional-bill/:id/approve
POST         /api/discounts/additional-bill/:id/reject
POST         /api/discounts/calculate
```

### Phase 4 Payload Examples

`POST /api/product-groups`

```json
{
  "code": "SOAP",
  "name": "Soap",
  "description": "Soap products"
}
```

`PATCH /api/product-groups/:id`

```json
{
  "name": "Soap Updated",
  "description": "Updated description",
  "status": "ACTIVE"
}
```

`POST /api/products`

```json
{
  "productGroupId": 1,
  "code": "SOAP-115G",
  "name": "115g Soap",
  "price": 50,
  "capacity": 115,
  "unitType": "GM",
  "supportsBulk": true
}
```

`PATCH /api/products/:id`

```json
{
  "name": "115g Soap Updated",
  "price": 55,
  "capacity": 115,
  "unitType": "GM",
  "supportsBulk": true,
  "status": "ACTIVE"
}
```

`POST /api/products/:id/packaging-options`

```json
{
  "name": "Box",
  "unitQuantity": 120,
  "isDefault": false
}
```

`PATCH /api/packaging-options/:id`

```json
{
  "name": "Box",
  "unitQuantity": 120,
  "isDefault": true,
  "status": "ACTIVE"
}
```

`PUT /api/products/:id/factories`

```json
{
  "factoryIds": [1]
}
```

`POST /api/products/calculate-packaging`

```json
{
  "quantity": 600,
  "unitsPerPackage": 120
}
```

`POST /api/customer-groups`

```json
{
  "code": "WHOLESALE",
  "name": "Wholesale Customers",
  "description": "Customers with wholesale pricing"
}
```

`PUT /api/customer-groups/:id/customers`

```json
{
  "customerIds": [1]
}
```

`POST /api/price-lists`

```json
{
  "companyId": 1,
  "code": "BASE-2026",
  "name": "Base Price List 2026",
  "effectiveFrom": "2026-01-01T00:00:00.000Z"
}
```

`PATCH /api/price-lists/:id`

```json
{
  "name": "Base Price List 2026 Updated",
  "effectiveFrom": "2026-01-01T00:00:00.000Z",
  "effectiveTo": "2026-12-31T23:59:59.000Z",
  "status": "ACTIVE"
}
```

`PUT /api/price-lists/:id/items`

```json
{
  "productId": 1,
  "unitPrice": 50
}
```

`POST /api/price-lists/:id/assignments`

```json
{
  "scope": "GLOBAL"
}
```

Other assignment scopes:

```json
{
  "scope": "CUSTOMER",
  "customerId": 1
}
```

```json
{
  "scope": "CUSTOMER_GROUP",
  "customerGroupId": 1
}
```

```json
{
  "scope": "OFFICE",
  "officeId": 1
}
```

`POST /api/pricing/resolve`

```json
{
  "productId": 1,
  "customerId": 1,
  "officeId": 1,
  "pricingDate": "2026-06-24T00:00:00.000Z"
}
```

`POST /api/discounts/classes`

```json
{
  "code": "STANDARD",
  "name": "Standard Customer Discount",
  "discountPercentage": 2.5
}
```

`PATCH /api/discounts/classes/:id`

```json
{
  "name": "Standard Customer Discount Updated",
  "discountPercentage": 3,
  "status": "ACTIVE"
}
```

`POST /api/discounts/customer-assignments`

```json
{
  "customerId": 1,
  "discountClassId": 1,
  "effectiveFrom": "2026-01-01T00:00:00.000Z"
}
```

`POST /api/discounts/seasonal`

```json
{
  "productId": 1,
  "name": "Seasonal Soap Discount",
  "valueType": "PERCENTAGE",
  "value": 5,
  "validFrom": "2026-01-01T00:00:00.000Z",
  "validTo": "2026-12-31T23:59:59.000Z"
}
```

`POST /api/discounts/free-item-offers`

```json
{
  "productId": 1,
  "name": "Buy 12 Get 1 Free",
  "buyQuantity": 12,
  "freeQuantity": 1,
  "validFrom": "2026-01-01T00:00:00.000Z",
  "validTo": "2026-12-31T23:59:59.000Z"
}
```

`POST /api/discounts/additional-bill/request`

```json
{
  "customerId": 1,
  "discountPercentage": 4,
  "reason": "Special promotion for this customer"
}
```

`POST /api/discounts/additional-bill/:id/approve`

```json
{
  "reviewNote": "Approved for this order"
}
```

`POST /api/discounts/additional-bill/:id/reject`

```json
{
  "reviewNote": "Discount is too high"
}
```

`POST /api/discounts/calculate`

```json
{
  "customerId": 1,
  "additionalDiscountRequestId": 1,
  "cashPaymentSelected": true,
  "cashDiscountPercentage": 1,
  "calculationDate": "2026-06-24T00:00:00.000Z",
  "lines": [
    {
      "productId": 1,
      "quantity": 12,
      "unitPrice": 50
    }
  ]
}
```

DELETE endpoints in Phase 4 do not require request bodies. They perform soft deletes.

Useful Phase 4 verification queries:

```sql
SELECT id, code, name, status
FROM product_groups
ORDER BY id;

SELECT id, code, name, price, capacity, unit_type, supports_bulk, status
FROM products
ORDER BY id;

SELECT id, product_id, name, unit_quantity, is_default, status
FROM product_packaging_options
ORDER BY id;

SELECT id, code, name, effective_from, effective_to, status
FROM price_lists
ORDER BY id;

SELECT id, price_list_id, product_id, unit_price
FROM price_list_items
ORDER BY id;

SELECT id, price_list_id, scope, customer_id, customer_group_id, office_id
FROM price_list_assignments
ORDER BY id;

SELECT id, code, name, discount_percentage, status
FROM discount_classes
ORDER BY id;

SELECT id, product_id, name, value_type, value, valid_from, valid_to, status
FROM seasonal_discounts
ORDER BY id;

SELECT id, product_id, name, buy_quantity, free_quantity, valid_from, valid_to, status
FROM free_item_offers
ORDER BY id;

SELECT id, customer_id, discount_percentage, status, created_at
FROM additional_bill_discount_requests
ORDER BY created_at DESC;
```

## Phase 5 Inventory, Routes, Orders, and Loading Reports

Run the Phase 5 schema and seed scripts after Phase 4:

```cmd
mysql -u root -p sales_distribution_db < backend\sql\008_phase5_inventory_routes_orders_schema.sql
mysql -u root -p sales_distribution_db < backend\sql\009_phase5_seed_inventory_routes_orders.sql
```

Stop any running `npm run dev` process first on Windows, then regenerate Prisma Client:

```cmd
npm run prisma:generate
npm run dev
```

New Phase 5 API routes:

```text
GET          /api/inventory/stocks
GET          /api/inventory/movements
GET          /api/inventory/reservations
POST         /api/inventory/stocks/adjust
POST         /api/inventory/reservations
POST         /api/inventory/reservations/:id/release

GET/POST     /api/routes
GET/PATCH/DELETE /api/routes/:id
PUT          /api/routes/:id/customers
POST         /api/routes/:id/schedules
PATCH        /api/route-schedules/:id

GET/POST     /api/orders
GET/PATCH    /api/orders/:id
POST         /api/orders/:id/approve
POST         /api/orders/:id/reserve-stock
POST         /api/orders/:id/cancel
POST         /api/orders/:id/amendment-requests
GET          /api/order-amendment-requests
POST         /api/order-amendment-requests/:id/approve
POST         /api/order-amendment-requests/:id/reject

GET          /api/reports/loading
GET          /api/reports/loading/item-summary
GET          /api/reports/loading/customer-detail
```

### Phase 5 Payload Examples

`POST /api/inventory/stocks/adjust`

```json
{
  "warehouseId": 1,
  "productId": 1,
  "quantityChange": 500,
  "lowStockThreshold": 100,
  "notes": "Manual stock receipt"
}
```

Use a negative `quantityChange` for stock corrections. The API blocks adjustments that would make stock on hand negative or lower than reserved stock.

`POST /api/inventory/reservations`

```json
{
  "warehouseId": 1,
  "productId": 1,
  "orderId": 1,
  "quantity": 12,
  "notes": "Manual reservation for order"
}
```

`POST /api/inventory/reservations/:id/release`

```json
{
  "notes": "Reservation released before order amendment"
}
```

`POST /api/routes`

```json
{
  "officeId": 1,
  "code": "ROUTE-MAIN-02",
  "name": "Main Route 02",
  "description": "Colombo city route"
}
```

`PATCH /api/routes/:id`

```json
{
  "name": "Main Route 02 Updated",
  "description": "Updated route description",
  "status": "ACTIVE"
}
```

`PUT /api/routes/:id/customers`

```json
{
  "customerIds": [1, 2]
}
```

`POST /api/routes/:id/schedules`

```json
{
  "dayOfWeek": "MONDAY",
  "plannedTime": "08:00"
}
```

`PATCH /api/route-schedules/:id`

```json
{
  "plannedTime": "09:30",
  "status": "ACTIVE"
}
```

`POST /api/orders`

```json
{
  "customerId": 1,
  "orderDate": "2026-06-25T00:00:00.000Z",
  "notes": "Customer requested morning delivery",
  "items": [
    {
      "productId": 1,
      "quantity": 12
    }
  ]
}
```

If `orderNumber` is not provided, the API generates one. For Sales Rep users, the API derives `salesRepId`, `officeId`, `warehouseId`, and `routeId` from the authenticated user's linked Sales Rep, that Sales Rep's office and primary warehouse, the selected customer, and the customer's primary active route. These IDs must not be trusted from the frontend payload.

Order pricing remains backend-authoritative. The frontend order editor sends product and quantity, may call `POST /api/orders/quote-items` for display, and the backend recalculates unit prices, discounts, free quantities, and totals during order creation/update.

Order entry support endpoints:

```text
GET  /api/orders/catalogue-products
POST /api/orders/quote-items
```

`PATCH /api/orders/:id`

```json
{
  "routeId": 1,
  "warehouseId": 1,
  "notes": "Updated delivery note",
  "items": [
    {
      "productId": 1,
      "quantity": 24,
      "freeQuantity": 2,
      "unitPrice": 50,
      "discountAmount": 50
    }
  ]
}
```

Orders can be updated only while `DRAFT` or `SUBMITTED`, and only when they have no active stock reservations.

`POST /api/orders/:id/approve`

```json
{}
```

`POST /api/orders/:id/reserve-stock`

```json
{}
```

This reserves `quantity + freeQuantity` for each order line from the selected warehouse.

`POST /api/orders/:id/cancel`

```json
{}
```

Cancelling an order releases active stock reservations and marks those reservations as `CANCELLED`.

`POST /api/orders/:id/amendment-requests`

```json
{
  "requestedChanges": {
    "notes": "Customer requested a new delivery note",
    "items": [
      {
        "productId": 1,
        "quantity": 18,
        "freeQuantity": 1,
        "unitPrice": 50,
        "discountAmount": 25
      }
    ]
  },
  "reason": "Customer changed quantity after order submission"
}
```

Supported amendment fields are `notes`, `routeId`, `warehouseId`, and `items`. Item amendments require no active reservations.

`POST /api/order-amendment-requests/:id/approve`

```json
{
  "reviewNote": "Approved after checking stock and pricing"
}
```

`POST /api/order-amendment-requests/:id/reject`

```json
{
  "reviewNote": "Requested quantity is not available"
}
```

Loading reports use query parameters:

```text
GET /api/reports/loading?date=2026-06-25&routeId=1&warehouseId=1
GET /api/reports/loading/item-summary?date=2026-06-25
GET /api/reports/loading/customer-detail?date=2026-06-25
```

Useful Phase 5 verification queries:

```sql
SELECT id, warehouse_id, product_id, on_hand_quantity, reserved_quantity, low_stock_threshold
FROM inventory_stocks
ORDER BY id;

SELECT id, warehouse_id, product_id, movement_type, quantity, balance_after, reference_type, reference_id, created_at
FROM inventory_movements
ORDER BY created_at DESC;

SELECT id, warehouse_id, product_id, order_id, quantity, status, created_at, released_at
FROM stock_reservations
ORDER BY created_at DESC;

SELECT id, code, name, office_id, status
FROM routes
ORDER BY id;

SELECT route_id, customer_id, assigned_at
FROM route_customers
ORDER BY route_id, customer_id;

SELECT id, route_id, day_of_week, planned_time, status
FROM route_schedules
ORDER BY route_id, day_of_week;

SELECT id, order_number, customer_id, sales_rep_id, route_id, warehouse_id, status, subtotal, discount_total, total_amount
FROM orders
ORDER BY id DESC;

SELECT id, order_id, product_id, quantity, free_quantity, unit_price, discount_amount, line_total
FROM order_items
ORDER BY order_id, id;

SELECT id, order_id, status, requested_changes, created_at, reviewed_at
FROM order_amendment_requests
ORDER BY created_at DESC;
```

## Phase 6 Delivery, Invoices, Payments, Cheques, Returns, and Credit Control

Run the Phase 6 schema and seed scripts after Phase 5:

```cmd
mysql -u root -p sales_distribution_db < backend\sql\010_phase6_delivery_invoice_payment_credit_schema.sql
mysql -u root -p sales_distribution_db < backend\sql\011_phase6_seed_delivery_invoice_payment_credit.sql
```

Stop any running `npm run dev` process first on Windows, then regenerate Prisma Client:

```cmd
npm run prisma:generate
npm run dev
```

New Phase 6 API routes:

```text
GET/POST     /api/deliveries
GET          /api/deliveries/:id
POST         /api/deliveries/:id/dispatch
POST         /api/deliveries/:id/confirm
POST         /api/deliveries/:id/cancel

GET          /api/sales-invoices
GET          /api/sales-invoices/:id
POST         /api/sales-invoices/from-order
POST         /api/sales-invoices/:id/cancel

GET/POST     /api/payments
GET          /api/payments/:id
POST         /api/payments/:id/cancel

GET          /api/cheques
GET          /api/cheques/:id
POST         /api/cheques/:id/deposit
POST         /api/cheques/:id/realize
POST         /api/cheques/:id/return

GET/POST     /api/returns
GET          /api/returns/:id
POST         /api/returns/:id/approve
POST         /api/returns/:id/reject
POST         /api/returns/:id/receive

GET          /api/credit-control/customers/:id/summary
PATCH        /api/credit-control/customers/:id/settings
POST         /api/credit-control/check-order
GET          /api/credit-control/aging
GET/POST     /api/credit-control/override-requests
POST         /api/credit-control/override-requests/:id/approve
POST         /api/credit-control/override-requests/:id/reject
```

### Phase 6 Payload Examples

`POST /api/deliveries`

```json
{
  "orderId": 1,
  "deliveryDate": "2026-06-25T00:00:00.000Z",
  "driverName": "Driver One",
  "vehicleNumber": "WP-ABC-1234",
  "notes": "Morning delivery"
}
```

The order must be `RESERVED`.

`POST /api/deliveries/:id/dispatch`

```json
{}
```

`POST /api/deliveries/:id/confirm`

```json
{
  "receivedBy": "Customer Contact",
  "proofNotes": "Signed delivery note received",
  "items": [
    {
      "deliveryItemId": 1,
      "deliveredQuantity": 13,
      "rejectedQuantity": 0,
      "notes": "Delivered in good condition"
    }
  ]
}
```

Delivery confirmation consumes delivered stock reservations and releases undelivered quantities.

`POST /api/sales-invoices/from-order`

```json
{
  "orderId": 1,
  "invoiceDate": "2026-06-25T00:00:00.000Z",
  "notes": "Invoice generated after delivery"
}
```

If `dueDate` is omitted, it uses the customer's `creditTermsDays`.

`POST /api/payments` for cash:

```json
{
  "customerId": 1,
  "salesInvoiceId": 1,
  "paymentDate": "2026-06-25T00:00:00.000Z",
  "method": "CASH",
  "amount": 500,
  "notes": "Cash collected by sales rep"
}
```

`POST /api/payments` for cheque:

```json
{
  "customerId": 1,
  "salesInvoiceId": 1,
  "paymentDate": "2026-06-25T00:00:00.000Z",
  "method": "CHEQUE",
  "amount": 500,
  "notes": "Cheque collected",
  "cheque": {
    "chequeNumber": "CHQ-10001",
    "bankName": "Sample Bank",
    "branchName": "Main Branch",
    "chequeDate": "2026-06-30T00:00:00.000Z"
  }
}
```

Cheque payments reduce invoice balance only after `POST /api/cheques/:id/realize`.

`POST /api/cheques/:id/deposit`

```json
{}
```

`POST /api/cheques/:id/realize`

```json
{}
```

`POST /api/cheques/:id/return`

```json
{
  "returnedReason": "Insufficient funds"
}
```

`POST /api/returns`

```json
{
  "customerId": 1,
  "orderId": 1,
  "salesInvoiceId": 1,
  "returnDate": "2026-06-25T00:00:00.000Z",
  "reason": "Damaged goods",
  "notes": "Customer returned items during delivery follow-up",
  "items": [
    {
      "productId": 1,
      "quantity": 2,
      "unitPrice": 50,
      "notes": "Damaged packs"
    }
  ]
}
```

`POST /api/returns/:id/approve`

```json
{
  "reviewNote": "Approved after checking photo evidence"
}
```

`POST /api/returns/:id/receive`

```json
{
  "warehouseId": 1,
  "reviewNote": "Returned goods received into warehouse"
}
```

Receiving a return increases stock and reduces linked invoice balance.

`PATCH /api/credit-control/customers/:id/settings`

```json
{
  "creditLimit": 50000,
  "creditHold": false,
  "creditTermsDays": 30
}
```

`POST /api/credit-control/check-order`

```json
{
  "orderId": 1
}
```

Or:

```json
{
  "customerId": 1,
  "orderAmount": 10000
}
```

`POST /api/credit-control/override-requests`

```json
{
  "customerId": 1,
  "orderId": 1,
  "reason": "Long-term customer approved by manager"
}
```

`POST /api/credit-control/override-requests/:id/approve`

```json
{
  "reviewNote": "Approved for this order only"
}
```

Useful Phase 6 verification queries:

```sql
SELECT id, code, display_name, credit_limit, credit_hold, credit_terms_days
FROM customers
ORDER BY id;

SELECT id, delivery_number, order_id, customer_id, warehouse_id, status, delivery_date
FROM deliveries
ORDER BY id DESC;

SELECT id, delivery_id, product_id, ordered_quantity, delivered_quantity, rejected_quantity
FROM delivery_items
ORDER BY delivery_id, id;

SELECT id, invoice_number, order_id, customer_id, total_amount, paid_amount, return_total, balance_amount, status
FROM sales_invoices
ORDER BY id DESC;

SELECT id, payment_number, customer_id, sales_invoice_id, method, amount, status, payment_date
FROM payments
ORDER BY id DESC;

SELECT id, cheque_number, bank_name, customer_id, sales_invoice_id, amount, status
FROM cheques
ORDER BY id DESC;

SELECT id, return_number, customer_id, order_id, sales_invoice_id, total_amount, status
FROM sales_returns
ORDER BY id DESC;

SELECT id, customer_id, order_id, requested_amount, outstanding_balance, credit_limit, status
FROM credit_override_requests
ORDER BY id DESC;
```

## Phase 7 Version 1.0 Field Features

Run the Phase 7 schema and seed scripts after Phase 6:

```cmd
mysql -u root -p sales_distribution_db < backend\sql\012_phase7_v1_field_features_schema.sql
mysql -u root -p sales_distribution_db < backend\sql\013_phase7_seed_v1_field_features.sql
```

Stop any running `npm run dev` process first on Windows, then regenerate Prisma Client:

```cmd
npm run prisma:generate
npm run dev
```

New Phase 7 API routes:

```text
GET/POST     /api/sales-targets
PATCH/DELETE /api/sales-targets/:id
GET          /api/sales-targets/performance

GET/POST     /api/commissions/rules
PATCH/DELETE /api/commissions/rules/:id
GET          /api/commissions/runs
POST         /api/commissions/runs/calculate
POST         /api/commissions/runs/:id/approve
POST         /api/commissions/runs/:id/pay

GET/POST     /api/warehouse-transfers
GET          /api/warehouse-transfers/:id
POST         /api/warehouse-transfers/:id/approve
POST         /api/warehouse-transfers/:id/reject
POST         /api/warehouse-transfers/:id/dispatch
POST         /api/warehouse-transfers/:id/receive
POST         /api/warehouse-transfers/:id/cancel

GET/POST     /api/customer-visits
POST         /api/customer-visits/:id/complete
POST         /api/customer-visits/:id/missed
POST         /api/customer-visits/:id/cancel

GET          /api/customers/nearby
GET/POST     /api/attachments
DELETE       /api/attachments/:id
GET/POST     /api/notifications
GET          /api/notifications/unread-count
POST         /api/notifications/:id/read
POST         /api/notifications/mark-all-read
```

### Phase 7 Payload Examples

`POST /api/sales-targets`

```json
{
  "salesRepId": 1,
  "productId": 1,
  "targetYear": 2026,
  "targetMonth": 6,
  "revenueTarget": 250000,
  "volumeTarget": 5000,
  "notes": "June soap target"
}
```

`PATCH /api/sales-targets/:id`

```json
{
  "revenueTarget": 275000,
  "volumeTarget": 5200,
  "notes": "Adjusted after branch review",
  "status": "ACTIVE"
}
```

`GET /api/sales-targets/performance?salesRepId=1&targetYear=2026&targetMonth=6`

Returns target totals, invoiced revenue, invoiced volume, and achievement percentages.

`POST /api/commissions/rules`

```json
{
  "code": "COMM-SOAP-2026",
  "name": "Soap Commission 2026",
  "salesRepId": 1,
  "productId": 1,
  "ratePercentage": 2,
  "amountPerUnit": 0.5,
  "bonusThreshold": 250000,
  "bonusAmount": 5000,
  "effectiveFrom": "2026-01-01T00:00:00.000Z"
}
```

`PATCH /api/commissions/rules/:id`

```json
{
  "name": "Soap Commission 2026 Updated",
  "ratePercentage": 2.5,
  "amountPerUnit": 0.75,
  "bonusThreshold": 300000,
  "bonusAmount": 7500,
  "status": "ACTIVE"
}
```

`POST /api/commissions/runs/calculate`

```json
{
  "salesRepId": 1,
  "periodYear": 2026,
  "periodMonth": 6
}
```

`POST /api/commissions/runs/:id/approve`

```json
{}
```

`POST /api/commissions/runs/:id/pay`

```json
{}
```

`POST /api/warehouse-transfers`

```json
{
  "fromWarehouseId": 1,
  "toWarehouseId": 2,
  "notes": "Branch replenishment request",
  "items": [
    {
      "productId": 1,
      "requestedQuantity": 250,
      "notes": "Fast moving item"
    }
  ]
}
```

`POST /api/warehouse-transfers/:id/approve`

```json
{
  "notes": "Approved by main warehouse",
  "items": [
    {
      "productId": 1,
      "approvedQuantity": 200
    }
  ]
}
```

`POST /api/warehouse-transfers/:id/dispatch`

```json
{
  "notes": "Loaded to company vehicle"
}
```

Dispatch deducts approved stock from the source warehouse and writes `TRANSFER_DISPATCH` inventory movements.

`POST /api/warehouse-transfers/:id/receive`

```json
{
  "notes": "Received at branch warehouse",
  "items": [
    {
      "productId": 1,
      "approvedQuantity": 200
    }
  ]
}
```

Receiving increases destination stock and writes `TRANSFER_RECEIPT` inventory movements.

`POST /api/customer-visits`

```json
{
  "customerId": 1,
  "salesRepId": 1,
  "visitType": "SALES",
  "plannedAt": "2026-06-25T09:30:00.000Z",
  "notes": "Regular weekly visit"
}
```

Other `visitType` values are `COLLECTION`, `COMPLAINT`, and `DELIVERY_FOLLOW_UP`.

`POST /api/customer-visits/:id/complete`

```json
{
  "outcome": "ORDER_PLACED",
  "visitedAt": "2026-06-25T09:45:00.000Z",
  "latitude": 6.927079,
  "longitude": 79.861244,
  "geoAccuracyMeters": 12,
  "notes": "Customer placed an order"
}
```

For no-order visits:

```json
{
  "outcome": "NO_ORDER",
  "visitedAt": "2026-06-25T09:45:00.000Z",
  "noOrderReason": "Customer has enough stock",
  "latitude": 6.927079,
  "longitude": 79.861244
}
```

`POST /api/customer-visits/:id/missed`

```json
{
  "notes": "Customer shop was closed"
}
```

`PATCH /api/customers/:id` with geo data:

```json
{
  "latitude": 6.927079,
  "longitude": 79.861244,
  "geoAccuracyMeters": 10
}
```

`GET /api/customers/nearby?latitude=6.927079&longitude=79.861244&radiusKm=5`

Returns active customers with stored geo coordinates sorted by distance.

`POST /api/attachments`

```json
{
  "ownerType": "CUSTOMER",
  "ownerId": 1,
  "fileName": "vat-certificate.pdf",
  "mimeType": "application/pdf",
  "fileSize": 245760,
  "storagePath": "customers/1/vat-certificate.pdf",
  "checksum": "optional-sha256"
}
```

The Phase 7 API stores secure file metadata only. Actual binary upload/storage can be added behind this metadata contract later.

`POST /api/notifications`

```json
{
  "userId": 1,
  "title": "Transfer approved",
  "message": "Warehouse transfer WT-20260625-0001 was approved.",
  "type": "SUCCESS",
  "module": "warehouse_transfers",
  "entityType": "warehouse_transfer",
  "entityId": "1"
}
```

`POST /api/notifications/:id/read`

```json
{}
```

`POST /api/notifications/mark-all-read`

```json
{}
```

DELETE endpoints in Phase 7 do not require request bodies. They perform soft deletes where the business record should remain auditable.

Offline-first PWA support now includes a service worker shell cache and an IndexedDB sync queue foundation for creating orders, updating deliveries, capturing payments, creating returns, completing visits, and registering attachment metadata while offline. Full frontend screens will be connected to this queue in Phase 9.

Useful Phase 7 verification queries:

```sql
SELECT id, code, display_name, latitude, longitude, geo_accuracy_meters, geo_captured_at
FROM customers
ORDER BY id;

SELECT id, sales_rep_id, product_id, target_year, target_month, revenue_target, volume_target, status
FROM sales_targets
ORDER BY id DESC;

SELECT id, code, name, sales_rep_id, product_id, rate_percentage, amount_per_unit, bonus_threshold, status
FROM commission_rules
ORDER BY id DESC;

SELECT id, sales_rep_id, period_year, period_month, revenue_amount, volume_amount, commission_amount, bonus_amount, total_amount, status
FROM commission_runs
ORDER BY id DESC;

SELECT id, transfer_number, from_warehouse_id, to_warehouse_id, status, requested_at, approved_at, dispatched_at, received_at
FROM warehouse_transfers
ORDER BY id DESC;

SELECT id, warehouse_transfer_id, product_id, requested_quantity, approved_quantity, dispatched_quantity, received_quantity
FROM warehouse_transfer_items
ORDER BY warehouse_transfer_id, id;

SELECT id, warehouse_transfer_id, old_status, new_status, changed_by_id, changed_at
FROM warehouse_transfer_status_history
ORDER BY changed_at DESC;

SELECT id, customer_id, sales_rep_id, visit_type, status, outcome, planned_at, visited_at, latitude, longitude
FROM customer_visits
ORDER BY id DESC;

SELECT id, owner_type, owner_id, file_name, mime_type, file_size, status, uploaded_by_id
FROM attachments
ORDER BY id DESC;

SELECT id, user_id, title, type, module, entity_type, entity_id, status, read_at, created_at
FROM notifications
ORDER BY id DESC;

SELECT action, entity_type, entity_id, created_at
FROM audit_logs
WHERE action LIKE 'PHASE7%'
ORDER BY created_at DESC;
```

## Phase 8 Reports, Dashboards, Audit Logs, and System Configuration

Run the Phase 8 schema and seed scripts after Phase 7:

```cmd
mysql -u root -p sales_distribution_db < backend\sql\014_phase8_reports_dashboard_config_schema.sql
mysql -u root -p sales_distribution_db < backend\sql\015_phase8_seed_reports_dashboard_config.sql
```

Stop any running `npm run dev` process first on Windows, then regenerate Prisma Client:

```cmd
npm run prisma:generate
npm run dev
```

New Phase 8 API routes:

```text
GET          /api/dashboard/summary
GET          /api/dashboard/sales-trend
GET          /api/dashboard/pending-actions

GET          /api/reports/sales-summary
GET          /api/reports/collection-summary
GET          /api/reports/inventory-summary
GET          /api/reports/low-stock
GET          /api/reports/delivery-performance
GET          /api/reports/sales-rep-performance

GET          /api/audit-logs
GET          /api/audit-logs/export
GET          /api/audit-logs/entity/:entityType/:entityId
GET          /api/audit-logs/:id

GET          /api/system-settings
GET          /api/system-settings/:key
PUT          /api/system-settings/:key
DELETE       /api/system-settings/:key
```

### Phase 8 Payload Examples

Dashboard endpoints use query parameters:

```text
GET /api/dashboard/summary?fromDate=2026-06-01T00:00:00.000Z&toDate=2026-06-30T23:59:59.000Z
GET /api/dashboard/sales-trend?days=14
GET /api/dashboard/pending-actions
```

Report endpoints use query parameters:

```text
GET /api/reports/sales-summary?fromDate=2026-06-01T00:00:00.000Z&toDate=2026-06-30T23:59:59.000Z&salesRepId=1
GET /api/reports/collection-summary?fromDate=2026-06-01T00:00:00.000Z&toDate=2026-06-30T23:59:59.000Z&customerId=1
GET /api/reports/inventory-summary?warehouseId=1
GET /api/reports/low-stock?warehouseId=1
GET /api/reports/delivery-performance?fromDate=2026-06-01T00:00:00.000Z&toDate=2026-06-30T23:59:59.000Z&routeId=1
GET /api/reports/sales-rep-performance?salesRepId=1&targetYear=2026&targetMonth=6
```

Audit log endpoints:

```text
GET /api/audit-logs?action=ORDER_CREATED
GET /api/audit-logs?entityType=customer&entityId=1
GET /api/audit-logs?actorUserId=1&fromDate=2026-06-01T00:00:00.000Z
GET /api/audit-logs/entity/customer/1
GET /api/audit-logs/export?entityType=warehouse_transfer&format=json
GET /api/audit-logs/1
```

Audit export returns JSON and is capped at 1,000 rows to keep the endpoint safe for browser/Postman use.

`PUT /api/system-settings/reports.default_date_range_days`

```json
{
  "value": 45,
  "valueType": "NUMBER",
  "category": "reports",
  "description": "Default report date range in days",
  "isSensitive": false,
  "status": "ACTIVE"
}
```

`PUT /api/system-settings/notifications.smtp_password`

```json
{
  "value": "smtp-secret-value",
  "valueType": "STRING",
  "category": "notifications",
  "description": "SMTP password for future email integration",
  "isSensitive": true,
  "status": "ACTIVE"
}
```

Sensitive setting values are returned as `[REDACTED]` and are also redacted in audit logs.

`DELETE /api/system-settings/:key`

```text
No request body. This performs a soft delete and writes an audit log.
```

Useful Phase 8 verification queries:

```sql
SELECT id, `key`, value, value_type, category, is_sensitive, status
FROM system_settings
ORDER BY category, `key`;

SELECT p.code, p.module
FROM permissions p
WHERE p.code IN (
  'dashboard.read',
  'reports.sales',
  'reports.collections',
  'reports.inventory',
  'reports.delivery',
  'reports.performance',
  'system_config.read',
  'system_config.update'
)
ORDER BY p.module, p.code;

SELECT r.code AS role_code, p.code AS permission_code
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE p.code IN (
  'dashboard.read',
  'reports.sales',
  'reports.collections',
  'reports.inventory',
  'reports.delivery',
  'reports.performance',
  'system_config.read',
  'system_config.update'
)
ORDER BY r.code, p.code;

SELECT action, entity_type, entity_id, created_at
FROM audit_logs
WHERE action LIKE 'PHASE8%'
   OR entity_type = 'system_setting'
ORDER BY created_at DESC
LIMIT 50;
```

## Phase 9 Frontend UI

Phase 9 adds the responsive Material UI frontend for the generated backend modules.

Frontend routes:

```text
/login
/
/module/users
/module/sales-reps
/module/offices
/module/factories
/module/warehouses
/module/customers
/module/customer-approvals
/module/product-groups
/module/products
/module/price-lists
/discounts
/module/inventory-stock
/module/routes
/module/orders
/module/deliveries
/module/sales-invoices
/module/payments
/module/cheques
/module/returns
/credit-control
/module/sales-targets
/commissions
/module/warehouse-transfers
/module/customer-visits
/module/attachments
/module/notifications
/reports
/module/audit-logs
/system-settings
```

The UI uses:

- Responsive desktop tables and mobile cards.
- JWT login stored in browser local storage.
- Shared API client with bearer token headers.
- Loading, empty, and error states.
- Reusable resource pages for list, create, edit, soft delete, and workflow actions.
- PWA-ready manifest, service worker registration, and IndexedDB offline queue foundation.

Frontend environment:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

Run the app:

```cmd
npm run dev
```

Open:

```text
Backend:  http://localhost:3000/api/health
Frontend: http://localhost:5173
```

## Phase 10 Final Setup Guide

Use this sequence when setting up a fresh local database.

1. Install dependencies:

```cmd
npm install
```

2. Create or verify the MySQL database and app user:

```sql
CREATE DATABASE IF NOT EXISTS sales_distribution_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'sales_app'@'localhost'
  IDENTIFIED BY 'change_me';

GRANT ALL PRIVILEGES ON sales_distribution_db.* TO 'sales_app'@'localhost';
FLUSH PRIVILEGES;
```

3. Update `backend/.env`:

```env
DATABASE_URL="mysql://sales_app:change_me@localhost:3306/sales_distribution_db"
JWT_SECRET="replace_with_a_local_secret"
JWT_EXPIRES_IN="1d"
PORT=3000
```

4. Run the SQL scripts manually in this order:

```cmd
mysql -u root -p sales_distribution_db < backend\sql\001_phase1_database.sql
mysql -u root -p sales_distribution_db < backend\sql\002_phase2_auth_schema.sql
mysql -u root -p sales_distribution_db < backend\sql\003_phase2_seed_auth.sql
mysql -u root -p sales_distribution_db < backend\sql\004_phase3_company_customer_schema.sql
mysql -u root -p sales_distribution_db < backend\sql\005_phase3_seed_company_customer.sql
mysql -u root -p sales_distribution_db < backend\sql\006_phase4_product_pricing_discount_schema.sql
mysql -u root -p sales_distribution_db < backend\sql\007_phase4_seed_product_pricing_discount.sql
mysql -u root -p sales_distribution_db < backend\sql\008_phase5_inventory_routes_orders_schema.sql
mysql -u root -p sales_distribution_db < backend\sql\009_phase5_seed_inventory_routes_orders.sql
mysql -u root -p sales_distribution_db < backend\sql\010_phase6_delivery_invoice_payment_credit_schema.sql
mysql -u root -p sales_distribution_db < backend\sql\011_phase6_seed_delivery_invoice_payment_credit.sql
mysql -u root -p sales_distribution_db < backend\sql\012_phase7_v1_field_features_schema.sql
mysql -u root -p sales_distribution_db < backend\sql\013_phase7_seed_v1_field_features.sql
mysql -u root -p sales_distribution_db < backend\sql\014_phase8_reports_dashboard_config_schema.sql
mysql -u root -p sales_distribution_db < backend\sql\015_phase8_seed_reports_dashboard_config.sql
mysql -u root -p sales_distribution_db < backend\sql\016_sales_rep_warehouse_primary_route.sql
```

5. Generate Prisma Client after the database schema is in place:

```cmd
npm run prisma:generate
```

6. Validate, lint, build, and run:

```cmd
npm run prisma:validate
npm run lint
npm run build
npm run dev
```

Default local login:

```text
Email:    admin@sales.local
Password: Admin@12345
```

## Phase 10 Healing Notes

The final cleanup pass validates these contracts:

- Prisma schema validates successfully.
- Backend and frontend lint successfully.
- Backend and frontend production builds successfully.
- Frontend pages are lazy-loaded by route to keep the initial bundle smaller.
- Report UI filters send only the query parameters accepted by each strict backend DTO.
- Business deletes remain soft deletes for auditable records.
- Sensitive workflows remain protected by JWT and permission guards.

## Master Data UX Update

Core master-data create APIs now support system-generated codes and current-company defaults. Existing Postman payloads that provide codes still work, but the UI no longer asks users to type codes or the current company ID.

System-generated values:

```text
Office code:        OFF-0001, OFF-0002, ...
Factory code:       FAC-0001, FAC-0002, ... and continues existing FAC-001 style data
Warehouse code:     WH-0001, WH-0002, ...
Sales rep code:     SR-0001, SR-0002, ...
Customer code:      CUS-0001, CUS-0002, ...
Product group code: PG-0001, PG-0002, ...
Product code:       PRD-0001, PRD-0002, ...
Price list code:    PL-0001, PL-0002, ...
Route code:         RTE-0001, RTE-0002, ...
```

Fields filled by the backend when omitted:

```text
POST /api/offices       -> companyId, code
POST /api/factories     -> companyId, code
POST /api/warehouses    -> companyId, code
POST /api/sales-reps    -> code
POST /api/customers     -> code
POST /api/product-groups -> code
POST /api/products      -> code
POST /api/price-lists   -> companyId, code
POST /api/routes        -> code
```

The frontend now loads dropdown options for office, factory, warehouse, customer, sales rep, product, product group, route, order, invoice, and user references. Attachment owner ID and notification entity ID remain manual because their target module depends on the selected owner/entity type.

Report filter mapping:

```text
Sales summary:          fromDate, toDate, officeId, salesRepId, customerId, productId
Collection summary:     fromDate, toDate, officeId, salesRepId, customerId, productId
Inventory summary:      warehouseId, productId
Low stock:              warehouseId, productId
Delivery performance:   fromDate, toDate, routeId, warehouseId
Sales rep performance:  salesRepId, targetYear, targetMonth
```

## Manual Test Checklist

Run these checks after starting `npm run dev`.

### Authentication and Navigation

- Open `http://localhost:5173`.
- Log in with the seeded admin account.
- Confirm the dashboard loads without browser console errors.
- Open the mobile viewport and confirm the drawer navigation works.

### Master Data

- Create, update, search, paginate, and soft delete one office, factory, warehouse, sales rep, customer, product group, product, and price list.
- Confirm required-field validation appears for missing required values.
- Confirm deleted records are not physically removed where the API performs soft delete.

### Sales and Inventory Flow

- Adjust stock for a product and warehouse.
- Create an order with the structured item editor.
- Confirm the Sales Rep order payload does not include trusted `salesRepId`, `officeId`, `warehouseId`, or `routeId` fields.
- Approve the order.
- Reserve stock.
- Create a delivery from the reserved order.
- Dispatch and confirm the delivery.
- Create a sales invoice from the order.
- Capture a cash payment and verify the invoice balance changes.

### Credit and Collections

- Open Credit Control.
- Load a customer summary.
- Run a credit check by order ID.
- Run a credit check by customer ID and order amount.
- Create a credit override request and approve or reject it.
- Deposit, realize, and return cheque records created from cheque payments.

### Version 1.0 Workflows

- Create a monthly sales target.
- Create a commission rule and calculate a commission run.
- Approve and pay a commission run.
- Create a warehouse transfer.
- Approve, dispatch, receive, and cancel transfers as valid statuses allow.
- Plan a customer visit.
- Complete a visit with GPS fields and a visit outcome.
- Register an attachment metadata record.
- Create and mark a notification as read.

### Reports and Admin

- Open Reports and run each report option.
- Confirm report filters change based on the selected report type.
- Open Audit Logs and verify create, update, delete, approve, reject, dispatch, receive, and payment events are visible.
- Create or update a system setting.
- Confirm sensitive system setting values are redacted in list responses and audit data.

### PWA and Offline Foundation

- Confirm `frontend/public/manifest.webmanifest` is served by the frontend.
- Confirm the service worker registers in a production-style browser test.
- Confirm the IndexedDB offline queue helpers are available for future offline order, delivery, payment, return, visit, and attachment sync wiring.

## Release Verification Commands

Run these before handing the build to testers:

```cmd
npm run prisma:validate
npm run prisma:generate
npm run lint
npm run build
```

If `npm run prisma:generate` fails on Windows because `query_engine-windows.dll.node`
is locked, stop `npm run dev` first and retry.
