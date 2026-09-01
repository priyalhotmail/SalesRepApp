ALTER TABLE routes ADD COLUMN driver_id INT NULL AFTER office_id,
  ADD KEY routes_driver_id_idx (driver_id),
  ADD CONSTRAINT routes_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES employees(id);

CREATE TABLE delivery_plans (
  id INT NOT NULL AUTO_INCREMENT,
  plan_number VARCHAR(40) NOT NULL,
  route_id INT NOT NULL,
  warehouse_id INT NOT NULL,
  driver_id INT NOT NULL,
  planned_date DATETIME NOT NULL,
  status ENUM('PLANNED','LOADED','CANCELLED') NOT NULL DEFAULT 'PLANNED',
  loading_confirmed_at DATETIME NULL,
  loading_confirmed_by_id INT NULL,
  notes VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id INT NULL,
  updated_by_id INT NULL,
  PRIMARY KEY (id), UNIQUE KEY delivery_plans_plan_number_key (plan_number),
  KEY delivery_plans_route_id_idx (route_id), KEY delivery_plans_warehouse_id_idx (warehouse_id),
  KEY delivery_plans_driver_id_idx (driver_id), KEY delivery_plans_planned_date_idx (planned_date), KEY delivery_plans_status_idx (status),
  CONSTRAINT delivery_plans_route_id_fkey FOREIGN KEY (route_id) REFERENCES routes(id),
  CONSTRAINT delivery_plans_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT delivery_plans_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES employees(id)
);
CREATE TABLE delivery_plan_orders (
  delivery_plan_id INT NOT NULL, order_id INT NOT NULL,
  PRIMARY KEY (delivery_plan_id, order_id), KEY delivery_plan_orders_order_id_idx (order_id),
  CONSTRAINT delivery_plan_orders_plan_id_fkey FOREIGN KEY (delivery_plan_id) REFERENCES delivery_plans(id),
  CONSTRAINT delivery_plan_orders_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id)
);
ALTER TABLE deliveries ADD COLUMN delivery_plan_id INT NULL AFTER order_id,
  ADD KEY deliveries_delivery_plan_id_idx (delivery_plan_id),
  ADD CONSTRAINT deliveries_delivery_plan_id_fkey FOREIGN KEY (delivery_plan_id) REFERENCES delivery_plans(id);
