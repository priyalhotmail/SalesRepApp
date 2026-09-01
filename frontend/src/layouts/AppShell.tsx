import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import StorefrontIcon from "@mui/icons-material/Storefront";
import InventoryIcon from "@mui/icons-material/Inventory";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import ReceiptIcon from "@mui/icons-material/Receipt";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme
} from "@mui/material";
import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { hasAnyPermission } from "../auth/permissions";

const drawerWidth = 264;

const navigationItems = [
  { icon: <DashboardIcon />, label: "Dashboard", path: "/", permissions: ["dashboard.read"] },
  { icon: <PeopleIcon />, label: "Users", path: "/module/users", permissions: ["users.read"] },
  { icon: <PeopleIcon />, label: "Employees", path: "/module/employees", permissions: ["employees.read"] },
  { icon: <StorefrontIcon />, label: "Sales Reps", path: "/module/salesReps", permissions: ["sales_reps.read"] },
  { icon: <StorefrontIcon />, label: "Offices", path: "/module/offices", permissions: ["company_structure.read"] },
  { icon: <StorefrontIcon />, label: "Factories", path: "/module/factories", permissions: ["company_structure.read"] },
  { icon: <InventoryIcon />, label: "Warehouses", path: "/module/warehouses", permissions: ["company_structure.read"] },
  { icon: <PeopleIcon />, label: "Customers", path: "/module/customers", permissions: ["customers.read"] },
  { icon: <PeopleIcon />, label: "Customer Approvals", path: "/module/customerApprovals", permissions: ["customers.approve_change"] },
  { icon: <InventoryIcon />, label: "Product Groups", path: "/module/productGroups", permissions: ["product_catalogue.read"] },
  { icon: <InventoryIcon />, label: "Products", path: "/module/products", permissions: ["product_catalogue.read"] },
  { icon: <ReceiptIcon />, label: "Price Lists", path: "/module/priceLists", permissions: ["price_lists.read"] },
  { icon: <ReceiptIcon />, label: "Discounts", path: "/discounts", permissions: ["discounts.read"] },
  { icon: <InventoryIcon />, label: "Inventory Stock", path: "/module/inventoryStock", permissions: ["inventory.read"] },
  { icon: <LocalShippingIcon />, label: "Routes", path: "/module/routes", permissions: ["routes.read"] },
  { icon: <ReceiptIcon />, label: "Orders", path: "/module/orders", permissions: ["orders.read"] },
  { icon: <LocalShippingIcon />, label: "Delivery", path: "/module/deliveries", permissions: ["delivery.read"] },
  { icon: <LocalShippingIcon />, label: "Delivery Plans", path: "/module/deliveryPlans", permissions: ["delivery.read"] },
  { icon: <ReceiptIcon />, label: "Sales Invoices", path: "/module/salesInvoices", permissions: ["sales_invoices.read"] },
  { icon: <ReceiptIcon />, label: "Payments", path: "/module/payments", permissions: ["payments.read"] },
  { icon: <ReceiptIcon />, label: "Cheques", path: "/module/cheques", permissions: ["cheques.read"] },
  { icon: <ReceiptIcon />, label: "Returns", path: "/module/returns", permissions: ["returns.read"] },
  { icon: <AssessmentIcon />, label: "Credit Control", path: "/credit-control", permissions: ["credit_control.read"] },
  { icon: <AssessmentIcon />, label: "Sales Targets", path: "/module/salesTargets", permissions: ["sales_targets.read"] },
  { icon: <AssessmentIcon />, label: "Commissions", path: "/commissions", permissions: ["commissions.read"] },
  { icon: <LocalShippingIcon />, label: "Warehouse Transfers", path: "/module/warehouseTransfers", permissions: ["warehouse_transfers.read"] },
  { icon: <PeopleIcon />, label: "Customer Visits", path: "/module/customerVisits", permissions: ["customer_visits.read"] },
  { icon: <ReceiptIcon />, label: "Attachments", path: "/module/attachments", permissions: ["attachments.read"] },
  { icon: <ReceiptIcon />, label: "Notifications", path: "/module/notifications", permissions: ["notifications.read"] },
  { icon: <AssessmentIcon />, label: "Reports", path: "/reports", permissions: ["reports.loading", "reports.sales", "reports.collections", "reports.inventory", "reports.delivery", "reports.performance"] },
  { icon: <AssessmentIcon />, label: "Audit Logs", path: "/module/auditLogs", permissions: ["audit.read"] },
  { icon: <SettingsIcon />, label: "System Settings", path: "/system-settings", permissions: ["system_config.read"] }
];

export function AppShell() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const visibleNavigationItems = navigationItems.filter((item) =>
    hasAnyPermission(user, item.permissions)
  );
  const activeItem =
    visibleNavigationItems.find((item) => item.path === location.pathname) ?? {
      label: "Dashboard"
    };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const drawer = (
    <Stack sx={{ height: "100%", px: 1.5, py: 2 }}>
      <Typography color="primary" fontWeight={700} sx={{ mb: 2 }}>
        Sales System
      </Typography>
      <List disablePadding sx={{ flex: 1, overflowY: "auto" }}>
        {visibleNavigationItems.map((item) => (
          <ListItemButton
            component={NavLink}
            key={item.path}
            onClick={() => setMobileOpen(false)}
            sx={{
              borderRadius: 1,
              mb: 0.5,
              "&.active": {
                bgcolor: "primary.main",
                color: "primary.contrastText",
                "& .MuiListItemIcon-root": { color: "primary.contrastText" }
              }
            }}
            to={item.path}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14 }} />
          </ListItemButton>
        ))}
      </List>
      <Divider sx={{ my: 1.5 }} />
      <Stack spacing={1}>
        <Typography color="text.secondary" noWrap variant="body2">
          {user?.displayName ?? user?.email}
        </Typography>
        <ListItemButton onClick={handleLogout} sx={{ borderRadius: 1 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary="Sign out" />
        </ListItemButton>
      </Stack>
    </Stack>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        color="inherit"
        elevation={0}
        position="fixed"
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          ml: { md: `${drawerWidth}px` },
          width: { md: `calc(100% - ${drawerWidth}px)` }
        }}
      >
        <Toolbar>
          {!isDesktop && (
            <IconButton
              aria-label="Open navigation"
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography component="h1" fontWeight={700} variant="h6">
            {activeItem.label}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          ModalProps={{ keepMounted: true }}
          onClose={() => setMobileOpen(false)}
          open={mobileOpen}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth }
          }}
          variant="temporary"
        >
          {drawer}
        </Drawer>
        <Drawer
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth }
          }}
          variant="permanent"
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          pt: { xs: 10, md: 11 },
          width: { md: `calc(100% - ${drawerWidth}px)` }
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
