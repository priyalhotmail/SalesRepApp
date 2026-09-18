import { formatMoney as money } from "../utils/money";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { hasAnyPermission } from "../auth/permissions";
type Driver = {
  id: number;
  userId: number;
  warehouseId: number;
  user: { displayName: string };
};
type Row = {
  pendingPlan?: boolean;
  id: number;
  customer: { displayName: string };
  status: string;
  amount?: string;
  totalAmount?: string;
  paymentNumber?: string;
  returnNumber?: string;
  deliveryNumber?: string;
  returnedItemsReceivedAt?: string;
  items?: {
    quantity?: number;
    name?: string;
    notDeliveredQuantity?: number;
    product?: { name: string };
  }[];
};
type Summary = {
  driver: Driver;
  totals: Record<string, number>;
  cash: Row[];
  cheques: Row[];
  returns: Row[];
  cans: Row[];
  deliveries: Row[];
  undelivered: Row[];
};
export function DriverDayPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const requestSequence = useRef(0);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const driverId = params.get("driverId") ?? "";
  const date = params.get("date") ?? new Date().toISOString().slice(0, 10);
  const section = [
    "cash",
    "cheques",
    "returns",
    "cans",
    "deliveries",
    "undelivered",
  ].includes(params.get("section") ?? "")
    ? params.get("section")
    : null;
  useEffect(() => {
    apiRequest<Driver[]>("driver-day/drivers")
      .then(setDrivers)
      .catch((e) => setError(e.message));
  }, []);
  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    if (!driverId) return;
    try {
      const r = await apiRequest<Summary>("driver-day", {
        query: { driverId: Number(driverId), date },
      });
      if (sequence !== requestSequence.current) return;
      setData(r);
      setError("");
    } catch (e) {
      if (sequence === requestSequence.current)
        setError(e instanceof Error ? e.message : "Unable to load summary");
    }
  }, [driverId, date]);
  useEffect(() => {
    setData(null);
    void load();
    const refresh = () => {
      if (!document.hidden) void load();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 20000);
    return () => {
      requestSequence.current += 1;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  async function receive(id: number) {
    setBusy(true);
    try {
      await apiRequest(`driver-day/deliveries/${id}/receive`, {
        method: "POST",
        body: {},
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Receipt failed");
    } finally {
      setBusy(false);
    }
  }
  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next);
  }
  const t = data?.totals ?? {};
  const cards = [
    {
      key: "cash",
      title: "Cash collected",
      value: `LKR ${money(t.cash)}`,
      status: `Confirmed LKR ${money(t.cashConfirmed)}`,
    },
    {
      key: "cheques",
      title: "Cheques collected",
      value: `${t.chequeCount ?? 0} cheques / LKR ${money(t.chequeAmount)}`,
      status: `${t.chequeReceived ?? 0} received, ${t.chequeCleared ?? 0} bank-cleared`,
    },
    {
      key: "returns",
      title: "Product returns",
      value: `LKR ${money(t.returnAmount)}`,
      status: `${t.returnsReceived ?? 0} returns received`,
    },
    {
      key: "cans",
      title: "Empty cans",
      value: `${t.cans ?? 0} cans`,
      status: `${t.cansConfirmed ?? 0} confirmed`,
    },
    {
      key: "deliveries",
      title: "Orders",
      value: `${t.deliveredOrders ?? 0} delivered / ${t.notDeliveredOrders ?? 0} not delivered`,
      status: `${t.partiallyDeliveredOrders ?? 0} partially delivered`,
    },
    {
      key: "undelivered",
      title: "Undelivered goods",
      value: `${t.undeliveredQuantity ?? 0} units`,
      status: `${t.undeliveredReceived ?? 0} delivery receipts confirmed`,
    },
  ];
  const rows = data && section ? (data[section as keyof Summary] as Row[]) : [];
  return (
    <Stack spacing={3}>
      <Typography variant="h4">Driver day summary</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          select
          fullWidth
          label="Driver"
          value={driverId}
          onChange={(e) => change("driverId", e.target.value)}
        >
          {drivers.map((d) => (
            <MenuItem key={d.id} value={String(d.id)}>
              {d.user.displayName}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type="date"
          label="Business date (UTC)"
          value={date}
          onChange={(e) => change("date", e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button onClick={load}>Refresh</Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {!driverId && (
        <Alert severity="info">
          Choose a driver to review collections and delivery outcomes.
        </Alert>
      )}
      {data && (
        <>
          <Stack direction="row" useFlexGap flexWrap="wrap" spacing={2}>
            {cards.map((c) => (
              <Paper key={c.key} sx={{ p: 3, flex: "1 1 270px" }}>
                <Stack spacing={1}>
                  <Typography variant="h6">{c.title}</Typography>
                  <Typography>{c.value}</Typography>
                  <Chip label={c.status} />
                  <Button onClick={() => change("section", c.key)}>
                    Review {c.title.toLowerCase()}
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Stack>
          {section && (
            <Paper sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Typography variant="h6">
                  {cards.find((c) => c.key === section)?.title}
                </Typography>
                {(section === "cash" || section === "cheques") && (
                  <Button
                    component={Link}
                    to={`/module/payments?collectorId=${data.driver.userId}&date=${date}&method=${section === "cash" ? "CASH" : "CHEQUE"}`}
                  >
                    Verify {section} collections
                  </Button>
                )}
                {section === "cans" && (
                  <Button
                    component={Link}
                    to={`/empty-cans?collectorId=${data.driver.userId}&date=${date}`}
                  >
                    Verify empty-can returns
                  </Button>
                )}
                {Array.isArray(rows) &&
                  rows.map((r) => (
                    <Paper variant="outlined" sx={{ p: 2 }} key={r.id}>
                      <Stack spacing={1}>
                        <Typography>
                          {r.paymentNumber ??
                            r.returnNumber ??
                            r.deliveryNumber ??
                            `#${r.id}`}{" "}
                          - {r.customer.displayName}
                        </Typography>
                        <Typography>
                          {r.status}
                          {r.amount || r.totalAmount
                            ? ` | LKR ${money(r.amount ?? r.totalAmount)}`
                            : ""}
                        </Typography>
                        {r.items?.map((i, n) => (
                          <Typography key={n}>
                            {i.product?.name ?? i.name}:{" "}
                            {i.notDeliveredQuantity ?? i.quantity}
                          </Typography>
                        ))}
                        {section === "returns" && (
                          <Button
                            component={Link}
                            to={`/module/returns?search=${encodeURIComponent(r.returnNumber ?? "")}`}
                          >
                            Review / receive return
                          </Button>
                        )}
                        {section === "deliveries" && (
                          <Button
                            component={Link}
                            to={`/module/${r.pendingPlan ? "deliveryPlans" : "deliveries"}?search=${encodeURIComponent(r.deliveryNumber ?? "")}`}
                          >
                            Review delivery outcome
                          </Button>
                        )}
                        {section === "cheques" && (
                          <Button
                            component={Link}
                            to={`/module/cheques?search=${encodeURIComponent(r.paymentNumber ?? "")}`}
                          >
                            Bank reconciliation
                          </Button>
                        )}
                        {section === "undelivered" &&
                          (r.returnedItemsReceivedAt ? (
                            <Chip label="Received at branch" />
                          ) : (
                            hasAnyPermission(user, ["driver_day.confirm"]) && (
                              <Button
                                disabled={busy}
                                onClick={() => receive(r.id)}
                              >
                                Confirm undelivered goods received
                              </Button>
                            )
                          ))}
                      </Stack>
                    </Paper>
                  ))}
                {Array.isArray(rows) && !rows.length && (
                  <Typography>No records for this driver and date.</Typography>
                )}
              </Stack>
            </Paper>
          )}
          <Typography variant="body2">
            Refreshes every 20 seconds and when you return to this screen. Cash
            and cheque receipts are attributed to the user who recorded
            collection. Product returns use their recorded collector; delivery
            outcomes use the assigned plan driver.
          </Typography>
        </>
      )}
    </Stack>
  );
}
