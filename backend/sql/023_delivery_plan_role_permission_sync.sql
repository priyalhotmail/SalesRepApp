-- Ensures existing installations have the Delivery permissions required by each operational role.
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('delivery.read', 'delivery.create', 'delivery.update')
WHERE r.code IN ('SUPER_ADMIN', 'MAIN_OFFICE_AUTHORIZED_USER', 'BRANCH_AUTHORIZED_USER', 'WAREHOUSE_USER');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('delivery.read', 'delivery.update')
WHERE r.code = 'DELIVERY_PERSON';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'delivery.read'
WHERE r.code IN ('OFFICE_USER', 'SALES_REP');
