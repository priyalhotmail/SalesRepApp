DELETE rp
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE r.code = 'SALES_REP'
  AND p.code IN (
    'orders.cancel',
    'orders.approve',
    'orders.reserve_stock',
    'orders.approve_amendment'
  );

INSERT INTO audit_logs (
  action,
  entity_type,
  entity_id,
  new_values
) VALUES (
  'ORDER_WORKFLOW_PERMISSION_CLEANUP_APPLIED',
  'system',
  'phase9-order-workflow',
  JSON_OBJECT(
    'salesRepRemovedPermissions',
    JSON_ARRAY(
      'orders.cancel',
      'orders.approve',
      'orders.reserve_stock',
      'orders.approve_amendment'
    )
  )
);
