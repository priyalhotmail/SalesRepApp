-- Apply once after 028. Physical custody tracking; no customer ledger changes.
ALTER TABLE payments ADD COLUMN collection_office_id INT NULL;
UPDATE payments p JOIN customers c ON c.id=p.customer_id SET p.collection_office_id=c.office_id WHERE p.confirmed_at IS NOT NULL;
CREATE TABLE collection_remittances (
 id VARCHAR(36) NOT NULL PRIMARY KEY, office_id INT NOT NULL,
 destination VARCHAR(20) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
 sent_at DATETIME(3) NOT NULL, bank_name VARCHAR(160) NULL, reference VARCHAR(160) NOT NULL,
 notes VARCHAR(500) NULL, created_by_id INT NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 reviewed_by_id INT NULL, reviewed_at DATETIME(3) NULL, review_notes VARCHAR(500) NULL,
 INDEX(office_id,sent_at), FOREIGN KEY(office_id) REFERENCES offices(id)
);
CREATE TABLE collection_remittance_items (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, remittance_id VARCHAR(36) NOT NULL,
 payment_id INT NOT NULL UNIQUE, amount DECIMAL(12,2) NOT NULL, method VARCHAR(20) NOT NULL,
 FOREIGN KEY(remittance_id) REFERENCES collection_remittances(id), FOREIGN KEY(payment_id) REFERENCES payments(id)
);
INSERT INTO permissions(code,name,module,description) VALUES
 ('collections.read','Branch collection dashboard','collections','View branch collections and remittances'),
 ('collections.send','Send branch collections','collections','Record head-office handovers and bank deposits'),
 ('collections.receive','Review branch remittances','collections','Head office confirms receipt or flags missing remittances')
ON DUPLICATE KEY UPDATE description=VALUES(description);
INSERT IGNORE INTO role_permissions(role_id,permission_id)
 SELECT r.id,p.id FROM roles r JOIN permissions p ON p.module='collections'
 WHERE r.code IN ('SUPER_ADMIN','MAIN_OFFICE_AUTHORIZED_USER');
INSERT IGNORE INTO role_permissions(role_id,permission_id)
 SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code IN ('collections.read','collections.send')
 WHERE r.code='BRANCH_AUTHORIZED_USER';
