CREATE TABLE IF NOT EXISTS product_groups (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(160) NOT NULL,
  description VARCHAR(500) NULL,
  status ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by_id INT NULL,
  updated_by_id INT NULL,
  deleted_at DATETIME(3) NULL,
  deleted_by_id INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY product_groups_code_key (code),
  KEY product_groups_status_idx (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id INT NOT NULL AUTO_INCREMENT,
  product_group_id INT NOT NULL,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(180) NOT NULL,
  price DECIMAL(12, 2) NOT NULL,
  capacity DECIMAL(12, 3) NOT NULL,
  unit_type ENUM('GM', 'KG', 'ML', 'L') NOT NULL,
  supports_bulk BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by_id INT NULL,
  updated_by_id INT NULL,
  deleted_at DATETIME(3) NULL,
  deleted_by_id INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY products_code_key (code),
  KEY products_product_group_id_idx (product_group_id),
  KEY products_status_idx (status),
  CONSTRAINT products_product_group_id_fkey FOREIGN KEY (product_group_id) REFERENCES product_groups(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_packaging_options (
  id INT NOT NULL AUTO_INCREMENT,
  product_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  unit_quantity INT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY product_packaging_options_product_id_name_key (product_id, name),
  KEY product_packaging_options_product_id_idx (product_id),
  KEY product_packaging_options_status_idx (status),
  CONSTRAINT product_packaging_options_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_factory_sources (
  product_id INT NOT NULL,
  factory_id INT NOT NULL,
  assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (product_id, factory_id),
  KEY product_factory_sources_factory_id_idx (factory_id),
  CONSTRAINT product_factory_sources_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT product_factory_sources_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_groups (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(160) NOT NULL,
  description VARCHAR(500) NULL,
  status ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by_id INT NULL,
  updated_by_id INT NULL,
  deleted_at DATETIME(3) NULL,
  deleted_by_id INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY customer_groups_code_key (code),
  KEY customer_groups_status_idx (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_group_members (
  customer_group_id INT NOT NULL,
  customer_id INT NOT NULL,
  assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  assigned_by_id INT NULL,
  PRIMARY KEY (customer_group_id, customer_id),
  KEY customer_group_members_customer_id_idx (customer_id),
  CONSTRAINT customer_group_members_customer_group_id_fkey FOREIGN KEY (customer_group_id) REFERENCES customer_groups(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT customer_group_members_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS price_lists (
  id INT NOT NULL AUTO_INCREMENT,
  company_id INT NOT NULL,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(160) NOT NULL,
  effective_from DATETIME(3) NOT NULL,
  effective_to DATETIME(3) NULL,
  status ENUM('DRAFT', 'ACTIVE', 'SCHEDULED', 'ARCHIVED', 'DELETED') NOT NULL DEFAULT 'DRAFT',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by_id INT NULL,
  updated_by_id INT NULL,
  deleted_at DATETIME(3) NULL,
  deleted_by_id INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY price_lists_code_key (code),
  KEY price_lists_company_id_idx (company_id),
  KEY price_lists_status_idx (status),
  KEY price_lists_effective_from_idx (effective_from),
  CONSTRAINT price_lists_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS price_list_items (
  id INT NOT NULL AUTO_INCREMENT,
  price_list_id INT NOT NULL,
  product_id INT NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY price_list_items_price_list_id_product_id_key (price_list_id, product_id),
  KEY price_list_items_product_id_idx (product_id),
  CONSTRAINT price_list_items_price_list_id_fkey FOREIGN KEY (price_list_id) REFERENCES price_lists(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT price_list_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS price_list_assignments (
  id INT NOT NULL AUTO_INCREMENT,
  price_list_id INT NOT NULL,
  scope ENUM('GLOBAL', 'CUSTOMER', 'CUSTOMER_GROUP', 'OFFICE') NOT NULL,
  customer_id INT NULL,
  customer_group_id INT NULL,
  office_id INT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_by_id INT NULL,
  PRIMARY KEY (id),
  KEY price_list_assignments_price_list_id_idx (price_list_id),
  KEY price_list_assignments_scope_idx (scope),
  KEY price_list_assignments_customer_id_idx (customer_id),
  KEY price_list_assignments_customer_group_id_idx (customer_group_id),
  KEY price_list_assignments_office_id_idx (office_id),
  CONSTRAINT price_list_assignments_price_list_id_fkey FOREIGN KEY (price_list_id) REFERENCES price_lists(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT price_list_assignments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT price_list_assignments_customer_group_id_fkey FOREIGN KEY (customer_group_id) REFERENCES customer_groups(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT price_list_assignments_office_id_fkey FOREIGN KEY (office_id) REFERENCES offices(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_price_history (
  id INT NOT NULL AUTO_INCREMENT,
  product_id INT NOT NULL,
  price_list_id INT NULL,
  old_price DECIMAL(12, 2) NULL,
  new_price DECIMAL(12, 2) NOT NULL,
  changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  changed_by_id INT NULL,
  PRIMARY KEY (id),
  KEY product_price_history_product_id_idx (product_id),
  KEY product_price_history_price_list_id_idx (price_list_id),
  KEY product_price_history_changed_at_idx (changed_at),
  CONSTRAINT product_price_history_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS discount_classes (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(160) NOT NULL,
  discount_percentage DECIMAL(5, 2) NOT NULL,
  status ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by_id INT NULL,
  updated_by_id INT NULL,
  deleted_at DATETIME(3) NULL,
  deleted_by_id INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY discount_classes_code_key (code),
  KEY discount_classes_status_idx (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_discount_assignments (
  id INT NOT NULL AUTO_INCREMENT,
  customer_id INT NOT NULL,
  discount_class_id INT NOT NULL,
  effective_from DATETIME(3) NOT NULL,
  effective_to DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_by_id INT NULL,
  PRIMARY KEY (id),
  KEY customer_discount_assignments_customer_id_idx (customer_id),
  KEY customer_discount_assignments_discount_class_id_idx (discount_class_id),
  KEY customer_discount_assignments_effective_from_idx (effective_from),
  CONSTRAINT customer_discount_assignments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT customer_discount_assignments_discount_class_id_fkey FOREIGN KEY (discount_class_id) REFERENCES discount_classes(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seasonal_discounts (
  id INT NOT NULL AUTO_INCREMENT,
  product_id INT NOT NULL,
  name VARCHAR(160) NOT NULL,
  value_type ENUM('PERCENTAGE', 'FIXED_AMOUNT') NOT NULL,
  value DECIMAL(12, 2) NOT NULL,
  valid_from DATETIME(3) NOT NULL,
  valid_to DATETIME(3) NOT NULL,
  status ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by_id INT NULL,
  updated_by_id INT NULL,
  deleted_at DATETIME(3) NULL,
  deleted_by_id INT NULL,
  PRIMARY KEY (id),
  KEY seasonal_discounts_product_id_idx (product_id),
  KEY seasonal_discounts_valid_from_valid_to_idx (valid_from, valid_to),
  KEY seasonal_discounts_status_idx (status),
  CONSTRAINT seasonal_discounts_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS free_item_offers (
  id INT NOT NULL AUTO_INCREMENT,
  product_id INT NOT NULL,
  name VARCHAR(160) NOT NULL,
  buy_quantity INT NOT NULL,
  free_quantity INT NOT NULL,
  valid_from DATETIME(3) NOT NULL,
  valid_to DATETIME(3) NOT NULL,
  status ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by_id INT NULL,
  updated_by_id INT NULL,
  deleted_at DATETIME(3) NULL,
  deleted_by_id INT NULL,
  PRIMARY KEY (id),
  KEY free_item_offers_product_id_idx (product_id),
  KEY free_item_offers_valid_from_valid_to_idx (valid_from, valid_to),
  KEY free_item_offers_status_idx (status),
  CONSTRAINT free_item_offers_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS additional_bill_discount_requests (
  id INT NOT NULL AUTO_INCREMENT,
  customer_id INT NOT NULL,
  requested_by_id INT NOT NULL,
  reviewed_by_id INT NULL,
  discount_percentage DECIMAL(5, 2) NOT NULL,
  reason VARCHAR(500) NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'USED') NOT NULL DEFAULT 'PENDING',
  review_note VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  reviewed_at DATETIME(3) NULL,
  used_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY additional_bill_discount_requests_customer_id_idx (customer_id),
  KEY additional_bill_discount_requests_requested_by_id_idx (requested_by_id),
  KEY additional_bill_discount_requests_reviewed_by_id_idx (reviewed_by_id),
  KEY additional_bill_discount_requests_status_idx (status),
  CONSTRAINT additional_bill_discount_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

