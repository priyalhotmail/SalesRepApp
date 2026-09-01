-- Run this only if 019_employees_schema_and_permissions.sql was already applied.
-- Main office employees do not need a branch assignment.
ALTER TABLE employees MODIFY branch_id INT NULL;
