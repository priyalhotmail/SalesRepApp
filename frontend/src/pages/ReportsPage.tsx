import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Button,
  Card,
  CardContent,
  MenuItem,
  Stack,
  TextField
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import { DataState } from "../components/DataState";
import { PageHeader } from "../components/PageHeader";
import { ResponsiveDataView } from "../components/ResponsiveDataView";

type ReportKey =
  | "sales-summary"
  | "collection-summary"
  | "inventory-summary"
  | "low-stock"
  | "delivery-performance"
  | "sales-rep-performance";

type ReportRow = Record<string, unknown>;

const reportOptions: { label: string; value: ReportKey }[] = [
  { label: "Sales summary", value: "sales-summary" },
  { label: "Collection summary", value: "collection-summary" },
  { label: "Inventory summary", value: "inventory-summary" },
  { label: "Low stock", value: "low-stock" },
  { label: "Delivery performance", value: "delivery-performance" },
  { label: "Sales rep performance", value: "sales-rep-performance" }
];

export function ReportsPage() {
  const [report, setReport] = useState<ReportKey>("sales-summary");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [officeId, setOfficeId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [salesRepId, setSalesRepId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [targetYear, setTargetYear] = useState(String(new Date().getFullYear()));
  const [targetMonth, setTargetMonth] = useState(String(new Date().getMonth() + 1));
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const filterSupport = useMemo(() => getFilterSupport(report), [report]);

  const columns = useMemo(
    () =>
      rows[0]
        ? Object.keys(rows[0])
            .slice(0, 6)
            .map((key) => ({ label: toLabel(key), path: key }))
        : [],
    [rows]
  );

  const loadReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiRequest<Record<string, unknown>>(`reports/${report}`, {
        query: buildReportQuery(report, {
          customerId,
          fromDate,
          officeId,
          productId,
          routeId,
          salesRepId,
          targetMonth,
          targetYear,
          toDate,
          warehouseId
        })
      });
      setRows(extractRows(response));
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Report failed");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, [report]);

  return (
    <Stack spacing={2.5}>
      <PageHeader
        actions={
          <Button onClick={() => void loadReport()} startIcon={<RefreshIcon />} variant="contained">
            Run
          </Button>
        }
        title="Reports"
      />

      <Card variant="outlined">
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{ alignItems: { md: "center" } }}
          >
            <TextField
              label="Report"
              onChange={(event) => setReport(event.target.value as ReportKey)}
              select
              sx={{ minWidth: 220 }}
              value={report}
            >
              {reportOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            {filterSupport.dateRange && (
              <>
                <TextField
                  InputLabelProps={{ shrink: true }}
                  label="From"
                  onChange={(event) => setFromDate(event.target.value)}
                  type="datetime-local"
                  value={fromDate}
                />
                <TextField
                  InputLabelProps={{ shrink: true }}
                  label="To"
                  onChange={(event) => setToDate(event.target.value)}
                  type="datetime-local"
                  value={toDate}
                />
              </>
            )}
            {filterSupport.office && (
              <TextField
                label="Office ID"
                onChange={(event) => setOfficeId(event.target.value)}
                type="number"
                value={officeId}
              />
            )}
            {filterSupport.customer && (
              <TextField
                label="Customer ID"
                onChange={(event) => setCustomerId(event.target.value)}
                type="number"
                value={customerId}
              />
            )}
            {filterSupport.product && (
              <TextField
                label="Product ID"
                onChange={(event) => setProductId(event.target.value)}
                type="number"
                value={productId}
              />
            )}
            {filterSupport.salesRep && (
              <TextField
                label="Sales rep ID"
                onChange={(event) => setSalesRepId(event.target.value)}
                type="number"
                value={salesRepId}
              />
            )}
            {filterSupport.warehouse && (
              <TextField
                label="Warehouse ID"
                onChange={(event) => setWarehouseId(event.target.value)}
                type="number"
                value={warehouseId}
              />
            )}
            {filterSupport.route && (
              <TextField
                label="Route ID"
                onChange={(event) => setRouteId(event.target.value)}
                type="number"
                value={routeId}
              />
            )}
            {filterSupport.targetPeriod && (
              <>
                <TextField
                  label="Target year"
                  onChange={(event) => setTargetYear(event.target.value)}
                  type="number"
                  value={targetYear}
                />
                <TextField
                  label="Target month"
                  onChange={(event) => setTargetMonth(event.target.value)}
                  type="number"
                  value={targetMonth}
                />
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <DataState empty={!isLoading && !error && rows.length === 0} error={error} loading={isLoading} />
          {!isLoading && !error && rows.length > 0 && (
            <ResponsiveDataView
              columns={columns}
              getRowId={(row) => String(row.id ?? row.date ?? JSON.stringify(row))}
              records={rows}
            />
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

function extractRows(response: Record<string, unknown>): ReportRow[] {
  if (Array.isArray(response.rows)) {
    return response.rows as ReportRow[];
  }
  if (Array.isArray(response.data)) {
    return response.data as ReportRow[];
  }
  if (Array.isArray(response.topProducts)) {
    return response.topProducts as ReportRow[];
  }
  if (Array.isArray(response.bySalesRep)) {
    return response.bySalesRep as ReportRow[];
  }
  if (Array.isArray(response.byMethod)) {
    return response.byMethod as ReportRow[];
  }
  return [flattenObject(response)];
}

function flattenObject(value: Record<string, unknown>) {
  return Object.entries(value).reduce<ReportRow>((result, [key, item]) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      Object.entries(item as Record<string, unknown>).forEach(([childKey, childValue]) => {
        result[`${key}.${childKey}`] = childValue;
      });
    } else {
      result[key] = item;
    }
    return result;
  }, {});
}

function toLabel(value: string) {
  return value
    .replace(/\./g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

type ReportFilterValues = {
  customerId: string;
  fromDate: string;
  officeId: string;
  productId: string;
  routeId: string;
  salesRepId: string;
  targetMonth: string;
  targetYear: string;
  toDate: string;
  warehouseId: string;
};

type ReportQuery = Record<string, number | string | boolean | undefined>;

function buildReportQuery(report: ReportKey, values: ReportFilterValues): ReportQuery {
  const dateRange = {
    fromDate: toIsoDate(values.fromDate),
    toDate: toIsoDate(values.toDate)
  };

  if (report === "sales-summary" || report === "collection-summary") {
    return compactQuery({
      ...dateRange,
      customerId: toNumber(values.customerId),
      officeId: toNumber(values.officeId),
      productId: toNumber(values.productId),
      salesRepId: toNumber(values.salesRepId)
    });
  }

  if (report === "inventory-summary" || report === "low-stock") {
    return compactQuery({
      productId: toNumber(values.productId),
      warehouseId: toNumber(values.warehouseId)
    });
  }

  if (report === "delivery-performance") {
    return compactQuery({
      ...dateRange,
      routeId: toNumber(values.routeId),
      warehouseId: toNumber(values.warehouseId)
    });
  }

  return compactQuery({
    salesRepId: toNumber(values.salesRepId),
    targetMonth: toNumber(values.targetMonth),
    targetYear: toNumber(values.targetYear)
  });
}

function compactQuery(query: ReportQuery): ReportQuery {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== "")
  );
}

function getFilterSupport(report: ReportKey) {
  const dateRange =
    report === "sales-summary" ||
    report === "collection-summary" ||
    report === "delivery-performance";

  return {
    customer: report === "sales-summary" || report === "collection-summary",
    dateRange,
    office: report === "sales-summary" || report === "collection-summary",
    product:
      report === "sales-summary" ||
      report === "collection-summary" ||
      report === "inventory-summary" ||
      report === "low-stock",
    route: report === "delivery-performance",
    salesRep:
      report === "sales-summary" ||
      report === "collection-summary" ||
      report === "sales-rep-performance",
    targetPeriod: report === "sales-rep-performance",
    warehouse:
      report === "inventory-summary" ||
      report === "low-stock" ||
      report === "delivery-performance"
  };
}

function toIsoDate(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function toNumber(value: string) {
  return value ? Number(value) : undefined;
}
