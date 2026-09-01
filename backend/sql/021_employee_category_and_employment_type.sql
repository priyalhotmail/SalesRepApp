-- Classifies employees so only Driver employees can be assigned to delivery routes.
ALTER TABLE employees
  ADD COLUMN category ENUM('DRIVER', 'SALES_REP', 'MANAGER', 'WAREHOUSE_OFFICER', 'OTHER') NOT NULL DEFAULT 'OTHER' AFTER warehouse_id,
  ADD COLUMN employment_type ENUM('PERMANENT', 'CONTRACT', 'TEMPORARY') NOT NULL DEFAULT 'PERMANENT' AFTER category,
  ADD KEY employees_category_idx (category),
  ADD KEY employees_employment_type_idx (employment_type);
