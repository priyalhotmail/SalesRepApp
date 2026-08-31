ALTER TABLE sales_reps
  ADD COLUMN warehouse_id INT NULL AFTER user_id,
  ADD KEY sales_reps_warehouse_id_idx (warehouse_id),
  ADD CONSTRAINT sales_reps_warehouse_id_fkey
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE route_customers
  ADD COLUMN is_primary BOOLEAN NOT NULL DEFAULT FALSE AFTER customer_id,
  ADD COLUMN status ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', 'DELETED') NOT NULL DEFAULT 'ACTIVE' AFTER is_primary,
  ADD KEY route_customers_customer_primary_status_idx (customer_id, is_primary, status),
  ADD KEY route_customers_route_status_idx (route_id, status);

UPDATE route_customers rc
JOIN (
  SELECT customer_id, MIN(route_id) AS route_id
  FROM route_customers
  WHERE status = 'ACTIVE'
  GROUP BY customer_id
) primary_routes
  ON primary_routes.customer_id = rc.customer_id
 AND primary_routes.route_id = rc.route_id
SET rc.is_primary = TRUE;

UPDATE sales_reps sr
JOIN (
  SELECT office_id, MIN(id) AS warehouse_id
  FROM warehouses
  WHERE status = 'ACTIVE'
    AND office_id IS NOT NULL
  GROUP BY office_id
) office_warehouses
  ON office_warehouses.office_id = sr.office_id
SET sr.warehouse_id = office_warehouses.warehouse_id
WHERE sr.warehouse_id IS NULL;

INSERT INTO audit_logs (
  action,
  entity_type,
  entity_id,
  new_values
) VALUES (
  'PHASE9_SALES_REP_WAREHOUSE_PRIMARY_ROUTE_SCHEMA_APPLIED',
  'system',
  'phase9',
  JSON_OBJECT(
    'salesRepWarehouse', 'sales_reps.warehouse_id',
    'primaryRoute', 'route_customers.is_primary/status'
  )
);
