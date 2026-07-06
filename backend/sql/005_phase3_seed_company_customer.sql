INSERT INTO permissions (code, name, module, description) VALUES
  ('company_structure.read', 'Read company structure', 'company_structure', 'View companies, offices, factories, and warehouses'),
  ('company_structure.create', 'Create company structure', 'company_structure', 'Create offices, factories, and warehouses'),
  ('company_structure.update', 'Update company structure', 'company_structure', 'Update companies, offices, factories, and warehouses'),
  ('company_structure.delete', 'Delete company structure', 'company_structure', 'Soft delete offices, factories, and warehouses'),
  ('sales_reps.read', 'Read sales reps', 'sales_reps', 'View sales representative records'),
  ('sales_reps.create', 'Create sales reps', 'sales_reps', 'Create sales representative records'),
  ('sales_reps.update', 'Update sales reps', 'sales_reps', 'Update sales representative records'),
  ('sales_reps.delete', 'Delete sales reps', 'sales_reps', 'Soft delete sales representative records'),
  ('customers.read', 'Read customers', 'customers', 'View customer records'),
  ('customers.create', 'Create customers', 'customers', 'Create customer records'),
  ('customers.update', 'Update customers', 'customers', 'Update customer records directly'),
  ('customers.delete', 'Delete customers', 'customers', 'Soft delete customer records'),
  ('customers.request_change', 'Request customer changes', 'customers', 'Request approval for customer information changes'),
  ('customers.approve_change', 'Approve customer changes', 'customers', 'Approve or reject customer change requests')
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
  'company_structure.read',
  'company_structure.create',
  'company_structure.update',
  'company_structure.delete',
  'sales_reps.read',
  'sales_reps.create',
  'sales_reps.update',
  'sales_reps.delete',
  'customers.read',
  'customers.create',
  'customers.update',
  'customers.delete',
  'customers.request_change',
  'customers.approve_change'
)
WHERE r.code = 'MAIN_OFFICE_AUTHORIZED_USER';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'company_structure.read',
  'sales_reps.read',
  'customers.read',
  'customers.create',
  'customers.update',
  'customers.delete',
  'customers.request_change',
  'customers.approve_change'
)
WHERE r.code = 'BRANCH_AUTHORIZED_USER';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'company_structure.read',
  'sales_reps.read',
  'customers.read'
)
WHERE r.code IN ('OFFICE_USER', 'WAREHOUSE_USER');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'customers.read',
  'customers.create',
  'customers.request_change'
)
WHERE r.code = 'SALES_REP';

INSERT INTO companies (
  name,
  registration_number,
  vat_registration_number,
  address,
  email,
  telephone,
  created_by_id
) VALUES (
  'Default Company',
  'REG-001',
  'VAT-001',
  'Main business address',
  'info@sales.local',
  '0110000000',
  (SELECT id FROM users WHERE email = 'admin@sales.local' LIMIT 1)
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name);

INSERT INTO offices (
  company_id,
  code,
  name,
  office_type,
  address,
  email,
  contact_person,
  telephone,
  created_by_id
) VALUES (
  (SELECT id FROM companies WHERE name = 'Default Company' LIMIT 1),
  'MAIN',
  'Main Office',
  'MAIN',
  'Main office address',
  'main@sales.local',
  'Main Office Admin',
  '0110000001',
  (SELECT id FROM users WHERE email = 'admin@sales.local' LIMIT 1)
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  office_type = VALUES(office_type);

INSERT INTO factories (
  company_id,
  code,
  name,
  address,
  email,
  contact_person,
  telephone,
  created_by_id
) VALUES (
  (SELECT id FROM companies WHERE name = 'Default Company' LIMIT 1),
  'FAC-001',
  'Factory One',
  'Factory address',
  'factory@sales.local',
  'Factory Manager',
  '0110000002',
  (SELECT id FROM users WHERE email = 'admin@sales.local' LIMIT 1)
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name);

INSERT INTO warehouses (
  company_id,
  office_id,
  factory_id,
  code,
  name,
  warehouse_type,
  address,
  email,
  contact_person,
  telephone,
  created_by_id
) VALUES
  (
    (SELECT id FROM companies WHERE name = 'Default Company' LIMIT 1),
    (SELECT id FROM offices WHERE code = 'MAIN' LIMIT 1),
    NULL,
    'WH-MAIN',
    'Main Warehouse',
    'MAIN',
    'Main warehouse address',
    'warehouse@sales.local',
    'Warehouse Manager',
    '0110000003',
    (SELECT id FROM users WHERE email = 'admin@sales.local' LIMIT 1)
  ),
  (
    (SELECT id FROM companies WHERE name = 'Default Company' LIMIT 1),
    NULL,
    (SELECT id FROM factories WHERE code = 'FAC-001' LIMIT 1),
    'WH-FAC-001',
    'Factory Final Product Warehouse',
    'FACTORY_FINAL_PRODUCT',
    'Factory warehouse address',
    'factorywarehouse@sales.local',
    'Factory Warehouse Manager',
    '0110000004',
    (SELECT id FROM users WHERE email = 'admin@sales.local' LIMIT 1)
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  warehouse_type = VALUES(warehouse_type);

INSERT INTO audit_logs (
  action,
  entity_type,
  entity_id,
  new_values
) VALUES (
  'PHASE3_COMPANY_CUSTOMER_SEED_APPLIED',
  'system',
  'phase3',
  JSON_OBJECT('companyName', 'Default Company')
);

