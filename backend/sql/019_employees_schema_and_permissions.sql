CREATE TABLE employees (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(40) NOT NULL,
  user_id INT NOT NULL,
  office_id INT NOT NULL,
  branch_id INT NULL,
  warehouse_id INT NOT NULL,
  designation VARCHAR(120) NULL,
  status ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id INT NULL,
  updated_by_id INT NULL,
  deleted_at DATETIME NULL,
  deleted_by_id INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY employees_code_key (code),
  UNIQUE KEY employees_user_id_key (user_id),
  KEY employees_office_id_idx (office_id),
  KEY employees_branch_id_idx (branch_id),
  KEY employees_warehouse_id_idx (warehouse_id),
  KEY employees_status_idx (status),
  CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT employees_office_id_fkey FOREIGN KEY (office_id) REFERENCES offices(id),
  CONSTRAINT employees_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES offices(id),
  CONSTRAINT employees_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);

INSERT INTO permissions (code, name, module, description) VALUES
  ('employees.read', 'Read employees', 'employees', 'View employee records'),
  ('employees.create', 'Create employees', 'employees', 'Create employees linked to user accounts'),
  ('employees.update', 'Update employees', 'employees', 'Update employee assignments'),
  ('employees.delete', 'Delete employees', 'employees', 'Soft delete employees')
ON DUPLICATE KEY UPDATE name = VALUES(name), module = VALUES(module), description = VALUES(description);

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code LIKE 'employees.%' WHERE r.code = 'SUPER_ADMIN';
