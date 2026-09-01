-- Self-contained repair for existing databases that may not have received older permission seed scripts.
INSERT INTO permissions (code, name, module, description) VALUES
  ('delivery.read', 'Read deliveries', 'delivery', 'View delivery records and delivery plans'),
  ('delivery.create', 'Create deliveries', 'delivery', 'Create delivery plans from reserved orders'),
  ('delivery.update', 'Update deliveries', 'delivery', 'Confirm loading, dispatch, confirm, and cancel deliveries'),
  ('routes.read', 'Read routes', 'routes', 'View routes, customers, and schedules')
ON DUPLICATE KEY UPDATE name = VALUES(name), module = VALUES(module), description = VALUES(description);

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('delivery.read', 'delivery.create', 'delivery.update', 'routes.read')
WHERE r.code = 'BRANCH_AUTHORIZED_USER';
