INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'orders.cancel'
WHERE r.code = 'SALES_REP';

INSERT INTO audit_logs (
  action,
  entity_type,
  entity_id,
  new_values
) VALUES (
  'SALES_REP_ORDER_CANCEL_PERMISSION_RESTORED',
  'system',
  'phase9-order-cancel',
  JSON_OBJECT('roleCode', 'SALES_REP', 'permissionCode', 'orders.cancel')
);
