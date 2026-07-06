INSERT INTO permissions (code, name, module, description) VALUES
  ('product_catalogue.read', 'Read product catalogue', 'product_catalogue', 'View product groups, products, and packaging'),
  ('product_catalogue.create', 'Create product catalogue', 'product_catalogue', 'Create product groups, products, and packaging'),
  ('product_catalogue.update', 'Update product catalogue', 'product_catalogue', 'Update product groups, products, and packaging'),
  ('product_catalogue.delete', 'Delete product catalogue', 'product_catalogue', 'Soft delete product groups, products, and packaging'),
  ('price_lists.read', 'Read price lists', 'price_lists', 'View price lists and resolved prices'),
  ('price_lists.create', 'Create price lists', 'price_lists', 'Create price lists, items, assignments, and customer groups'),
  ('price_lists.update', 'Update price lists', 'price_lists', 'Update price list details and prices'),
  ('price_lists.delete', 'Delete price lists', 'price_lists', 'Soft delete price lists and customer groups'),
  ('price_lists.activate', 'Activate price lists', 'price_lists', 'Activate or schedule price lists'),
  ('discounts.read', 'Read discounts', 'discounts', 'View discount classes, offers, and discount requests'),
  ('discounts.create', 'Create discounts', 'discounts', 'Create discount classes, seasonal discounts, and free item offers'),
  ('discounts.update', 'Update discounts', 'discounts', 'Update discount rules'),
  ('discounts.delete', 'Delete discounts', 'discounts', 'Soft delete discount rules'),
  ('discounts.request', 'Request additional discounts', 'discounts', 'Request additional bill discounts'),
  ('discounts.approve', 'Approve discounts', 'discounts', 'Approve or reject discount requests'),
  ('discounts.calculate', 'Calculate discounts', 'discounts', 'Calculate bill and line discounts')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  module = VALUES(module),
  description = VALUES(description);

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SUPER_ADMIN';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'product_catalogue.read',
  'product_catalogue.create',
  'product_catalogue.update',
  'product_catalogue.delete',
  'price_lists.read',
  'price_lists.create',
  'price_lists.update',
  'price_lists.delete',
  'price_lists.activate',
  'discounts.read',
  'discounts.create',
  'discounts.update',
  'discounts.delete',
  'discounts.approve',
  'discounts.calculate'
)
WHERE r.code = 'MAIN_OFFICE_AUTHORIZED_USER';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'product_catalogue.read',
  'price_lists.read',
  'discounts.read',
  'discounts.approve',
  'discounts.calculate'
)
WHERE r.code = 'BRANCH_AUTHORIZED_USER';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'product_catalogue.read',
  'price_lists.read',
  'discounts.read',
  'discounts.calculate'
)
WHERE r.code IN ('OFFICE_USER', 'WAREHOUSE_USER', 'SALES_REP', 'DELIVERY_PERSON');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'discounts.request'
WHERE r.code = 'SALES_REP';

INSERT INTO product_groups (code, name, description, created_by_id) VALUES
  ('SOAP', 'Soap', 'Soap products', (SELECT id FROM users WHERE email = 'admin@sales.local' LIMIT 1))
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description);

