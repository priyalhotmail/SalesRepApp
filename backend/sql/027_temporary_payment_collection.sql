-- Apply once before running the updated application. Existing posted receipts remain posted.
ALTER TABLE payments
  MODIFY status ENUM('POSTED','CANCELLED','TEMPORARY','AWAITING_CLEARANCE') NOT NULL DEFAULT 'TEMPORARY',
  ADD confirmed_at DATETIME(3) NULL,
  ADD confirmed_by_id INT NULL,
  ADD allocations JSON NULL;
ALTER TABLE cheques
  MODIFY cheque_number VARCHAR(80) NULL,
  MODIFY bank_name VARCHAR(160) NULL,
  MODIFY cheque_date DATETIME(3) NULL;
INSERT INTO permissions (code, name, module, description)
VALUES ('payments.confirm', 'Confirm payment handover', 'payments', 'Confirm cash or cheque handover; cheques await bank reconciliation')
ON DUPLICATE KEY UPDATE description = VALUES(description);
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'payments.confirm'
WHERE r.code IN ('SUPER_ADMIN', 'MAIN_OFFICE_AUTHORIZED_USER', 'BRANCH_AUTHORIZED_USER');
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('payments.create', 'customers.read')
WHERE r.code = 'DELIVERY_PERSON';
