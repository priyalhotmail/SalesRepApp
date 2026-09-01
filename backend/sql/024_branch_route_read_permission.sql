INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'routes.read'
WHERE r.code IN ('SUPER_ADMIN', 'MAIN_OFFICE_AUTHORIZED_USER', 'BRANCH_AUTHORIZED_USER', 'WAREHOUSE_USER', 'SALES_REP', 'DELIVERY_PERSON', 'OFFICE_USER');
