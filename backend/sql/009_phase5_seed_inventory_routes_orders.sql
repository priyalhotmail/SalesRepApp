INSERT INTO permissions (code, name, module, description) VALUES
  ('inventory.read', 'Read inventory', 'inventory', 'View stock balances, reservations, and movements'),
  ('inventory.adjust', 'Adjust inventory', 'inventory', 'Increase or decrease stock balances'),
  ('inventory.reserve', 'Reserve inventory', 'inventory', 'Create or release stock reservations'),
  ('routes.read', 'Read routes', 'routes', 'View routes, customers, and schedules'),
  ('routes.create', 'Create routes', 'routes', 'Create route records'),
  ('routes.update', 'Update routes', 'routes', 'Update route details, customers, and schedules'),
  ('routes.delete', 'Delete routes', 'routes', 'Soft delete route records'),
  ('orders.read', 'Read orders', 'orders', 'View orders and order amendments'),
  ('orders.create', 'Create orders', 'orders', 'Create customer orders'),
  ('orders.update', 'Update orders', 'orders', 'Update draft and submitted orders'),
  ('orders.cancel', 'Cancel orders', 'orders', 'Cancel orders and release active stock reservations'),
  ('orders.approve', 'Approve orders', 'orders', 'Approve submitted orders'),
  ('orders.reserve_stock', 'Reserve order stock', 'orders', 'Reserve warehouse stock for approved orders'),
  ('orders.amend', 'Request order amendments', 'orders', 'Request changes to an existing order'),
  ('orders.approve_amendment', 'Approve order amendments', 'orders', 'Approve or reject order amendment requests'),
  ('reports.loading', 'View loading reports', 'reports', 'View route and warehouse loading reports')
AS new
ON DUPLICATE KEY UPDATE
  name = new.name,
  module = new.module,
  description = new.description;

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SUPER_ADMIN';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'inventory.read',
  'inventory.adjust',
  'inventory.reserve',
  'routes.read',
  'routes.create',
  'routes.update',
  'routes.delete',
  'orders.read',
  'orders.create',
  'orders.update',
  'orders.cancel',
  'orders.approve',
  'orders.reserve_stock',
  'orders.amend',
  'orders.approve_amendment',
  'reports.loading'
)
WHERE r.code = 'MAIN_OFFICE_AUTHORIZED_USER';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'inventory.read',
  'inventory.reserve',
  'routes.read',
  'routes.create',
  'routes.update',
  'orders.read',
  'orders.create',
  'orders.update',
  'orders.cancel',
  'orders.approve',
  'orders.reserve_stock',
  'orders.amend',
  'orders.approve_amendment',
  'reports.loading'
)
WHERE r.code = 'BRANCH_AUTHORIZED_USER';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'inventory.read',
  'inventory.adjust',
  'inventory.reserve',
  'orders.read',
  'orders.reserve_stock',
  'reports.loading'
)
WHERE r.code = 'WAREHOUSE_USER';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'routes.read',
  'orders.read',
  'orders.create',
  'orders.update',
  'orders.amend',
  'reports.loading'
)
WHERE r.code = 'SALES_REP';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'routes.read',
  'orders.read',
  'reports.loading'
)
WHERE r.code = 'DELIVERY_PERSON';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'inventory.read',
  'routes.read',
  'orders.read',
  'reports.loading'
)
WHERE r.code = 'OFFICE_USER';

INSERT INTO inventory_stocks (
  warehouse_id,
  product_id,
  on_hand_quantity,
  reserved_quantity,
  low_stock_threshold
) VALUES (
  (SELECT id FROM warehouses WHERE code = 'WH-MAIN' LIMIT 1),
  (SELECT id FROM products WHERE code = 'SOAP-115G' LIMIT 1),
  10000.000,
  0.000,
  500.000
)
AS new
ON DUPLICATE KEY UPDATE
  on_hand_quantity = GREATEST(on_hand_quantity, new.on_hand_quantity),
  low_stock_threshold = new.low_stock_threshold;

INSERT INTO inventory_movements (
  warehouse_id,
  product_id,
  movement_type,
  quantity,
  balance_after,
  reference_type,
  reference_id,
  notes,
  created_by_id
)
SELECT
  (SELECT id FROM warehouses WHERE code = 'WH-MAIN' LIMIT 1),
  (SELECT id FROM products WHERE code = 'SOAP-115G' LIMIT 1),
  'STOCK_ADJUSTMENT',
  10000.000,
  10000.000,
  'seed',
  'phase5',
  'Initial seed stock for Phase 5',
  (SELECT id FROM users WHERE email = 'admin@sales.local' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1
  FROM inventory_movements
  WHERE reference_type = 'seed'
    AND reference_id = 'phase5'
);

INSERT INTO routes (
  office_id,
  code,
  name,
  description,
  created_by_id
) VALUES (
  (SELECT id FROM offices WHERE code = 'MAIN' LIMIT 1),
  'ROUTE-MAIN-01',
  'Main Route 01',
  'Seed route for Phase 5 testing',
  (SELECT id FROM users WHERE email = 'admin@sales.local' LIMIT 1)
)
AS new
ON DUPLICATE KEY UPDATE
  name = new.name,
  description = new.description;

INSERT INTO route_schedules (
  route_id,
  day_of_week,
  planned_time
) VALUES (
  (SELECT id FROM routes WHERE code = 'ROUTE-MAIN-01' LIMIT 1),
  'MONDAY',
  '08:00'
)
AS new
ON DUPLICATE KEY UPDATE
  planned_time = new.planned_time,
  status = 'ACTIVE';

INSERT INTO audit_logs (
  action,
  entity_type,
  entity_id,
  new_values
) VALUES (
  'PHASE5_INVENTORY_ROUTES_ORDERS_SEED_APPLIED',
  'system',
  'phase5',
  JSON_OBJECT('seedWarehouseCode', 'WH-MAIN', 'seedRouteCode', 'ROUTE-MAIN-01')
);
