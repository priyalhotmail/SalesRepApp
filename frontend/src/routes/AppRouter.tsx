import { Box, CircularProgress } from "@mui/material";
import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import { AppShell } from "../layouts/AppShell";

const CreditControlPage = lazy(() =>
  import("../pages/CreditControlPage").then((module) => ({ default: module.CreditControlPage }))
);
const DashboardPage = lazy(() =>
  import("../pages/DashboardPage").then((module) => ({ default: module.DashboardPage }))
);
const LoginPage = lazy(() =>
  import("../pages/LoginPage").then((module) => ({ default: module.LoginPage }))
);
const ReportsPage = lazy(() =>
  import("../pages/ReportsPage").then((module) => ({ default: module.ReportsPage }))
);
const ResourceModulePage = lazy(() =>
  import("../pages/ResourceModulePage").then((module) => ({ default: module.ResourceModulePage }))
);
const SystemSettingsPage = lazy(() =>
  import("../pages/SystemSettingsPage").then((module) => ({ default: module.SystemSettingsPage }))
);
const TabbedResourcesPage = lazy(() =>
  import("../pages/TabbedResourcesPage").then((module) => ({ default: module.TabbedResourcesPage }))
);

export function AppRouter() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={withPageFallback(<LoginPage />)} />
        <Route element={<ProtectedShell />}>
          <Route index element={withPageFallback(<DashboardPage />)} />
          <Route path="/module/:moduleKey" element={withPageFallback(<ResourceModulePage />)} />
          <Route
            path="/discounts"
            element={withPageFallback(
              <TabbedResourcesPage
                tabs={[
                  { configKey: "discountClasses", label: "Classes" },
                  { configKey: "seasonalDiscounts", label: "Seasonal" },
                  { configKey: "freeItemOffers", label: "Free Items" },
                  { configKey: "additionalDiscountRequests", label: "Additional Bill" }
                ]}
                title="Discounts"
              />
            )}
          />
          <Route
            path="/commissions"
            element={withPageFallback(
              <TabbedResourcesPage
                tabs={[
                  { configKey: "commissionRules", label: "Rules" },
                  { configKey: "commissionRuns", label: "Runs" }
                ]}
                title="Commissions"
              />
            )}
          />
          <Route path="/credit-control" element={withPageFallback(<CreditControlPage />)} />
          <Route path="/reports" element={withPageFallback(<ReportsPage />)} />
          <Route path="/system-settings" element={withPageFallback(<SystemSettingsPage />)} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

function ProtectedShell() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/login" />;
  }

  return <AppShell />;
}

function withPageFallback(children: ReactNode) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

function PageFallback() {
  return (
    <Box sx={{ alignItems: "center", display: "flex", minHeight: "60vh", justifyContent: "center" }}>
      <CircularProgress size={28} />
    </Box>
  );
}
