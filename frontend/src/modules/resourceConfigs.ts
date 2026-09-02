import {
  ResourceField,
  ResourcePageConfig
} from "../components/ResourcePage";
import { AuthUser } from "../auth/AuthContext";

export type ResourceRecord = Record<string, unknown>;

const statusOptions = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"].map(toOption);

const reviewNoteField: ResourceField = {
  label: "Review note",
  name: "reviewNote",
  type: "text"
};

const notesField: ResourceField = {
  label: "Notes",
  name: "notes",
  type: "text"
};

const customerReference = {
  endpoint: "customers",
  labelPath: "displayName"
};
const factoryReference = {
  endpoint: "factories",
  labelPath: "name",
  secondaryLabelPath: "code"
};
const officeReference = {
  endpoint: "offices",
  labelPath: "name",
  secondaryLabelPath: "code"
};
const branchReference = {
  endpoint: "offices",
  labelPath: "name",
  query: { officeType: "BRANCH" },
  secondaryLabelPath: "code"
};
const orderReference = {
  endpoint: "orders",
  labelPath: "orderNumber",
  secondaryLabelPath: "customer.displayName"
};
const eligibleInvoiceOrderReference = {
  endpoint: "sales-invoices/eligible-orders",
  labelPath: "orderNumber",
  secondaryLabelPath: "customer.displayName"
};
const productReference = {
  endpoint: "products",
  labelPath: "name"
};
const productGroupReference = {
  endpoint: "product-groups",
  labelPath: "name",
  secondaryLabelPath: "code"
};
const routeReference = {
  endpoint: "routes",
  labelPath: "name",
  secondaryLabelPath: "code"
};
const roleReference = {
  endpoint: "roles",
  labelPath: "name",
  secondaryLabelPath: "code"
};
const salesInvoiceReference = {
  endpoint: "sales-invoices",
  labelPath: "invoiceNumber",
  secondaryLabelPath: "customer.displayName"
};
const salesRepReference = {
  endpoint: "sales-reps",
  labelPath: "name",
  secondaryLabelPath: "code"
};
const userReference = {
  endpoint: "users",
  labelPath: "displayName",
  secondaryLabelPath: "email"
};
const availableEmployeeUserReference = {
  endpoint: "employees/available-users",
  labelPath: "displayName",
  secondaryLabelPath: "email"
};
const warehouseReference = {
  endpoint: "warehouses",
  labelPath: "name",
  secondaryLabelPath: "code"
};
const eligibleDeliveryPlanOrderReference = {
  endpoint: "deliveries/plans/eligible-orders",
  labelPath: "orderNumber",
  secondaryLabelPath: "customer.displayName"
};
const driverReference = {
  endpoint: "deliveries/drivers",
  labelPath: "user.displayName",
  query: { category: "DRIVER", status: "ACTIVE" },
  secondaryLabelPath: "code"
};

function isSuperAdmin(user: AuthUser | null) {
  return user?.roles?.includes("SUPER_ADMIN") ?? false;
}

function hasPermission(user: AuthUser | null, permission: string) {
  return user?.permissions?.includes(permission) ?? false;
}

function isSalesRepOnly(user: AuthUser | null) {
  return Boolean(
    user?.roles?.includes("SALES_REP") &&
    !user.roles.some((role) =>
      ["SUPER_ADMIN", "MAIN_OFFICE_AUTHORIZED_USER", "BRANCH_AUTHORIZED_USER"].includes(role)
    )
  );
}

function isTerminalOrder(row: ResourceRecord) {
  return ["CANCELLED", "DELIVERED"].includes(String(row.status));
}

function orderMessage(row: ResourceRecord, action: "approve" | "reserve") {
  const salesRep = (row.salesRep as ResourceRecord | undefined)?.name ?? "the Sales Rep";
  const customer = (row.customer as ResourceRecord | undefined)?.displayName ?? "the customer";
  const total = Number(row.totalAmount ?? 0).toFixed(2);
  return action === "approve"
    ? `Do you want to approve ${salesRep}'s order ${row.orderNumber} for ${customer}, total amount ${total}?`
    : `Do you want to reserve stock for ${salesRep}'s order ${row.orderNumber} for ${customer}, total amount ${total}?`;
}

