-- Allows the assigned delivery person to generate an invoice after confirming delivery.
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'sales_invoices.create'
WHERE r.code = 'DELIVERY_PERSON';
