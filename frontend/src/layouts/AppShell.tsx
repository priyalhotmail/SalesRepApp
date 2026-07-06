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

const drawerWidth = 264;

const navigationItems = [
  { icon: <DashboardIcon />, label: "Dashboard", path: "/" },
  { icon: <PeopleIcon />, label: "Users", path: "/module/users" },
  { icon: <StorefrontIcon />, label: "Sales Reps", path: "/module/salesReps" },
  { icon: <StorefrontIcon />, label: "Offices", path: "/module/offices" },
  { icon: <StorefrontIcon />, label: "Factories", path: "/module/factories" },
  { icon: <InventoryIcon />, label: "Warehouses", path: "/module/warehouses" },
  { icon: <PeopleIcon />, label: "Customers", path: "/module/customers" },
  { icon: <PeopleIcon />, label: "Customer Approvals", path: "/module/customerApprovals" },
  { icon: <InventoryIcon />, label: "Product Groups", path: "/module/productGroups" },
  { icon: <InventoryIcon />, label: "Products", path: "/module/products" },
  { icon: <ReceiptIcon />, label: "Price Lists", path: "/module/priceLists" },
  { icon: <ReceiptIcon />, label: "Discounts", path: "/discounts" },
  { icon: <InventoryIcon />, label: "Inventory Stock", path: "/module/inventoryStock" },
  { icon: <LocalShippingIcon />, label: "Routes", path: "/module/routes" },
  { icon: <ReceiptIcon />, label: "Orders", path: "/module/orders" },
  { icon: <LocalShippingIcon />, label: "Delivery", path: "/module/deliveries" },
  { icon: <ReceiptIcon />, label: "Sales Invoices", path: "/module/salesInvoices" },
  { icon: <ReceiptIcon />, label: "Payments", path: "/module/payments" },
  { icon: <ReceiptIcon />, label: "Cheques", path: "/module/cheques" },
  { icon: <ReceiptIcon />, label: "Returns", path: "/module/returns" },
  { icon: <AssessmentIcon />, label: "Credit Control", path: "/credit-control" },
  { icon: <AssessmentIcon />, label: "Sales Targets", path: "/module/salesTargets" },
  { icon: <AssessmentIcon />, label: "Commissions", path: "/commissions" },
  { icon: <LocalShippingIcon />, label: "Warehouse Transfers", path: "/module/warehouseTransfers" },
  { icon: <PeopleIcon />, label: "Customer Visits", path: "/module/customerVisits" },
  { icon: <ReceiptIcon />, label: "Attachments", path: "/module/attachments" },
  { icon: <ReceiptIcon />, label: "Notifications", path: "/module/notifications" },
  { icon: <AssessmentIcon />, label: "Reports", path: "/reports" },
  { icon: <AssessmentIcon />, label: "Audit Logs", path: "/module/auditLogs" },
  { icon: <SettingsIcon />, label: "System Settings", path: "/system-settings" }
];

export function AppShell() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const activeItem =
    navigationItems.find((item) => item.path === location.pathname) ?? {
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
        {navigationItems.map((item) => (
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
