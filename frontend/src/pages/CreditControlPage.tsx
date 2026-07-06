import SearchIcon from "@mui/icons-material/Search";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useState } from "react";
import { apiRequest } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { ResourcePage } from "../components/ResourcePage";
import { resourceConfigs, ResourceRecord } from "../modules/resourceConfigs";
import { formatDisplayValue } from "../utils/object";

export function CreditControlPage() {
  const [customerId, setCustomerId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [orderAmount, setOrderAmount] = useState("");
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [checkResult, setCheckResult] = useState<Record<string, unknown> | null>(null);
  const [agingRows, setAgingRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = async () => {
    if (!customerId) {
      setError("Customer ID is required.");
      return;
    }
    setError(null);
    setSummary(
      await apiRequest<Record<string, unknown>>(
        `credit-control/customers/${customerId}/summary`
      )
    );
    const aging = await apiRequest<{ rows: Record<string, unknown>[] }>(
      "credit-control/aging",
      { query: { customerId: Number(customerId) } }
    );
    setAgingRows(aging.rows ?? []);
  };

  const checkCredit = async () => {
    setError(null);
    setCheckResult(
      await apiRequest<Record<string, unknown>>("credit-control/check-order", {
        body: orderId
          ? { orderId: Number(orderId) }
          : { customerId: Number(customerId), orderAmount: Number(orderAmount) },
        method: "POST"
      })
    );
  };

  return (
    <Stack spacing={2.5}>
      <PageHeader title="Credit Control" />
      {error && <Alert severity="error">{error}</Alert>}

      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Customer ID"
              onChange={(event) => setCustomerId(event.target.value)}
              type="number"
              value={customerId}
            />
            <TextField
              label="Order ID"
              onChange={(event) => setOrderId(event.target.value)}
              type="number"
              value={orderId}
            />
            <TextField
              label="Order amount"
              onChange={(event) => setOrderAmount(event.target.value)}
              type="number"
              value={orderAmount}
            />
            <Button onClick={() => void loadSummary()} startIcon={<SearchIcon />} variant="contained">
              Summary
            </Button>
            <Button onClick={() => void checkCredit()} variant="outlined">
              Check
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
        <InfoPanel data={summary} title="Customer Summary" />
        <InfoPanel data={checkResult} title="Credit Check" />
      </Stack>

      <Card variant="outlined">
        <CardContent>
          <Typography fontWeight={700} sx={{ mb: 1 }}>
            Aging
          </Typography>
          <Stack spacing={1}>
            {agingRows.length === 0 ? (
              <Typography color="text.secondary">No aging rows.</Typography>
            ) : (
              agingRows.slice(0, 6).map((row) => (
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  key={String(row.invoiceId)}
                >
                  <Typography>{formatDisplayValue(row.invoiceNumber)}</Typography>
                  <Typography>{formatDisplayValue(row.balanceAmount)}</Typography>
                </Stack>
              ))
            )}
          </Stack>
        </CardContent>
      </Card>

      <ResourcePage<ResourceRecord> config={resourceConfigs.creditOverrides!} />
    </Stack>
  );
}

function InfoPanel({
  data,
  title
}: {
  data: Record<string, unknown> | null;
  title: string;
}) {
  return (
    <Card sx={{ flex: 1 }} variant="outlined">
      <CardContent>
        <Typography fontWeight={700} sx={{ mb: 1 }}>
          {title}
        </Typography>
        {data ? (
          <Stack spacing={1}>
            {Object.entries(data).map(([key, value]) => (
              <Stack direction="row" justifyContent="space-between" key={key} spacing={2}>
                <Typography color="text.secondary" variant="body2">
                  {key}
                </Typography>
                <Typography sx={{ overflowWrap: "anywhere", textAlign: "right" }} variant="body2">
                  {formatDisplayValue(value)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary">No data loaded.</Typography>
        )}
      </CardContent>
    </Card>
  );
}