function formatPlanDate(value: unknown) {
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? ""
    : `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

export const resourceConfigs: Record<string, ResourcePageConfig<ResourceRecord>> = {
  users: {
    columns: [
      { label: "Email", path: "email" },
      { label: "Name", path: "displayName" },
      { label: "Phone", path: "telephone" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "users",
    deleteEndpoint: (row) => `users/${row.id}`,
    endpoint: "users",
    requiredPermissions: ["users.read"],
    fields: [
      { createOnly: true, label: "Email", name: "email", required: true },
      { label: "Display name", name: "displayName", required: true },
      { createOnly: true, label: "Password", name: "password" },
      { label: "Telephone", name: "telephone" },
      { label: "Roles", name: "roleIds", reference: roleReference, required: true, type: "multiReference" },
      { label: "Status", name: "status", options: statusOptions, type: "select" }
    ],
    roleAssignmentEndpoint: (row) => `users/${row.id}/roles`,
    title: "Users",
    updateEndpoint: (row) => `users/${row.id}`
  },
  salesReps: {
    columns: [
      { label: "Code", path: "code" },
      { label: "Name", path: "name" },
      { label: "Office", path: "office.name" },
      { label: "Driver", path: "driver.user.displayName" },
      { label: "Phone", path: "telephone" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "sales-reps",
    deleteEndpoint: (row) => `sales-reps/${row.id}`,
    endpoint: "sales-reps",
    requiredPermissions: ["sales_reps.read"],
    fields: [
      { label: "Office", name: "officeId", reference: officeReference, required: true, type: "number" },
      { label: "Linked user", name: "userId", reference: userReference, type: "number" },
      { label: "Primary warehouse", name: "warehouseId", reference: warehouseReference, type: "number" },
      { label: "Name", name: "name", required: true },
      { label: "NIC", name: "nic", required: true },
      { label: "Address", name: "address" },
      { label: "Telephone", name: "telephone" },
      { label: "Email", name: "email" },
      { label: "Status", name: "status", options: statusOptions, type: "select" }
    ],
    title: "Sales Reps",
    updateEndpoint: (row) => `sales-reps/${row.id}`
  },
  employees: {
    columns: [
      { label: "Code", path: "code" },
      { label: "Employee", path: "user.displayName" },
      { label: "Office", path: "office.name" },
      { label: "Branch", path: "branch.name" },
      { label: "Warehouse", path: "warehouse.name" },
      { label: "Category", path: "category" },
      { label: "Employment", path: "employmentType" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "employees",
    deleteEndpoint: (row) => `employees/${row.id}`,
    detailEndpoint: (row) => `employees/${row.id}`,
    endpoint: "employees",
    requiredPermissions: ["employees.read"],
    fields: [
      { createOnly: true, label: "User account", name: "userId", reference: availableEmployeeUserReference, required: true, type: "number" },
      { label: "Office", name: "officeId", reference: officeReference, required: true, type: "number" },
      { label: "Branch (not needed for Main Office)", name: "branchId", reference: branchReference, type: "number" },
      { label: "Warehouse", name: "warehouseId", reference: warehouseReference, required: true, type: "number" },
      { label: "Category", name: "category", options: ["DRIVER", "SALES_REP", "MANAGER", "WAREHOUSE_OFFICER", "OTHER"].map(toOption), required: true, type: "select" },
      { label: "Employment type", name: "employmentType", options: ["PERMANENT", "CONTRACT", "TEMPORARY"].map(toOption), required: true, type: "select" },
      { label: "Designation", name: "designation" },
      { label: "Status", name: "status", options: statusOptions, type: "select" }
    ],
    title: "Employees",
    updateEndpoint: (row) => `employees/${row.id}`
  },
  offices: {
    columns: [
      { label: "Code", path: "code" },
      { label: "Name", path: "name" },
      { label: "Type", path: "officeType" },
      { label: "Phone", path: "telephone" },
      { label: "Status", path: "status", visible: (user) => !isSalesRepOnly(user) }
    ],
    createEndpoint: "offices",
    deleteEndpoint: (row) => `offices/${row.id}`,
    endpoint: "offices",
    requiredPermissions: ["company_structure.read"],
    fields: [
      { label: "Name", name: "name", required: true },
      { label: "Office type", name: "officeType", options: ["MAIN", "BRANCH"].map(toOption), required: true, type: "select" },
      { label: "Address", name: "address" },
      { label: "Email", name: "email" },
      { label: "Contact person", name: "contactPerson" },
      { label: "Telephone", name: "telephone" },
      { label: "Status", name: "status", options: statusOptions, type: "select" }
    ],
    title: "Offices",
    updateEndpoint: (row) => `offices/${row.id}`
  },
  factories: {
    columns: [
      { label: "Code", path: "code" },
      { label: "Name", path: "name" },
      { label: "Phone", path: "telephone" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "factories",
    deleteEndpoint: (row) => `factories/${row.id}`,
    endpoint: "factories",
    requiredPermissions: ["company_structure.read"],
    fields: [
      { label: "Name", name: "name", required: true },
      { label: "Address", name: "address" },
      { label: "Email", name: "email" },
      { label: "Contact person", name: "contactPerson" },
      { label: "Telephone", name: "telephone" },
      { label: "Status", name: "status", options: statusOptions, type: "select" }
    ],
    title: "Factories",
    updateEndpoint: (row) => `factories/${row.id}`
  },
  warehouses: {
    columns: [
      { label: "Code", path: "code" },
      { label: "Name", path: "name" },
      { label: "Type", path: "warehouseType" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "warehouses",
    deleteEndpoint: (row) => `warehouses/${row.id}`,
    endpoint: "warehouses",
    requiredPermissions: ["company_structure.read"],
    fields: [
      { label: "Office", name: "officeId", reference: officeReference, type: "number" },
      { label: "Factory", name: "factoryId", reference: factoryReference, type: "number" },
      { label: "Name", name: "name", required: true },
      { label: "Warehouse type", name: "warehouseType", options: ["MAIN", "FACTORY_FINAL_PRODUCT", "BRANCH"].map(toOption), required: true, type: "select" },
      { label: "Address", name: "address" },
      { label: "Email", name: "email" },
      { label: "Contact person", name: "contactPerson" },
      { label: "Telephone", name: "telephone" },
      { label: "Status", name: "status", options: statusOptions, type: "select" }
    ],
    title: "Warehouses",
    updateEndpoint: (row) => `warehouses/${row.id}`
  },
  customers: {
    columns: [
      { label: "Code", path: "code" },
      { label: "Name", path: "displayName" },
      { label: "Type", path: "customerType" },
      { label: "Sales rep", path: "salesRep.name" },
      { label: "Status", path: "status", visible: (user) => !isSalesRepOnly(user) }
    ],
    createEndpoint: "customers",
    deleteEndpoint: (row) => `customers/${row.id}`,
    endpoint: "customers",
    formContextEndpoint: "customers/new-context",
    requiredPermissions: ["customers.read"],
    fields: [
      { label: "Office", loadOptions: false, name: "officeId", reference: officeReference, required: true, type: "number" },
      { label: "Sales rep", loadOptions: false, name: "salesRepId", reference: salesRepReference, type: "number" },
      { label: "Route", loadOptions: false, name: "routeId", reference: routeReference, required: true, type: "number" },
      { createOnly: true, label: "Customer type", name: "customerType", options: ["BUSINESS", "INDIVIDUAL"].map(toOption), required: true, type: "select" },
      { label: "Display name", name: "displayName", required: true },
      { label: "Registration number", name: "registrationNumber" },
      { label: "VAT registration number", name: "vatRegistrationNumber" },
      { label: "Contact person", name: "contactPerson" },
      { label: "NIC", name: "nic" },
      { label: "Address", name: "address" },
      { label: "Telephone", name: "telephone" },
      { label: "Email", name: "email" },
      { label: "Status", name: "status", options: statusOptions, type: "select", visible: (user) => !isSalesRepOnly(user) }
    ],
    title: "Customers",
    updateEndpoint: (row) => `customers/${row.id}`
  },
  customerApprovals: {
    actions: [
      { bodyFields: [reviewNoteField], endpoint: (row) => `customer-change-requests/${row.id}/approve`, label: "Approve" },
      { bodyFields: [reviewNoteField], endpoint: (row) => `customer-change-requests/${row.id}/reject`, label: "Reject" }
    ],
    columns: [
      { label: "Customer", path: "customer.displayName" },
      { label: "Status", path: "status" },
      { label: "Reason", path: "reason" },
      { label: "Requested", path: "createdAt" }
    ],
    endpoint: "customer-change-requests",
    requiredPermissions: ["customers.approve_change"],
    title: "Customer Approval Requests"
  },
  productGroups: {
    columns: [
      { label: "Code", path: "code" },
      { label: "Name", path: "name" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "product-groups",
    deleteEndpoint: (row) => `product-groups/${row.id}`,
    endpoint: "product-groups",
    requiredPermissions: ["product_catalogue.read"],
    fields: [
      { label: "Name", name: "name", required: true },
      { label: "Description", name: "description" },
      { label: "Status", name: "status", options: statusOptions, type: "select" }
    ],
    title: "Product Groups",
    updateEndpoint: (row) => `product-groups/${row.id}`
  },
  products: {
    columns: [
      { label: "Code", path: "code" },
      { label: "Name", path: "name" },
      { label: "Group", path: "productGroup.name" },
      { label: "Price", path: "price" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "products",
    deleteEndpoint: (row) => `products/${row.id}`,
    detailEndpoint: (row) => `products/${row.id}`,
    endpoint: "products",
    requiredPermissions: ["product_catalogue.read"],
    fields: [
      { label: "Product group", name: "productGroupId", reference: productGroupReference, required: true, type: "number" },
      { label: "Name", name: "name", required: true },
      { label: "Price", name: "price", required: true, type: "number" },
      { label: "Capacity", name: "capacity", required: true, type: "number" },
      { label: "Unit type", name: "unitType", options: ["GM", "KG", "ML", "L"].map(toOption), required: true, type: "select" },
      { label: "Supports bulk", name: "supportsBulk", type: "checkbox" },
      { label: "Status", name: "status", options: statusOptions, type: "select" }
    ],
    title: "Products",
    updateEndpoint: (row) => `products/${row.id}`
  },
  priceLists: {
    actions: [{ endpoint: (row) => `price-lists/${row.id}/activate`, label: "Activate" }],
    columns: [
      { label: "Code", path: "code" },
      { label: "Name", path: "name" },
      { label: "From", path: "effectiveFrom" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "price-lists",
    deleteEndpoint: (row) => `price-lists/${row.id}`,
    endpoint: "price-lists",
    requiredPermissions: ["price_lists.read"],
    fields: [
      { label: "Name", name: "name", required: true },
      { label: "Effective from", name: "effectiveFrom", required: true, type: "datetime" },
      { label: "Effective to", name: "effectiveTo", type: "datetime" },
      { label: "Status", name: "status", options: ["DRAFT", "ACTIVE", "SCHEDULED", "ARCHIVED", "DELETED"].map(toOption), type: "select" }
    ],
    title: "Price Lists",
    updateEndpoint: (row) => `price-lists/${row.id}`
  },
  inventoryStock: {
    columns: [
      { label: "Warehouse", path: "warehouse.name" },
      { label: "Product", path: "product.name" },
      { label: "On hand", path: "onHandQuantity" },
      { label: "Reserved", path: "reservedQuantity" },
      { label: "Available", path: "availableQuantity" }
    ],
    createEndpoint: "inventory/stocks/adjust",
    endpoint: "inventory/stocks",
    requiredPermissions: ["inventory.read"],
    fields: [
      { label: "Warehouse", name: "warehouseId", reference: warehouseReference, required: true, type: "number" },
      { createOnly: true, label: "Product", name: "productId", reference: productReference, required: true, type: "number" },
      { label: "Quantity change", name: "quantityChange", required: true, type: "number" },
      { label: "Low stock threshold", name: "lowStockThreshold", type: "number" },
      notesField
    ],
    title: "Inventory Stock"
  },
  routes: {
    columns: [
      { label: "Code", path: "code" },
      { label: "Name", path: "name" },
      { label: "Office", path: "office.name" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "routes",
    deleteEndpoint: (row) => `routes/${row.id}`,
    endpoint: "routes",
    requiredPermissions: ["routes.read"],
    fields: [
      { createOnly: true, label: "Office", name: "officeId", reference: officeReference, required: true, type: "number" },
      { label: "Driver", name: "driverId", reference: driverReference, type: "number" },
      { label: "Name", name: "name", required: true },
      { label: "Description", name: "description" },
      { label: "Status", name: "status", options: statusOptions, type: "select" }
    ],
    title: "Routes",
    updateEndpoint: (row) => `routes/${row.id}`
  },
  orders: {
    actions: [
      {
        bodyMessage: (row) => orderMessage(row, "approve"),
        disabled: (row) => row.status !== "SUBMITTED",
        endpoint: (row) => `orders/${row.id}/approve`,
        label: "Approve",
        visible: (_, user) => hasPermission(user, "orders.approve")
      },
      {
        bodyMessage: (row) => orderMessage(row, "reserve"),
        disabled: (row) => row.status !== "APPROVED",
        endpoint: (row) => `orders/${row.id}/reserve-stock`,
        label: "Reserve",
        visible: (_, user) => hasPermission(user, "orders.reserve_stock")
      },
      {
        disabled: (row) => isTerminalOrder(row),
        endpoint: (row) => `orders/${row.id}/cancel`,
        label: "Cancel",
        visible: (_, user) => isSuperAdmin(user) || isSalesRepOnly(user)
      }
    ],
    canEdit: (user) => !isSalesRepOnly(user),
    columns: [
      { label: "Number", path: "orderNumber" },
      { label: "Customer", path: "customer.displayName" },
      { label: "Date", path: "orderDate" },
      { label: "Total", path: "totalAmount" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "orders",
    endpoint: "orders",
    requiredPermissions: ["orders.read"],
    fields: [
      { createOnly: true, label: "Customer", name: "customerId", reference: customerReference, required: true, type: "number" },
      { createOnly: true, defaultValue: "now", label: "Order date", name: "orderDate", required: true, type: "datetime" },
      { label: "Items", name: "items", required: true, type: "orderItems" },
      notesField
    ],
    title: "Orders",
    updateEndpoint: (row) => `orders/${row.id}`
  },
  deliveries: {
    actions: [
      { bodyFields: [{ label: "Order items", name: "items", type: "deliveryItemSummary" }], disabled: (row) => row.status !== "PLANNED", endpoint: (row) => `deliveries/${row.id}/dispatch`, label: "Dispatch", visible: (_, user) => hasPermission(user, "delivery.update") },
      { bodyFields: [
        { label: "Received by", name: "receivedBy" },
        { label: "Proof notes", name: "proofNotes" },
        { label: "Items", name: "items", required: true, type: "deliveryItems" }
      ], disabled: (row) => row.status !== "DISPATCHED", endpoint: (row) => `deliveries/${row.id}/confirm`, label: "Confirm", visible: (_, user) => hasPermission(user, "delivery.update") },
      { disabled: (row) => !["PLANNED", "DISPATCHED"].includes(String(row.status)), endpoint: (row) => `deliveries/${row.id}/cancel`, label: "Cancel", visible: (_, user) => hasPermission(user, "delivery.update") }
    ],
    columns: [
      { label: "Number", path: "deliveryNumber" },
      { label: "Customer", path: "customer.displayName" },
      { label: "Date", path: "deliveryDate" },
      { label: "Driver", path: "driverName" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "deliveries",
    canCreate: (user) => hasPermission(user, "delivery.create"),
    endpoint: "deliveries",
    requiredPermissions: ["delivery.read"],
    fields: [
      { label: "Order", name: "orderId", reference: orderReference, required: true, type: "number" },
      { label: "Delivery date", name: "deliveryDate", required: true, type: "datetime" },
      { label: "Driver name", name: "driverName" },
      { label: "Vehicle number", name: "vehicleNumber" },
      notesField
    ],
    title: "Delivery Screen"
  },
  deliveryPlans: {
    actions: [
      { bodyFields: [{ label: "Loading summary", name: "orders", type: "deliveryPlanSummary" }], endpoint: () => "", label: "View Loading Summary", previewOnly: true },
      { bodyMessage: (row) => `${(row.route as ResourceRecord | undefined)?.name ?? "Route"} - ${formatPlanDate(row.plannedDate)} orders are loaded successfully.`, disabled: (row) => row.status !== "PLANNED", endpoint: (row) => `deliveries/plans/${row.id}/confirm-loading`, label: "Confirm Loading", submitLabel: "Confirm", visible: (_, user) => hasPermission(user, "delivery.update") }
    ],
    columns: [
      { label: "Plan", path: "planNumber" },
      { label: "Route", path: "route.name" },
      { label: "Driver", path: "driver.user.displayName" },
      { label: "Warehouse", path: "warehouse.name" },
      { label: "Date", path: "plannedDate" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "deliveries/plans",
    canCreate: (user) => hasPermission(user, "delivery.create"),
    endpoint: "deliveries/plans",
    requiredPermissions: ["delivery.read"],
    fields: [
      { label: "Route", name: "routeId", reference: routeReference, required: true, type: "number" },
      { label: "Driver", name: "driverId", reference: driverReference, required: true, type: "number" },
      { defaultValue: "now", label: "Delivery date", name: "plannedDate", required: true, type: "datetime" },
      { helperText: "Select a route first. Only its stock-reserved orders are listed.", label: "Orders", name: "orderIds", reference: eligibleDeliveryPlanOrderReference, referenceQuery: (values) => ({ routeId: Number(values.routeId) || undefined }), required: true, type: "multiReference" },
      { label: "Loading summary", name: "orderIds", type: "deliveryPlanSummary" },
      notesField
    ],
    title: "Delivery Plans"
  },
  salesInvoices: {
    actions: [{ endpoint: (row) => `sales-invoices/${row.id}/cancel`, label: "Cancel" }],
    columns: [
      { label: "Number", path: "invoiceNumber" },
      { label: "Customer", path: "customer.displayName" },
      { label: "Total", path: "totalAmount" },
      { label: "Balance", path: "balanceAmount" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "sales-invoices/from-order",
    endpoint: "sales-invoices",
    requiredPermissions: ["sales_invoices.read"],
    fields: [
      { label: "Order", name: "orderId", reference: eligibleInvoiceOrderReference, required: true, type: "number" },
      { defaultValue: "now", label: "Invoice date", name: "invoiceDate", type: "datetime" },
      { label: "Due date", name: "dueDate", type: "datetime" },
      notesField
    ],
    title: "Sales Invoices"
  },
  payments: {
    actions: [{ endpoint: (row) => `payments/${row.id}/cancel`, label: "Cancel" }],
    columns: [
      { label: "Number", path: "paymentNumber" },
      { label: "Customer", path: "customer.displayName" },
      { label: "Method", path: "method" },
      { label: "Amount", path: "amount" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "payments",
    endpoint: "payments",
    requiredPermissions: ["payments.read"],
    fields: [
      { label: "Customer", name: "customerId", reference: customerReference, required: true, type: "number" },
      { label: "Sales invoice", name: "salesInvoiceId", reference: salesInvoiceReference, type: "number" },
      { label: "Payment date", name: "paymentDate", required: true, type: "datetime" },
      { label: "Method", name: "method", options: ["CASH", "CHEQUE", "BANK_TRANSFER", "CARD"].map(toOption), required: true, type: "select" },
      { label: "Amount", name: "amount", required: true, type: "number" },
      { helperText: "Required for cheque payments", label: "Cheque", name: "cheque", type: "json" },
      notesField
    ],
    title: "Payment Collection"
  },
  cheques: {
    actions: [
      { endpoint: (row) => `cheques/${row.id}/deposit`, label: "Deposit" },
      { endpoint: (row) => `cheques/${row.id}/realize`, label: "Realize" },
      { bodyFields: [{ label: "Returned reason", name: "returnedReason", required: true }], endpoint: (row) => `cheques/${row.id}/return`, label: "Return" }
    ],
    columns: [
      { label: "Number", path: "chequeNumber" },
      { label: "Bank", path: "bankName" },
      { label: "Customer", path: "customer.displayName" },
      { label: "Amount", path: "amount" },
      { label: "Status", path: "status" }
    ],
    endpoint: "cheques",
    requiredPermissions: ["cheques.read"],
    title: "Cheque Management"
  },
  returns: {
    actions: [
      { bodyFields: [reviewNoteField], endpoint: (row) => `returns/${row.id}/approve`, label: "Approve" },
      { bodyFields: [reviewNoteField], endpoint: (row) => `returns/${row.id}/reject`, label: "Reject" },
      { bodyFields: [{ label: "Warehouse", name: "warehouseId", reference: warehouseReference, required: true, type: "number" }, reviewNoteField], endpoint: (row) => `returns/${row.id}/receive`, label: "Receive" }
    ],
    columns: [
      { label: "Number", path: "returnNumber" },
      { label: "Customer", path: "customer.displayName" },
      { label: "Amount", path: "totalAmount" },
      { label: "Reason", path: "reason" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "returns",
    endpoint: "returns",
    requiredPermissions: ["returns.read"],
    fields: [
      { label: "Customer", name: "customerId", reference: customerReference, required: true, type: "number" },
      { label: "Order", name: "orderId", reference: orderReference, type: "number" },
      { label: "Sales invoice", name: "salesInvoiceId", reference: salesInvoiceReference, type: "number" },
      { label: "Return date", name: "returnDate", required: true, type: "datetime" },
      { label: "Reason", name: "reason", required: true },
      { helperText: "Example: [{\"productId\":1,\"quantity\":2,\"unitPrice\":50}]", label: "Items", name: "items", required: true, type: "json" },
      notesField
    ],
    title: "Returns"
  },
  salesTargets: {
    columns: [
      { label: "Sales rep", path: "salesRep.name" },
      { label: "Product", path: "product.name" },
      { label: "Year", path: "targetYear" },
      { label: "Month", path: "targetMonth" },
      { label: "Revenue target", path: "revenueTarget" }
    ],
    createEndpoint: "sales-targets",
    deleteEndpoint: (row) => `sales-targets/${row.id}`,
    endpoint: "sales-targets",
    requiredPermissions: ["sales_targets.read"],
    fields: [
      { createOnly: true, label: "Sales rep", name: "salesRepId", reference: salesRepReference, required: true, type: "number" },
      { createOnly: true, label: "Product", name: "productId", reference: productReference, type: "number" },
      { createOnly: true, label: "Year", name: "targetYear", required: true, type: "number" },
      { createOnly: true, label: "Month", name: "targetMonth", required: true, type: "number" },
      { label: "Revenue target", name: "revenueTarget", required: true, type: "number" },
      { label: "Volume target", name: "volumeTarget", required: true, type: "number" },
      notesField,
      { label: "Status", name: "status", options: statusOptions, type: "select" }
    ],
    title: "Sales Targets",
    updateEndpoint: (row) => `sales-targets/${row.id}`
  },
  warehouseTransfers: {
    actions: [
      { bodyFields: [{ label: "Items", name: "items", type: "warehouseTransferSummary" }], endpoint: () => "", label: "View Items", previewOnly: true },
      { bodyFields: [{ label: "Items", name: "items", type: "warehouseTransferSummary" }, notesField], bodyMessage: (row) => `Confirm transfer ${row.transferNumber} from ${(row.fromWarehouse as ResourceRecord | undefined)?.name ?? "the source warehouse"} to ${(row.toWarehouse as ResourceRecord | undefined)?.name ?? "the destination warehouse"}?`, disabled: (row) => row.status !== "REQUESTED", endpoint: (row) => `warehouse-transfers/${row.id}/approve`, label: "Approve", submitLabel: "Confirm" },
      { bodyFields: [notesField], disabled: (row) => row.status !== "REQUESTED", endpoint: (row) => `warehouse-transfers/${row.id}/reject`, label: "Reject" },
      { bodyFields: [{ label: "Items", name: "items", type: "warehouseTransferSummary" }, notesField], bodyMessage: (row) => `Dispatch transfer ${row.transferNumber} from ${(row.fromWarehouse as ResourceRecord | undefined)?.name ?? "the source warehouse"} to ${(row.toWarehouse as ResourceRecord | undefined)?.name ?? "the destination warehouse"}?`, disabled: (row) => row.status !== "APPROVED", endpoint: (row) => `warehouse-transfers/${row.id}/dispatch`, label: "Dispatch", submitLabel: "Confirm Dispatch" },
      { bodyFields: [{ label: "Items", name: "items", type: "warehouseTransferSummary" }, notesField], bodyMessage: (row) => `Receive transfer ${row.transferNumber} at ${(row.toWarehouse as ResourceRecord | undefined)?.name ?? "the receiving warehouse"}?`, disabled: (row) => row.status !== "IN_TRANSIT", endpoint: (row) => `warehouse-transfers/${row.id}/receive`, label: "Receive", submitLabel: "Confirm Receipt" },
      { bodyFields: [notesField], disabled: (row) => !["REQUESTED", "APPROVED"].includes(String(row.status)), endpoint: (row) => `warehouse-transfers/${row.id}/cancel`, label: "Cancel" }
    ],
    columns: [
      { label: "Number", path: "transferNumber" },
      { label: "From", path: "fromWarehouse.name" },
      { label: "To", path: "toWarehouse.name" },
      { label: "Requested", path: "requestedAt" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "warehouse-transfers",
    endpoint: "warehouse-transfers",
    requiredPermissions: ["warehouse_transfers.read"],
    fields: [
      { label: "From warehouse", name: "fromWarehouseId", reference: warehouseReference, required: true, type: "number" },
      { label: "To warehouse", name: "toWarehouseId", reference: warehouseReference, required: true, type: "number" },
      { label: "Items", name: "items", required: true, type: "warehouseTransferItems" },
      notesField
    ],
    title: "Warehouse Transfers"
  },
  customerVisits: {
    actions: [
      { bodyFields: [
        { label: "Outcome", name: "outcome", options: ["ORDER_PLACED", "NO_ORDER", "COLLECTION_RECEIVED", "COMPLAINT_RECORDED", "FOLLOW_UP_REQUIRED", "OTHER"].map(toOption), required: true, type: "select" },
        { label: "Visited at", name: "visitedAt", type: "datetime" },
        { label: "Latitude", name: "latitude", type: "number" },
        { label: "Longitude", name: "longitude", type: "number" },
        { label: "No-order reason", name: "noOrderReason" },
        { label: "Collection amount", name: "collectionAmount", type: "number" },
        { label: "Complaint notes", name: "complaintNotes" },
        notesField
      ], endpoint: (row) => `customer-visits/${row.id}/complete`, label: "Complete" },
      { bodyFields: [notesField], endpoint: (row) => `customer-visits/${row.id}/missed`, label: "Missed" },
      { bodyFields: [notesField], endpoint: (row) => `customer-visits/${row.id}/cancel`, label: "Cancel" }
    ],
    columns: [
      { label: "Customer", path: "customer.displayName" },
      { label: "Sales rep", path: "salesRep.name" },
      { label: "Type", path: "visitType" },
      { label: "Planned", path: "plannedAt" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "customer-visits",
    endpoint: "customer-visits",
    formContextEndpoint: "customer-visits/new-context",
    formContextSalesRepReference: salesRepReference,
    requiredPermissions: ["customer_visits.read"],
    fields: [
      { label: "Customer", name: "customerId", reference: customerReference, required: true, type: "number" },
      { label: "Sales rep", loadOptions: false, name: "salesRepId", reference: salesRepReference, required: true, type: "number" },
      { label: "Visit type", name: "visitType", options: ["SALES", "COLLECTION", "COMPLAINT", "DELIVERY_FOLLOW_UP"].map(toOption), required: true, type: "select" },
      { label: "Planned at", name: "plannedAt", type: "datetime" },
      { label: "Visited date", name: "visitedAt", type: "datetime" },
      notesField
    ],
    title: "Customer Visits"
  },
  attachments: {
    columns: [
      { label: "Owner", path: "ownerType" },
      { label: "Owner ID", path: "ownerId" },
      { label: "File", path: "fileName" },
      { label: "Type", path: "mimeType" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "attachments",
    deleteEndpoint: (row) => `attachments/${row.id}`,
    endpoint: "attachments",
    requiredPermissions: ["attachments.read"],
    fields: [
      { label: "Owner type", name: "ownerType", options: ["CUSTOMER", "ORDER", "DELIVERY", "SALES_INVOICE", "PAYMENT", "CHEQUE", "RETURN", "CUSTOMER_VISIT", "PRODUCT", "WAREHOUSE_TRANSFER"].map(toOption), required: true, type: "select" },
      { label: "Owner ID", name: "ownerId", required: true, type: "number" },
      { label: "File name", name: "fileName", required: true },
      { label: "MIME type", name: "mimeType", required: true },
      { label: "File size", name: "fileSize", required: true, type: "number" },
      { label: "Storage path", name: "storagePath", required: true },
      { label: "Checksum", name: "checksum" }
    ],
    title: "Attachments"
  },
  notifications: {
    actions: [{ endpoint: (row) => `notifications/${row.id}/read`, label: "Read" }],
    columns: [
      { label: "Title", path: "title" },
      { label: "Type", path: "type" },
      { label: "Module", path: "module" },
      { label: "Created", path: "createdAt" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "notifications",
    endpoint: "notifications",
    requiredPermissions: ["notifications.read"],
    fields: [
      { label: "User", name: "userId", reference: userReference, type: "number" },
      { label: "Title", name: "title", required: true },
      { label: "Message", name: "message", required: true },
      { label: "Type", name: "type", options: ["INFO", "SUCCESS", "WARNING", "ERROR"].map(toOption), type: "select" },
      { label: "Module", name: "module" },
      { label: "Entity type", name: "entityType" },
      { label: "Entity ID", name: "entityId" }
    ],
    title: "Notifications"
  },
  auditLogs: {
    columns: [
      { label: "Action", path: "action" },
      { label: "Entity", path: "entityType" },
      { label: "Entity ID", path: "entityId" },
      { label: "Actor", path: "actor.email" },
      { label: "Created", path: "createdAt" }
    ],
    endpoint: "audit-logs",
    requiredPermissions: ["audit.read"],
    title: "Audit Logs"
  },
  discountClasses: {
    columns: [
      { label: "Code", path: "code" },
      { label: "Name", path: "name" },
      { label: "Discount", path: "discountPercentage" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "discounts/classes",
    deleteEndpoint: (row) => `discounts/classes/${row.id}`,
    endpoint: "discounts/classes",
    requiredPermissions: ["discounts.read"],
    fields: [
      { createOnly: true, label: "Code", name: "code", required: true },
      { label: "Name", name: "name", required: true },
      { label: "Discount percentage", name: "discountPercentage", required: true, type: "number" },
      { label: "Status", name: "status", options: statusOptions, type: "select" }
    ],
    title: "Discount Classes",
    updateEndpoint: (row) => `discounts/classes/${row.id}`
  },
  seasonalDiscounts: {
    columns: [
      { label: "Name", path: "name" },
      { label: "Product", path: "product.name" },
      { label: "Type", path: "valueType" },
      { label: "Value", path: "value" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "discounts/seasonal",
    deleteEndpoint: (row) => `discounts/seasonal/${row.id}`,
    endpoint: "discounts/seasonal",
    requiredPermissions: ["discounts.read"],
    fields: [
      { createOnly: true, label: "Product", name: "productId", reference: productReference, required: true, type: "number" },
      { label: "Name", name: "name", required: true },
      { label: "Value type", name: "valueType", options: ["PERCENTAGE", "FIXED_AMOUNT"].map(toOption), required: true, type: "select" },
      { label: "Value", name: "value", required: true, type: "number" },
      { label: "Valid from", name: "validFrom", required: true, type: "datetime" },
      { label: "Valid to", name: "validTo", required: true, type: "datetime" },
      { label: "Status", name: "status", options: statusOptions, type: "select" }
    ],
    title: "Seasonal Discounts",
    updateEndpoint: (row) => `discounts/seasonal/${row.id}`
  },
  freeItemOffers: {
    columns: [
      { label: "Name", path: "name" },
      { label: "Product", path: "product.name" },
      { label: "Buy", path: "buyQuantity" },
      { label: "Free", path: "freeQuantity" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "discounts/free-item-offers",
    deleteEndpoint: (row) => `discounts/free-item-offers/${row.id}`,
    endpoint: "discounts/free-item-offers",
    requiredPermissions: ["discounts.read"],
    fields: [
      { createOnly: true, label: "Product", name: "productId", reference: productReference, required: true, type: "number" },
      { label: "Name", name: "name", required: true },
      { label: "Buy quantity", name: "buyQuantity", required: true, type: "number" },
      { label: "Free quantity", name: "freeQuantity", required: true, type: "number" },
      { label: "Valid from", name: "validFrom", required: true, type: "datetime" },
      { label: "Valid to", name: "validTo", required: true, type: "datetime" },
      { label: "Status", name: "status", options: statusOptions, type: "select" }
    ],
    title: "Free Item Offers",
    updateEndpoint: (row) => `discounts/free-item-offers/${row.id}`
  },
  additionalDiscountRequests: {
    actions: [
      { bodyFields: [reviewNoteField], endpoint: (row) => `discounts/additional-bill/${row.id}/approve`, label: "Approve" },
      { bodyFields: [reviewNoteField], endpoint: (row) => `discounts/additional-bill/${row.id}/reject`, label: "Reject" }
    ],
    columns: [
      { label: "Customer", path: "customer.displayName" },
      { label: "Discount", path: "discountPercentage" },
      { label: "Reason", path: "reason" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "discounts/additional-bill/request",
    endpoint: "discounts/additional-bill/requests",
    requiredPermissions: ["discounts.read"],
    fields: [
      { label: "Customer", name: "customerId", reference: customerReference, required: true, type: "number" },
      { label: "Discount percentage", name: "discountPercentage", required: true, type: "number" },
      { label: "Reason", name: "reason" }
    ],
    title: "Additional Bill Discounts"
  },
  creditOverrides: {
    actions: [
      { bodyFields: [reviewNoteField], endpoint: (row) => `credit-control/override-requests/${row.id}/approve`, label: "Approve" },
      { bodyFields: [reviewNoteField], endpoint: (row) => `credit-control/override-requests/${row.id}/reject`, label: "Reject" }
    ],
    columns: [
      { label: "Customer", path: "customer.displayName" },
      { label: "Order", path: "order.orderNumber" },
      { label: "Amount", path: "requestedAmount" },
      { label: "Limit", path: "creditLimit" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "credit-control/override-requests",
    endpoint: "credit-control/override-requests",
    requiredPermissions: ["credit_control.read"],
    fields: [
      { label: "Customer", name: "customerId", reference: customerReference, required: true, type: "number" },
      { label: "Order", name: "orderId", reference: orderReference, type: "number" },
      { label: "Requested amount", name: "requestedAmount", type: "number" },
      { label: "Reason", name: "reason" }
    ],
    title: "Credit Override Requests"
  },
  commissionRules: {
    columns: [
      { label: "Code", path: "code" },
      { label: "Name", path: "name" },
      { label: "Sales rep", path: "salesRep.name" },
      { label: "Rate", path: "ratePercentage" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "commissions/rules",
    deleteEndpoint: (row) => `commissions/rules/${row.id}`,
    endpoint: "commissions/rules",
    requiredPermissions: ["commissions.read"],
    fields: [
      { createOnly: true, label: "Code", name: "code", required: true },
      { label: "Name", name: "name", required: true },
      { createOnly: true, label: "Sales rep", name: "salesRepId", reference: salesRepReference, type: "number" },
      { createOnly: true, label: "Product", name: "productId", reference: productReference, type: "number" },
      { label: "Rate percentage", name: "ratePercentage", required: true, type: "number" },
      { label: "Amount per unit", name: "amountPerUnit", required: true, type: "number" },
      { label: "Bonus threshold", name: "bonusThreshold", required: true, type: "number" },
      { label: "Bonus amount", name: "bonusAmount", required: true, type: "number" },
      { label: "Effective from", name: "effectiveFrom", required: true, type: "datetime" },
      { label: "Effective to", name: "effectiveTo", type: "datetime" },
      { label: "Status", name: "status", options: statusOptions, type: "select" }
    ],
    title: "Commission Rules",
    updateEndpoint: (row) => `commissions/rules/${row.id}`
  },
  commissionRuns: {
    actions: [
      { endpoint: (row) => `commissions/runs/${row.id}/approve`, label: "Approve" },
      { endpoint: (row) => `commissions/runs/${row.id}/pay`, label: "Pay" }
    ],
    columns: [
      { label: "Sales rep", path: "salesRep.name" },
      { label: "Year", path: "periodYear" },
      { label: "Month", path: "periodMonth" },
      { label: "Total", path: "totalAmount" },
      { label: "Status", path: "status" }
    ],
    createEndpoint: "commissions/runs/calculate",
    endpoint: "commissions/runs",
    requiredPermissions: ["commissions.read"],
    fields: [
      { label: "Sales rep", name: "salesRepId", reference: salesRepReference, required: true, type: "number" },
      { label: "Year", name: "periodYear", required: true, type: "number" },
      { label: "Month", name: "periodMonth", required: true, type: "number" }
    ],
    title: "Commission Runs"
  }
};

export function toOption(value: string) {
  return { label: value.replace(/_/g, " "), value };
}
