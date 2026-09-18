-- Apply once after migration 027. Monetary values use the company currency.
ALTER TABLE customers ADD can_return_lock INT NOT NULL DEFAULT 0;
ALTER TABLE deliveries ADD returned_items_received_at DATETIME(3) NULL, ADD returned_items_received_by_id INT NULL;
ALTER TABLE sales_invoices ADD can_credit_total DECIMAL(12,2) NOT NULL DEFAULT 0;
CREATE TABLE can_types (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, name VARCHAR(80) NOT NULL UNIQUE,
 capacity_litres DECIMAL(10,3) NOT NULL, return_value DECIMAL(12,2) NOT NULL,
 product_ids JSON NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, updated_at DATETIME(3) NOT NULL
);
CREATE TABLE can_returns (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, customer_id INT NOT NULL, office_id INT NOT NULL,
 collected_by_id INT NOT NULL, collected_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 status VARCHAR(20) NOT NULL DEFAULT 'TEMPORARY', items JSON NOT NULL,
 total_amount DECIMAL(12,2) NOT NULL, remaining_credit DECIMAL(12,2) NOT NULL DEFAULT 0,
 confirmed_at DATETIME(3) NULL, confirmed_by_id INT NULL,
 FOREIGN KEY (customer_id) REFERENCES customers(id), INDEX (collected_by_id,collected_at), INDEX (customer_id,status)
);
CREATE TABLE can_credit_applications (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, can_return_id INT NOT NULL, sales_invoice_id INT NOT NULL,
 amount DECIMAL(12,2) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY (can_return_id) REFERENCES can_returns(id), FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id), INDEX (sales_invoice_id)
);
INSERT INTO permissions (code,name,module,description) VALUES
 ('driver_day.read','Driver day summary','driver_day','Review driver daily collections and delivery outcomes'),
 ('driver_day.confirm','Receive undelivered goods','driver_day','Confirm physical branch receipt of undelivered goods'),
 ('can_returns.read','Read empty can returns','can_returns','View can sizes, eligibility and returns'),
 ('can_returns.create','Collect empty cans','can_returns','Record temporary can returns'),
 ('can_returns.confirm','Confirm empty cans','can_returns','Confirm branch receipt and apply customer credit'),
 ('can_returns.configure','Configure returnable cans','can_returns','Configure can sizes, products and return values')
ON DUPLICATE KEY UPDATE description=VALUES(description);
INSERT IGNORE INTO role_permissions(role_id,permission_id)
 SELECT r.id,p.id FROM roles r JOIN permissions p ON p.module IN ('driver_day','can_returns')
 WHERE r.code IN ('SUPER_ADMIN','MAIN_OFFICE_AUTHORIZED_USER','BRANCH_AUTHORIZED_USER');
INSERT IGNORE INTO role_permissions(role_id,permission_id)
 SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code IN ('can_returns.read','can_returns.create','customers.read')
 WHERE r.code IN ('DELIVERY_PERSON','SALES_REP');
