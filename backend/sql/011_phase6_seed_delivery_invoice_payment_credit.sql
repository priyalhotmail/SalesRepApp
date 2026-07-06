INSERT INTO permissions (code, name, module, description) VALUES
  ('delivery.read', 'Read deliveries', 'delivery', 'View delivery records and delivery items'),
  ('delivery.create', 'Create deliveries', 'delivery', 'Create deliveries from reserved orders'),
  ('delivery.update', 'Update deliveries', 'delivery', 'Dispatch, confirm, and cancel deliveries'),
  ('sales_invoices.read', 'Read sales invoices', 'sales_invoices', 'View sales invoices and balances'),
  ('sales_invoices.create', 'Create sales invoices', 'sales_invoices', 'Create sales invoices from orders'),
  ('sales_invoices.cancel', 'Cancel sales invoices', 'sales_invoices', 'Cancel unpaid sales invoices'),
  ('payments.read', 'Read payments', 'payments', 'View payment collection records'),
  ('payments.create', 'Create payments', 'payments', 'Capture cash, card, transfer, and cheque payments'),
  ('payments.cancel', 'Cancel payments', 'payments', 'Cancel posted payments and reverse invoice balances'),
  ('cheques.read', 'Read cheques', 'cheques', 'View cheque records'),
  ('cheques.update', 'Update cheques', 'cheques', 'Deposit, realize, return, or cancel cheques'),
  ('returns.read', 'Read returns', 'returns', 'View sales return records'),
  ('returns.create', 'Create returns', 'returns', 'Create sales return requests'),
  ('returns.approve', 'Approve returns', 'returns', 'Approve, reject, and receive sales returns'),
  ('credit_control.read', 'Read credit control', 'credit_control', 'View credit summaries and aging reports'),
  ('credit_control.update', 'Update credit control', 'credit_control', 'Update customer credit settings'),
  ('credit_control.request_override', 'Request credit override', 'credit_control', 'Request credit approval override'),
  ('credit_control.approve_override', 'Approve credit override', 'credit_control', 'Approve or reject credit override requests')
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
  'delivery.read',
  'delivery.create',
  'delivery.update',
  'sales_invoices.read',
  'sales_invoices.create',
  'sales_invoices.cancel',
  'payments.read',
  'payments.create',
  'payments.cancel',
  'cheques.read',
  'cheques.update',
  'returns.read',
  'returns.create',
  'returns.approve',
  'credit_control.read',
  'credit_control.update',
  'credit_control.request_override',
  'credit_control.approve_override'
)
WHERE r.code = 'MAIN_OFFICE_AUTHORIZED_USER';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'delivery.read',
  'delivery.create',
  'delivery.update',
  'sales_invoices.read',
  'sales_invoices.create',
  'payments.read',
  'payments.create',
  'cheques.read',
  'cheques.update',
  'returns.read',
  'returns.create',
  'returns.approve',
  'credit_control.read',
  'credit_control.request_override',
  'credit_control.approve_override'
)
WHERE r.code = 'BRANCH_AUTHORIZED_USER';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'delivery.read',
  'delivery.create',
  'delivery.update',
  'sales_invoices.read',
  'payments.read',
  'cheques.read',
  'returns.read',
  'returns.approve'
)
WHERE r.code = 'WAREHOUSE_USER';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'delivery.read',
  'sales_invoices.read',
  'payments.read',
  'payments.create',
  'cheques.read',
  'returns.read',
  'returns.create',
  'credit_control.read',
  'credit_control.request_override'
)
WHERE r.code = 'SALES_REP';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'delivery.read',
  'delivery.update',
  'sales_invoices.read',
  'payments.read',
  'returns.read'
)
WHERE r.code = 'DELIVERY_PERSON';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'delivery.read',
  'sales_invoices.read',
  'payments.read',
  'cheques.read',
  'returns.read',
  'credit_control.read'
)
WHERE r.code = 'OFFICE_USER';

INSERT INTO audit_logs (
  action,
  entity_type,
  entity_id,
  new_values
) VALUES (
  'PHASE6_DELIVERY_INVOICE_PAYMENT_CREDIT_SEED_APPLIED',
  'system',
  'phase6',
  JSON_OBJECT('modules', JSON_ARRAY('delivery', 'sales_invoices', 'payments', 'cheques', 'returns', 'credit_control'))
);
