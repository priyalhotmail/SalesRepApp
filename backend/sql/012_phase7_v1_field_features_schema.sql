SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'latitude') = 0,
  'ALTER TABLE customers ADD COLUMN latitude DECIMAL(10, 7) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'longitude') = 0,
  'ALTER TABLE customers ADD COLUMN longitude DECIMAL(10, 7) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'geo_accuracy_meters') = 0,
  'ALTER TABLE customers ADD COLUMN geo_accuracy_meters DECIMAL(10, 2) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'geo_captured_at') = 0,
  'ALTER TABLE customers ADD COLUMN geo_captured_at DATETIME(3) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'customers_latitude_longitude_idx') = 0,
  'CREATE INDEX customers_latitude_longitude_idx ON customers(latitude, longitude)',
  'SELECT 1'
);
PREPARE stmt FROM @idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE inventory_movements
  MODIFY movement_type ENUM(
    'STOCK_ADJUSTMENT',
    'RESERVATION',
    'RESERVATION_RELEASE',
    'RESERVATION_CONSUME',
    'RETURN_RECEIPT',
    'TRANSFER_DISPATCH',
    'TRANSFER_RECEIPT'
  ) NOT NULL;

CREATE TABLE IF NOT EXISTS sales_targets (
  id INT NOT NULL AUTO_INCREMENT,
  sales_rep_id INT NOT NULL,
  product_id INT NULL,
  target_year INT NOT NULL,
  target_month INT NOT NULL,
  revenue_target DECIMAL(12, 2) NOT NULL DEFAULT 0,
  volume_target DECIMAL(12, 3) NOT NULL DEFAULT 0,
  status ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
  notes VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by_id INT NULL,
  updated_by_id INT NULL,
  deleted_at DATETIME(3) NULL,
  deleted_by_id INT NULL,
  PRIMARY KEY (id),
  KEY sales_targets_sales_rep_id_idx (sales_rep_id),
  KEY sales_targets_product_id_idx (product_id),
  KEY sales_targets_target_year_target_month_idx (target_year, target_month),
  KEY sales_targets_status_idx (status),
  CONSTRAINT sales_targets_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES sales_reps(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT sales_targets_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS commission_rules (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(160) NOT NULL,
  sales_rep_id INT NULL,
  product_id INT NULL,
  rate_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0,
  amount_per_unit DECIMAL(12, 2) NOT NULL DEFAULT 0,
  bonus_threshold DECIMAL(12, 2) NOT NULL DEFAULT 0,
  bonus_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  effective_from DATETIME(3) NOT NULL,
  effective_to DATETIME(3) NULL,
  status ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by_id INT NULL,
  updated_by_id INT NULL,
  deleted_at DATETIME(3) NULL,
  deleted_by_id INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY commission_rules_code_key (code),
  KEY commission_rules_sales_rep_id_idx (sales_rep_id),
  KEY commission_rules_product_id_idx (product_id),
  KEY commission_rules_effective_from_effective_to_idx (effective_from, effective_to),
  KEY commission_rules_status_idx (status),
  CONSTRAINT commission_rules_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES sales_reps(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT commission_rules_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS commission_runs (
  id INT NOT NULL AUTO_INCREMENT,
  sales_rep_id INT NOT NULL,
  period_year INT NOT NULL,
  period_month INT NOT NULL,
  revenue_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  volume_amount DECIMAL(12, 3) NOT NULL DEFAULT 0,
  commission_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  bonus_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  status ENUM('DRAFT', 'APPROVED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  calculated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  approved_at DATETIME(3) NULL,
  paid_at DATETIME(3) NULL,
  created_by_id INT NULL,
  approved_by_id INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY commission_runs_sales_rep_id_period_year_period_month_key (sales_rep_id, period_year, period_month),
  KEY commission_runs_status_idx (status),
  CONSTRAINT commission_runs_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES sales_reps(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS warehouse_transfers (
  id INT NOT NULL AUTO_INCREMENT,
  transfer_number VARCHAR(40) NOT NULL,
  from_warehouse_id INT NOT NULL,
  to_warehouse_id INT NOT NULL,
  status ENUM('REQUESTED', 'APPROVED', 'REJECTED', 'DISPATCHED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
  notes VARCHAR(500) NULL,
  requested_by_id INT NOT NULL,
  approved_by_id INT NULL,
  dispatched_by_id INT NULL,
  received_by_id INT NULL,
  requested_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  approved_at DATETIME(3) NULL,
  dispatched_at DATETIME(3) NULL,
  received_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY warehouse_transfers_transfer_number_key (transfer_number),
  KEY warehouse_transfers_from_warehouse_id_idx (from_warehouse_id),
  KEY warehouse_transfers_to_warehouse_id_idx (to_warehouse_id),
  KEY warehouse_transfers_status_idx (status),
  KEY warehouse_transfers_requested_at_idx (requested_at),
  CONSTRAINT warehouse_transfers_from_warehouse_id_fkey FOREIGN KEY (from_warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT warehouse_transfers_to_warehouse_id_fkey FOREIGN KEY (to_warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT warehouse_transfers_requested_by_id_fkey FOREIGN KEY (requested_by_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT warehouse_transfers_approved_by_id_fkey FOREIGN KEY (approved_by_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT warehouse_transfers_dispatched_by_id_fkey FOREIGN KEY (dispatched_by_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT warehouse_transfers_received_by_id_fkey FOREIGN KEY (received_by_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS warehouse_transfer_items (
  id INT NOT NULL AUTO_INCREMENT,
  warehouse_transfer_id INT NOT NULL,
  product_id INT NOT NULL,
  requested_quantity DECIMAL(12, 3) NOT NULL,
  approved_quantity DECIMAL(12, 3) NOT NULL DEFAULT 0,
  dispatched_quantity DECIMAL(12, 3) NOT NULL DEFAULT 0,
  received_quantity DECIMAL(12, 3) NOT NULL DEFAULT 0,
  notes VARCHAR(500) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY warehouse_transfer_items_warehouse_transfer_id_product_id_key (warehouse_transfer_id, product_id),
  KEY warehouse_transfer_items_product_id_idx (product_id),
  CONSTRAINT warehouse_transfer_items_warehouse_transfer_id_fkey FOREIGN KEY (warehouse_transfer_id) REFERENCES warehouse_transfers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT warehouse_transfer_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS warehouse_transfer_status_history (
  id INT NOT NULL AUTO_INCREMENT,
  warehouse_transfer_id INT NOT NULL,
  old_status ENUM('REQUESTED', 'APPROVED', 'REJECTED', 'DISPATCHED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED') NULL,
  new_status ENUM('REQUESTED', 'APPROVED', 'REJECTED', 'DISPATCHED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED') NOT NULL,
  notes VARCHAR(500) NULL,
  changed_by_id INT NULL,
  changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY warehouse_transfer_status_history_warehouse_transfer_id_idx (warehouse_transfer_id),
  KEY warehouse_transfer_status_history_changed_by_id_idx (changed_by_id),
  KEY warehouse_transfer_status_history_changed_at_idx (changed_at),
  CONSTRAINT warehouse_transfer_status_history_warehouse_transfer_id_fkey FOREIGN KEY (warehouse_transfer_id) REFERENCES warehouse_transfers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT warehouse_transfer_status_history_changed_by_id_fkey FOREIGN KEY (changed_by_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_visits (
  id INT NOT NULL AUTO_INCREMENT,
  customer_id INT NOT NULL,
  sales_rep_id INT NULL,
  visit_type ENUM('SALES', 'COLLECTION', 'COMPLAINT', 'DELIVERY_FOLLOW_UP') NOT NULL,
  status ENUM('PLANNED', 'COMPLETED', 'MISSED', 'CANCELLED') NOT NULL DEFAULT 'PLANNED',
  outcome ENUM('ORDER_PLACED', 'NO_ORDER', 'COLLECTION_RECEIVED', 'COMPLAINT_RECORDED', 'FOLLOW_UP_REQUIRED', 'OTHER') NULL,
  planned_at DATETIME(3) NULL,
  visited_at DATETIME(3) NULL,
  no_order_reason VARCHAR(500) NULL,
  collection_amount DECIMAL(12, 2) NULL,
  complaint_notes VARCHAR(500) NULL,
  latitude DECIMAL(10, 7) NULL,
  longitude DECIMAL(10, 7) NULL,
  geo_accuracy_meters DECIMAL(10, 2) NULL,
  notes VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by_id INT NULL,
  updated_by_id INT NULL,
  PRIMARY KEY (id),
  KEY customer_visits_customer_id_idx (customer_id),
  KEY customer_visits_sales_rep_id_idx (sales_rep_id),
  KEY customer_visits_visit_type_idx (visit_type),
  KEY customer_visits_status_idx (status),
  KEY customer_visits_planned_at_idx (planned_at),
  KEY customer_visits_visited_at_idx (visited_at),
  CONSTRAINT customer_visits_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT customer_visits_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES sales_reps(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attachments (
  id INT NOT NULL AUTO_INCREMENT,
  owner_type ENUM('CUSTOMER', 'ORDER', 'DELIVERY', 'SALES_INVOICE', 'PAYMENT', 'CHEQUE', 'RETURN', 'CUSTOMER_VISIT', 'PRODUCT', 'WAREHOUSE_TRANSFER') NOT NULL,
  owner_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size INT NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  checksum VARCHAR(128) NULL,
  status ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
  uploaded_by_id INT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  deleted_by_id INT NULL,
  PRIMARY KEY (id),
  KEY attachments_owner_type_owner_id_idx (owner_type, owner_id),
  KEY attachments_status_idx (status),
  CONSTRAINT attachments_uploaded_by_id_fkey FOREIGN KEY (uploaded_by_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NULL,
  title VARCHAR(160) NOT NULL,
  message VARCHAR(500) NOT NULL,
  type ENUM('INFO', 'SUCCESS', 'WARNING', 'ERROR') NOT NULL DEFAULT 'INFO',
  module VARCHAR(80) NULL,
  entity_type VARCHAR(120) NULL,
  entity_id VARCHAR(120) NULL,
  status ENUM('UNREAD', 'READ', 'ARCHIVED') NOT NULL DEFAULT 'UNREAD',
  read_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_by_id INT NULL,
  PRIMARY KEY (id),
  KEY notifications_user_id_idx (user_id),
  KEY notifications_status_idx (status),
  KEY notifications_created_at_idx (created_at),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT notifications_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