INSERT INTO products (
  product_group_id,
  code,
  name,
  price,
  capacity,
  unit_type,
  supports_bulk,
  created_by_id
) VALUES (
  (SELECT id FROM product_groups WHERE code = 'SOAP' LIMIT 1),
  'SOAP-115G',
  '115g Soap',
  50.00,
  115.000,
  'GM',
  TRUE,
  (SELECT id FROM users WHERE email = 'admin@sales.local' LIMIT 1)
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  price = VALUES(price),
  capacity = VALUES(capacity),
  unit_type = VALUES(unit_type),
  supports_bulk = VALUES(supports_bulk);

INSERT INTO product_packaging_options (
  product_id,
  name,
  unit_quantity,
  is_default
) VALUES
  ((SELECT id FROM products WHERE code = 'SOAP-115G' LIMIT 1), 'Each', 1, TRUE),
  ((SELECT id FROM products WHERE code = 'SOAP-115G' LIMIT 1), 'Box', 120, FALSE)
ON DUPLICATE KEY UPDATE
  unit_quantity = VALUES(unit_quantity),
  is_default = VALUES(is_default);

INSERT IGNORE INTO product_factory_sources (product_id, factory_id)
SELECT p.id, f.id
FROM products p
JOIN factories f ON f.code = 'FAC-001'
WHERE p.code = 'SOAP-115G';

INSERT INTO price_lists (
  company_id,
  code,
  name,
  effective_from,
  status,
  created_by_id
) VALUES (
  (SELECT id FROM companies WHERE name = 'Default Company' LIMIT 1),
  'BASE-2026',
  'Base Price List 2026',
  CURRENT_TIMESTAMP(3),
  'ACTIVE',
  (SELECT id FROM users WHERE email = 'admin@sales.local' LIMIT 1)
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  status = VALUES(status);

INSERT INTO price_list_items (price_list_id, product_id, unit_price) VALUES (
  (SELECT id FROM price_lists WHERE code = 'BASE-2026' LIMIT 1),
  (SELECT id FROM products WHERE code = 'SOAP-115G' LIMIT 1),
  50.00
)
ON DUPLICATE KEY UPDATE
  unit_price = VALUES(unit_price);

INSERT INTO price_list_assignments (price_list_id, scope, created_by_id)
SELECT pl.id, 'GLOBAL', (SELECT id FROM users WHERE email = 'admin@sales.local' LIMIT 1)
FROM price_lists pl
WHERE pl.code = 'BASE-2026'
  AND NOT EXISTS (
    SELECT 1
    FROM price_list_assignments pla
    WHERE pla.price_list_id = pl.id
      AND pla.scope = 'GLOBAL'
  );

INSERT INTO product_price_history (product_id, price_list_id, new_price, changed_by_id)
SELECT p.id, pl.id, 50.00, (SELECT id FROM users WHERE email = 'admin@sales.local' LIMIT 1)
FROM products p
JOIN price_lists pl ON pl.code = 'BASE-2026'
WHERE p.code = 'SOAP-115G'
  AND NOT EXISTS (
    SELECT 1
    FROM product_price_history pph
    WHERE pph.product_id = p.id
      AND pph.price_list_id = pl.id
      AND pph.new_price = 50.00
  );

INSERT INTO discount_classes (code, name, discount_percentage, created_by_id) VALUES
  ('STANDARD', 'Standard Customer Discount', 2.50, (SELECT id FROM users WHERE email = 'admin@sales.local' LIMIT 1))
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  discount_percentage = VALUES(discount_percentage);

INSERT INTO seasonal_discounts (
  product_id,
  name,
  value_type,
  value,
  valid_from,
  valid_to,
  created_by_id
)
SELECT
  (SELECT id FROM products WHERE code = 'SOAP-115G' LIMIT 1),
  'Launch Seasonal Discount',
  'PERCENTAGE',
  5.00,
  CURRENT_TIMESTAMP(3),
  DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 90 DAY),
  (SELECT id FROM users WHERE email = 'admin@sales.local' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1
  FROM seasonal_discounts sd
  JOIN products p ON p.id = sd.product_id
  WHERE p.code = 'SOAP-115G'
    AND sd.name = 'Launch Seasonal Discount'
);

INSERT INTO free_item_offers (
  product_id,
  name,
  buy_quantity,
  free_quantity,
  valid_from,
  valid_to,
  created_by_id
)
SELECT
  (SELECT id FROM products WHERE code = 'SOAP-115G' LIMIT 1),
  'Buy 12 Get 1 Free',
  12,
  1,
  CURRENT_TIMESTAMP(3),
  DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 90 DAY),
  (SELECT id FROM users WHERE email = 'admin@sales.local' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1
  FROM free_item_offers fio
  JOIN products p ON p.id = fio.product_id
  WHERE p.code = 'SOAP-115G'
    AND fio.name = 'Buy 12 Get 1 Free'
);

INSERT INTO audit_logs (
  action,
  entity_type,
  entity_id,
  new_values
) VALUES (
  'PHASE4_PRODUCT_PRICING_DISCOUNT_SEED_APPLIED',
  'system',
  'phase4',
  JSON_OBJECT('seedProductCode', 'SOAP-115G', 'seedPriceListCode', 'BASE-2026')
);
