SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'credit_limit') = 0,
  'ALTER TABLE customers ADD COLUMN credit_limit DECIMAL(12, 2) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'credit_hold') = 0,
  'ALTER TABLE customers ADD COLUMN credit_hold BOOLEAN NOT NULL DEFAULT FALSE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'credit_terms_days') = 0,
  'ALTER TABLE customers ADD COLUMN credit_terms_days INT NOT NULL DEFAULT 30',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE inventory_movements
  MODIFY movement_type ENUM('STOCK_ADJUSTMENT', 'RESERVATION', 'RESERVATION_RELEASE', 'RESERVATION_CONSUME', 'RETURN_RECEIPT') NOT NULL;

CREATE TABLE IF NOT EXISTS deliveries (
  id INT NOT NULL AUTO_INCREMENT,
  delivery_number VARCHAR(40) NOT NULL,
  order_id INT NOT NULL,
  customer_id INT NOT NULL,
  route_id INT NULL,
  warehouse_id INT NOT NULL,
  delivery_date DATETIME(3) NOT NULL,
  status ENUM('PLANNED', 'DISPATCHED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PLANNED',
  driver_name VARCHAR(160) NULL,
  vehicle_number VARCHAR(80) NULL,
  received_by VARCHAR(160) NULL,
  proof_notes VARCHAR(500) NULL,
  notes VARCHAR(500) NULL,
  dispatched_at DATETIME(3) NULL,
  delivered_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by_id INT NULL,
  updated_by_id INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY deliveries_delivery_number_key (delivery_number),
  UNIQUE KEY deliveries_order_id_key (order_id),
  KEY deliveries_customer_id_idx (customer_id),
  KEY deliveries_route_id_idx (route_id),
  KEY deliveries_warehouse_id_idx (warehouse_id),
  KEY deliveries_delivery_date_idx (delivery_date),
  KEY deliveries_status_idx (status),
  CONSTRAINT deliveries_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT deliveries_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT deliveries_route_id_fkey FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT deliveries_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS delivery_items (
  id INT NOT NULL AUTO_INCREMENT,
  delivery_id INT NOT NULL,
  order_item_id INT NOT NULL,
  product_id INT NOT NULL,
  ordered_quantity DECIMAL(12, 3) NOT NULL,
  delivered_quantity DECIMAL(12, 3) NOT NULL DEFAULT 0,
  rejected_quantity DECIMAL(12, 3) NOT NULL DEFAULT 0,
  notes VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY delivery_items_delivery_id_order_item_id_key (delivery_id, order_item_id),
  KEY delivery_items_product_id_idx (product_id),
  CONSTRAINT delivery_items_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT delivery_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT delivery_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_invoices (
  id INT NOT NULL AUTO_INCREMENT,
  invoice_number VARCHAR(40) NOT NULL,
  order_id INT NULL,
  customer_id INT NOT NULL,
  invoice_date DATETIME(3) NOT NULL,
  due_date DATETIME(3) NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  discount_total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  return_total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  balance_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  status ENUM('ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED') NOT NULL DEFAULT 'ISSUED',
  notes VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by_id INT NULL,
  updated_by_id INT NULL,
  deleted_at DATETIME(3) NULL,
  deleted_by_id INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY sales_invoices_invoice_number_key (invoice_number),
  UNIQUE KEY sales_invoices_order_id_key (order_id),
  KEY sales_invoices_customer_id_idx (customer_id),
  KEY sales_invoices_invoice_date_idx (invoice_date),
  KEY sales_invoices_due_date_idx (due_date),
  KEY sales_invoices_status_idx (status),
  CONSTRAINT sales_invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT sales_invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_invoice_items (
  id INT NOT NULL AUTO_INCREMENT,
  sales_invoice_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity DECIMAL(12, 3) NOT NULL,
  free_quantity DECIMAL(12, 3) NOT NULL DEFAULT 0,
  unit_price DECIMAL(12, 2) NOT NULL,
  discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12, 2) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY sales_invoice_items_sales_invoice_id_idx (sales_invoice_id),
  KEY sales_invoice_items_product_id_idx (product_id),
  CONSTRAINT sales_invoice_items_sales_invoice_id_fkey FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT sales_invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id INT NOT NULL AUTO_INCREMENT,
  payment_number VARCHAR(40) NOT NULL,
  customer_id INT NOT NULL,
  sales_invoice_id INT NULL,
  payment_date DATETIME(3) NOT NULL,
  method ENUM('CASH', 'CHEQUE', 'BANK_TRANSFER', 'CARD') NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  status ENUM('POSTED', 'CANCELLED') NOT NULL DEFAULT 'POSTED',
  notes VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by_id INT NULL,
  cancelled_at DATETIME(3) NULL,
  cancelled_by_id INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY payments_payment_number_key (payment_number),
  KEY payments_customer_id_idx (customer_id),
  KEY payments_sales_invoice_id_idx (sales_invoice_id),
  KEY payments_payment_date_idx (payment_date),
  KEY payments_method_idx (method),
  KEY payments_status_idx (status),
  CONSTRAINT payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT payments_sales_invoice_id_fkey FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cheques (
  id INT NOT NULL AUTO_INCREMENT,
  payment_id INT NULL,
  customer_id INT NOT NULL,
  sales_invoice_id INT NULL,
  cheque_number VARCHAR(80) NOT NULL,
  bank_name VARCHAR(160) NOT NULL,
  branch_name VARCHAR(160) NULL,
  cheque_date DATETIME(3) NOT NULL,
  received_date DATETIME(3) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  status ENUM('RECEIVED', 'DEPOSITED', 'REALIZED', 'RETURNED', 'CANCELLED') NOT NULL DEFAULT 'RECEIVED',
  returned_reason VARCHAR(500) NULL,
  deposited_at DATETIME(3) NULL,
  realized_at DATETIME(3) NULL,
  returned_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by_id INT NULL,
  updated_by_id INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY cheques_payment_id_key (payment_id),
  UNIQUE KEY cheques_bank_name_cheque_number_key (bank_name, cheque_number),
  KEY cheques_customer_id_idx (customer_id),
  KEY cheques_sales_invoice_id_idx (sales_invoice_id),
  KEY cheques_status_idx (status),
  CONSTRAINT cheques_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT cheques_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT cheques_sales_invoice_id_fkey FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_returns (
  id INT NOT NULL AUTO_INCREMENT,
  return_number VARCHAR(40) NOT NULL,
  customer_id INT NOT NULL,
  order_id INT NULL,
  sales_invoice_id INT NULL,
  return_date DATETIME(3) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  status ENUM('REQUESTED', 'APPROVED', 'RECEIVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
  notes VARCHAR(500) NULL,
  review_note VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by_id INT NULL,
  reviewed_at DATETIME(3) NULL,
  reviewed_by_id INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY sales_returns_return_number_key (return_number),
  KEY sales_returns_customer_id_idx (customer_id),
  KEY sales_returns_order_id_idx (order_id),
  KEY sales_returns_sales_invoice_id_idx (sales_invoice_id),
  KEY sales_returns_return_date_idx (return_date),
  KEY sales_returns_status_idx (status),
  CONSTRAINT sales_returns_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT sales_returns_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT sales_returns_sales_invoice_id_fkey FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_return_items (
  id INT NOT NULL AUTO_INCREMENT,
  sales_return_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity DECIMAL(12, 3) NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  line_total DECIMAL(12, 2) NOT NULL,
  notes VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY sales_return_items_sales_return_id_idx (sales_return_id),
  KEY sales_return_items_product_id_idx (product_id),
  CONSTRAINT sales_return_items_sales_return_id_fkey FOREIGN KEY (sales_return_id) REFERENCES sales_returns(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT sales_return_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS credit_override_requests (
  id INT NOT NULL AUTO_INCREMENT,
  customer_id INT NOT NULL,
  order_id INT NULL,
  requested_by_id INT NOT NULL,
  reviewed_by_id INT NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  requested_amount DECIMAL(12, 2) NOT NULL,
  outstanding_balance DECIMAL(12, 2) NOT NULL,
  credit_limit DECIMAL(12, 2) NOT NULL,
  reason VARCHAR(500) NULL,
  review_note VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  reviewed_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY credit_override_requests_customer_id_idx (customer_id),
  KEY credit_override_requests_order_id_idx (order_id),
  KEY credit_override_requests_requested_by_id_idx (requested_by_id),
  KEY credit_override_requests_reviewed_by_id_idx (reviewed_by_id),
  KEY credit_override_requests_status_idx (status),
  CONSTRAINT credit_override_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT credit_override_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT credit_override_requests_requested_by_id_fkey FOREIGN KEY (requested_by_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT credit_override_requests_reviewed_by_id_fkey FOREIGN KEY (reviewed_by_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
