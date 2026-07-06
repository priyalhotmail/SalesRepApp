INSERT INTO permissions (code, name, module, description) VALUES
  ('sales_targets.read', 'Read sales targets', 'sales_targets', 'View sales rep targets and achievement summaries'),
  ('sales_targets.create', 'Create sales targets', 'sales_targets', 'Create monthly revenue and volume targets'),
  ('sales_targets.update', 'Update sales targets', 'sales_targets', 'Update target values and notes'),
  ('sales_targets.delete', 'Delete sales targets', 'sales_targets', 'Soft delete sales target records'),
  ('commissions.read', 'Read commissions', 'commissions', 'View commission rules and calculated commission runs'),
  ('commissions.create', 'Create commissions', 'commissions', 'Create commission rules and calculate commission runs'),
  ('commissions.update', 'Update commissions', 'commissions', 'Update commission rules'),
  ('commissions.delete', 'Delete commissions', 'commissions', 'Soft delete commission rules'),
  ('commissions.approve', 'Approve commissions', 'commissions', 'Approve and mark commission runs as paid'),
  ('warehouse_transfers.read', 'Read warehouse transfers', 'warehouse_transfers', 'View stock transfer requests and status history'),
  ('warehouse_transfers.create', 'Create warehouse transfers', 'warehouse_transfers', 'Create branch or warehouse stock transfer requests'),
  ('warehouse_transfers.approve', 'Approve warehouse transfers', 'warehouse_transfers', 'Approve or reject transfer requests'),
  ('warehouse_transfers.dispatch', 'Dispatch warehouse transfers', 'warehouse_transfers', 'Dispatch approved transfers and move goods into transit'),
  ('warehouse_transfers.receive', 'Receive warehouse transfers', 'warehouse_transfers', 'Confirm transfer receipt and update destination stock'),
  ('warehouse_transfers.cancel', 'Cancel warehouse transfers', 'warehouse_transfers', 'Cancel pending transfer requests'),
  ('customer_visits.read', 'Read customer visits', 'customer_visits', 'View planned and completed customer visits'),
  ('customer_visits.create', 'Create customer visits', 'customer_visits', 'Plan sales, collection, complaint, and follow-up visits'),
  ('customer_visits.update', 'Update customer visits', 'customer_visits', 'Complete, miss, or cancel customer visits'),
  ('attachments.read', 'Read attachments', 'attachments', 'View secure file attachment metadata'),
  ('attachments.create', 'Create attachments', 'attachments', 'Register document and photo attachment metadata'),
  ('attachments.delete', 'Delete attachments', 'attachments', 'Soft delete attachment metadata'),
  ('notifications.read', 'Read notifications', 'notifications', 'View in-app notifications'),
  ('notifications.create', 'Create notifications', 'notifications', 'Create notification events for users'),
  ('notifications.update', 'Update notifications', 'notifications', 'Mark notifications as read')
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
  'sales_targets.read',
  'sales_targets.create',
  'sales_targets.update',
  'sales_targets.delete',
  'commissions.read',
  'commissions.create',
  'commissions.update',
  'commissions.delete',
  'commissions.approve',
  'warehouse_transfers.read',
  'warehouse_transfers.create',
  'warehouse_transfers.approve',
  'warehouse_transfers.dispatch',
  'warehouse_transfers.receive',
  'warehouse_transfers.cancel',
  'customer_visits.read',
  'customer_visits.create',
  'customer_visits.update',
  'attachments.read',
  'attachments.create',
  'attachments.delete',
  'notifications.read',
  'notifications.create',
  'notifications.update'
)
WHERE r.code = 'MAIN_OFFICE_AUTHORIZED_USER';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'sales_targets.read',
  'sales_targets.create',
  'sales_targets.update',
  'commissions.read',
  'warehouse_transfers.read',
  'warehouse_transfers.create',
  'warehouse_transfers.approve',
  'warehouse_transfers.dispatch',
  'warehouse_transfers.receive',
  'warehouse_transfers.cancel',
  'customer_visits.read',
  'customer_visits.create',
  'customer_visits.update',
  'attachments.read',
  'attachments.create',
  'attachments.delete',
  'notifications.read',
  'notifications.create',
  'notifications.update'
)
WHERE r.code = 'BRANCH_AUTHORIZED_USER';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'warehouse_transfers.read',
  'warehouse_transfers.create',
  'warehouse_transfers.dispatch',
  'warehouse_transfers.receive',
  'customer_visits.read',
  'attachments.read',
  'attachments.create',
  'notifications.read',
  'notifications.update'
)
WHERE r.code = 'WAREHOUSE_USER';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'sales_targets.read',
  'commissions.read',
  'warehouse_transfers.read',
  'customer_visits.read',
  'customer_visits.create',
  'customer_visits.update',
  'attachments.read',
  'attachments.create',
  'notifications.read',
  'notifications.update'
)
WHERE r.code = 'SALES_REP';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'warehouse_transfers.read',
  'customer_visits.read',
  'customer_visits.update',
  'attachments.read',
  'attachments.create',
  'notifications.read',
  'notifications.update'
)
WHERE r.code = 'DELIVERY_PERSON';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'sales_targets.read',
  'commissions.read',
  'warehouse_transfers.read',
  'customer_visits.read',
  'attachments.read',
  'notifications.read',
  'notifications.update'
)
WHERE r.code = 'OFFICE_USER';

INSERT INTO notifications (
  user_id,
  title,
  message,
  type,
  module,
  entity_type,
  entity_id,
  created_by_id
)
SELECT
  admin_user.id,
  'Phase 7 features enabled',
  'Sales targets, commissions, warehouse transfers, visits, attachments, notifications, geo data, and offline queue support are ready for testing.',
  'SUCCESS',
  'system',
  'phase',
  'phase7',
  admin_user.id
FROM users admin_user
WHERE admin_user.email = 'admin@sales.local'
  AND NOT EXISTS (
    SELECT 1
    FROM notifications existing
    WHERE existing.module = 'system'
      AND existing.entity_type = 'phase'
      AND existing.entity_id = 'phase7'
  );

INSERT INTO audit_logs (
  action,
  entity_type,
  entity_id,
  new_values
) VALUES (
  'PHASE7_V1_FIELD_FEATURES_SEED_APPLIED',
  'system',
  'phase7',
  JSON_OBJECT('modules', JSON_ARRAY('sales_targets', 'commissions', 'warehouse_transfers', 'customer_visits', 'attachments', 'notifications', 'offline_pwa'))
);
