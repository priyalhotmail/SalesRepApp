INSERT INTO permissions (code, name, module, description) VALUES
  ('users.read', 'Read users', 'users', 'View user records'),
  ('users.create', 'Create users', 'users', 'Create user accounts'),
  ('users.update', 'Update users', 'users', 'Update user account details'),
  ('users.delete', 'Delete users', 'users', 'Soft delete user accounts'),
  ('users.assign_roles', 'Assign user roles', 'users', 'Assign roles to users'),
  ('roles.read', 'Read roles', 'roles', 'View roles and permissions'),
  ('roles.create', 'Create roles', 'roles', 'Create non-system roles'),
  ('roles.update', 'Update roles', 'roles', 'Update role details'),
  ('roles.delete', 'Delete roles', 'roles', 'Soft delete non-system roles'),
  ('roles.assign_permissions', 'Assign permissions', 'roles', 'Assign permissions to roles'),
  ('audit.read', 'Read audit logs', 'audit', 'View audit history'),
  ('dashboard.read', 'Read dashboard', 'dashboard', 'View dashboard summaries')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  module = VALUES(module),
  description = VALUES(description);

INSERT INTO roles (code, name, description, is_system, status) VALUES
  ('SUPER_ADMIN', 'Super Admin', 'Full system access', TRUE, 'ACTIVE'),
  ('MAIN_OFFICE_AUTHORIZED_USER', 'Main Office Authorized User', 'Main office approvals and administration', TRUE, 'ACTIVE'),
  ('BRANCH_AUTHORIZED_USER', 'Branch Authorized User', 'Branch approvals and administration', TRUE, 'ACTIVE'),
  ('OFFICE_USER', 'Office User', 'General office operations', TRUE, 'ACTIVE'),
  ('WAREHOUSE_USER', 'Warehouse User', 'Warehouse and inventory operations', TRUE, 'ACTIVE'),
  ('SALES_REP', 'Sales Rep', 'Field sales operations', TRUE, 'ACTIVE'),
  ('DELIVERY_PERSON', 'Delivery Person', 'Delivery and collection operations', TRUE, 'ACTIVE')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  is_system = VALUES(is_system),
  status = VALUES(status);

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SUPER_ADMIN';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'users.read',
  'roles.read',
  'audit.read',
  'dashboard.read'
)
WHERE r.code IN ('MAIN_OFFICE_AUTHORIZED_USER', 'BRANCH_AUTHORIZED_USER');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('dashboard.read')
WHERE r.code IN ('OFFICE_USER', 'WAREHOUSE_USER', 'SALES_REP', 'DELIVERY_PERSON');

INSERT INTO users (
  email,
  password_hash,
  display_name,
  status
) VALUES (
  'admin@sales.local',
  '$2a$12$m7/TEiuvzpcZS5DSpMKr7OZFcF7FiTSMvEynNnUwGkdLNBLUiKyfi',
  'System Administrator',
  'ACTIVE'
)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  status = VALUES(status);

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.code = 'SUPER_ADMIN'
WHERE u.email = 'admin@sales.local';

INSERT INTO audit_logs (
  action,
  entity_type,
  entity_id,
  new_values
) VALUES (
  'PHASE2_AUTH_SEED_APPLIED',
  'system',
  'phase2',
  JSON_OBJECT('defaultAdminEmail', 'admin@sales.local')
);
