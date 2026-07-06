import { Card, CardContent, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { DataState } from "../components/DataState";
import { PageHeader } from "../components/PageHeader";
import { formatDisplayValue } from "../utils/object";

type DashboardSummary = {
  kpis?: Record<string, number>;
  pendingActions?: Record<string, number>;
  totals?: Record<string, number>;
};

const metricKeys = [
  ["salesAmount", "Sales"],
  ["collectedAmount", "Collections"],
  ["outstandingAmount", "Outstanding"],
  ["orderCount", "Orders"],
  ["deliveryCount", "Deliveries"],
  ["lowStockCount", "Low stock"],
  ["pendingActionCount", "Pending"],
  ["unreadNotificationCount", "Unread"]
] as const;

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trend, setTrend] = useState<Record<string, unknown>[]>([]);
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [summaryResponse, trendResponse, pendingResponse] = await Promise.all([
          apiRequest<DashboardSummary>("dashboard/summary"),
          apiRequest<{ data: Record<string, unknown>[] }>("dashboard/sales-trend", {
            query: { days: 14 }
          }),
          apiRequest<Record<string, unknown>>("dashboard/pending-actions")
        ]);
        setSummary(summaryResponse);
        setTrend(trendResponse.data ?? []);
        setPending(pendingResponse);
      } catch (currentError) {
        setError(currentError instanceof Error ? currentError.message : "Dashboard failed");
      } finally {
        setIsLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  return (
    <Stack spacing={3}>
      <PageHeader title="Operations Dashboard" />
      <DataState error={error} loading={isLoading} />

      {!isLoading && !error && (
        <>
          <Grid container spacing={2}>
            {metricKeys.map(([key, label]) => (
              <Grid key={key} size={{ xs: 12, sm: 6, lg: 3 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography color="text.secondary" variant="body2">
                      {label}
                    </Typography>
                    <Typography fontWeight={700} variant="h5">
                      {formatDisplayValue(summary?.kpis?.[key] ?? 0)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography fontWeight={700} sx={{ mb: 2 }}>
                    Sales Trend
                  </Typography>
                  <Stack spacing={1}>
                    {trend.map((row) => (
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        key={String(row.date)}
                      >
                        <Typography color="text.secondary">{String(row.date)}</Typography>
                        <Typography fontWeight={600}>
                          {formatDisplayValue(row.salesAmount)}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, lg: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography fontWeight={700} sx={{ mb: 2 }}>
                    Pending Actions
                  </Typography>
                  <Stack spacing={1}>
                    {Object.entries((pending?.counts as Record<string, number>) ?? {}).map(
                      ([key, value]) => (
                        <Stack direction="row" justifyContent="space-between" key={key}>
                          <Typography color="text.secondary">{key}</Typography>
                          <Typography fontWeight={600}>{value}</Typography>
                        </Stack>
                      )
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Stack>
  );
}
