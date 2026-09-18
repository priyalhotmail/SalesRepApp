import { formatMoney as money } from "../utils/money";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Paper,
  Stack,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TextField,
  Typography,
} from "@mui/material";
import { apiRequest, ApiListResponse } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { hasAnyPermission } from "../auth/permissions";
import { useSearchParams } from "react-router-dom";
type Customer = { id: number; code: string; displayName: string };
type CanType = {
  id: number;
  name: string;
  capacityLitres: string;
  returnValue: string;
  active: boolean;
  productIds: number[];
  available: number;
  delivered: number;
  returned: number;
};
type CanReceipt = {
  id: number;
  collectedById: number;
  collectedAt: string;
  customer: Customer;
  status: string;
  items: { name: string; quantity: number; returnValue: number }[];
  totalAmount: string;
  remainingCredit: string;
  applications: { amount: string; salesInvoice: { invoiceNumber: string } }[];
};
type Eligibility = {
  sizes: CanType[];
  creditBalance: number;
  invoices: {
    id: number;
    invoiceNumber: string;
    balanceAmount: string;
    cans: { name: string; quantity: number }[];
  }[];
};
export function CanReturnsPage({ configure = false }: { configure?: boolean }) {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [receiptPage, setReceiptPage] = useState(1);
  const collectorFilter = params.get("collectorId") || undefined;
  const dateFilter = params.get("date") || undefined;
  const [types, setTypes] = useState<CanType[]>([]);
  const [receipts, setReceipts] = useState<CanReceipt[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [info, setInfo] = useState<Eligibility | null>(null);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<CanReceipt | null>(null);
  const [products, setProducts] = useState<{ id: number; name: string }[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<
    { id: number; name: string }[]
  >([]);
  const [editing, setEditing] = useState<number | undefined>();
  const [name, setName] = useState("");
  const [size, setSize] = useState("");
  const [value, setValue] = useState("");
  const [active, setActive] = useState(true);
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      apiRequest<CanType[]>("can-returns/types"),
      apiRequest<CanReceipt[]>("can-returns", {
        query: {
          collectorId: collectorFilter,
          date: dateFilter,
          page: receiptPage,
        },
      }),
    ]);
    setTypes(a);
    setReceipts(b);
  }, [collectorFilter, dateFilter, receiptPage]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      apiRequest<ApiListResponse<Customer>>("customers", {
        query: { search, limit: 50 },
      })
        .then((r) => {
          if (alive) setCustomers(r.data);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [search]);
  useEffect(() => {
    if (!configure) return;
    let alive = true;
    const timer = setTimeout(() => {
      apiRequest<ApiListResponse<{ id: number; name: string }>>("products", {
        query: { search: productSearch, limit: 50 },
      })
        .then((r) => {
          if (alive) setProducts(r.data);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [configure, productSearch]);
  useEffect(() => {
    let alive = true;
    setInfo(null);
    setQuantities({});
    if (customer)
      apiRequest<Eligibility>(`can-returns/customer/${customer.id}`)
        .then((r) => {
          if (alive) setInfo(r);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    return () => {
      alive = false;
    };
  }, [customer]);
  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await action();
      await load();
      if (customer)
        setInfo(
          await apiRequest<Eligibility>(`can-returns/customer/${customer.id}`),
        );
      setSuccess(message);
      setReview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }
  const selected =
    info?.sizes.filter((t) => Number(quantities[t.id]) > 0) ?? [];
  const total =
    selected.reduce(
      (n, t) =>
        n + Math.round(Number(t.returnValue) * 100) * Number(quantities[t.id]),
      0,
    ) / 100;
  return (
    <Stack spacing={3}>
      <Typography variant="h4">
        {configure ? "Returnable can configuration" : "Empty can returns"}
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      {configure ? (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography>
              Configure each returnable size and the products delivered in that
              can. One delivered product unit counts as one can. Select
              individual can products, not bulk litres or cartons.
            </Typography>
            <TextField
              label="Can name (e.g. 5L can)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextField
              label="Capacity in litres"
              type="number"
              value={size}
              disabled={Boolean(editing)}
              onChange={(e) => setSize(e.target.value)}
            />
            <TextField
              label="Return value per can (LKR)"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
            />
            <Autocomplete
              multiple
              disabled={busy}
              options={products}
              value={selectedProducts}
              filterOptions={(o) => o}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              getOptionLabel={(p) => p.name}
              onInputChange={(_, v) => setProductSearch(v)}
              onChange={(_, v) => setSelectedProducts(v)}
              renderInput={(p) => (
                <TextField {...p} label="Products sold in this can" helperText="Add or remove products to update can-return eligibility. Existing return receipts keep their recorded quantities and values." />
              )}
            />
            <FormControlLabel
              control={
                <Checkbox checked={active} onChange={(_, v) => setActive(v)} />
              }
              label="Active"
            />
            <Button
              disabled={
                busy ||
                !name.trim() ||
                Number(size) <= 0 ||
                Number(value) <= 0 ||
                !selectedProducts.length
              }
              variant="contained"
              onClick={() =>
                run(async () => {
                  await apiRequest(
                    `can-returns/types${editing ? `/${editing}` : ""}`,
                    {
                      method: editing ? "PUT" : "POST",
                      body: {
                        name,
                        capacityLitres: Number(size),
                        returnValue: Number(value),
                        productIds: selectedProducts.map((p) => p.id),
                        active,
                      },
                    },
                  );
                  setEditing(undefined);
                  setName("");
                  setSize("");
                  setValue("");
                  setSelectedProducts([]);
                }, "Can configuration saved")
              }
            >
              Save can size
            </Button>
            {types.map((t) => (
              <Paper variant="outlined" sx={{ p: 2 }} key={t.id}>
                <Typography>
                  {t.name}: LKR {money(t.returnValue)} per can -{" "}
                  {t.active ? "Active" : "Inactive"}
                </Typography>
                <Button
                  onClick={() => {
                    setEditing(t.id);
                    setName(t.name);
                    setSize(t.capacityLitres);
                    setValue(t.returnValue);
                    setActive(t.active);
                    setSelectedProducts(
                      t.productIds.map(
                        (id) =>
                          products.find((p) => p.id === id) ?? {
                            id,
                            name: `Product #${id}`,
                          },
                      ),
                    );
                  }}
                >
                  Edit settings
                </Button>
              </Paper>
            ))}
          </Stack>
        </Paper>
      ) : (
        <>
          {hasAnyPermission(user, ["can_returns.create"]) && (
            <Paper sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Autocomplete
                  disabled={busy}
                  options={customers}
                  value={customer}
                  getOptionLabel={(c) => `${c.code} - ${c.displayName}`}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  filterOptions={(o) => o}
                  onInputChange={(_, v) => setSearch(v)}
                  onChange={(_, v) => setCustomer(v)}
                  renderInput={(p) => <TextField {...p} label="Customer" />}
                />
                {customer && !info && (
                  <Typography>Loading eligible cans...</Typography>
                )}
                {info && (
                  <>
                    <Typography>
                      Confirmed credit for future invoices: LKR{" "}
                      {money(info.creditBalance)}
                    </Typography>
                    <Typography variant="h6">
                      Unpaid invoices with returnable cans
                    </Typography>
                    {info.invoices.map((i) => (
                      <Typography key={i.id}>
                        {i.invoiceNumber}:{" "}
                        {i.cans
                          .map((c) => `${c.quantity} x ${c.name}`)
                          .join(", ")}{" "}
                        | Outstanding LKR {money(i.balanceAmount)}
                      </Typography>
                    ))}
                    {!info.invoices.length && (
                      <Alert severity="info">
                        No unpaid invoices with cans. Cans from paid deliveries
                        can still be returned; confirmed value becomes credit.
                      </Alert>
                    )}
                    <Box sx={{ overflowX: "auto" }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Can size</TableCell>
                            <TableCell>Delivered</TableCell>
                            <TableCell>Already recorded</TableCell>
                            <TableCell>Available</TableCell>
                            <TableCell>Value / can</TableCell>
                            <TableCell>Collected quantity</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {info.sizes.map((t) => (
                            <TableRow key={t.id}>
                              <TableCell>{t.name}</TableCell>
                              <TableCell>{t.delivered}</TableCell>
                              <TableCell>{t.returned}</TableCell>
                              <TableCell>{t.available}</TableCell>
                              <TableCell>{money(t.returnValue)}</TableCell>
                              <TableCell>
                                <TextField
                                  type="number"
                                  size="small"
                                  value={quantities[t.id] ?? ""}
                                  onChange={(e) =>
                                    setQuantities((q) => ({
                                      ...q,
                                      [t.id]: e.target.value,
                                    }))
                                  }
                                  slotProps={{
                                    htmlInput: {
                                      min: 0,
                                      max: t.available,
                                      step: 1,
                                      "aria-label": `Returned ${t.name}`,
                                    },
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                    <Typography>
                      Total temporary return value: LKR {money(total)}
                    </Typography>
                    <Alert severity="info">
                      No deduction is made until the branch receives and
                      confirms these cans. Pending records reserve the returned
                      quantities.
                    </Alert>
                    <Button
                      variant="contained"
                      disabled={
                        busy ||
                        !selected.length ||
                        selected.some(
                          (t) =>
                            !Number.isInteger(Number(quantities[t.id])) ||
                            Number(quantities[t.id]) > t.available,
                        )
                      }
                      onClick={() =>
                        run(async () => {
                          await apiRequest("can-returns", {
                            method: "POST",
                            body: {
                              customerId: customer!.id,
                              items: selected.map((t) => ({
                                canTypeId: t.id,
                                quantity: Number(quantities[t.id]),
                              })),
                            },
                          });
                          setQuantities({});
                        }, "Temporary empty-can return saved")
                      }
                    >
                      Record temporary return
                    </Button>
                  </>
                )}
              </Stack>
            </Paper>
          )}
          <Typography variant="h6">Returns</Typography>
          <Stack direction="row" spacing={2}>
            <Button
              disabled={receiptPage <= 1}
              onClick={() => setReceiptPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Typography>Page {receiptPage}</Typography>
            <Button
              disabled={receipts.length < 100}
              onClick={() => setReceiptPage((p) => p + 1)}
            >
              Next
            </Button>
          </Stack>
          {receipts
            .filter(
              (r) =>
                (!params.get("collectorId") ||
                  r.collectedById === Number(params.get("collectorId"))) &&
                (!params.get("date") ||
                  r.collectedAt.slice(0, 10) === params.get("date")),
            )
            .map((r) => (
              <Paper sx={{ p: 2 }} key={r.id}>
                <Stack spacing={1}>
                  <Typography fontWeight={600}>
                    #{r.id} {r.customer.displayName} - {r.status}
                  </Typography>
                  <Typography>
                    {r.items
                      .map(
                        (i) =>
                          `${i.quantity} x ${i.name} @ ${money(i.returnValue)}`,
                      )
                      .join(", ")}
                  </Typography>
                  <Typography>
                    LKR {money(r.totalAmount)} | Remaining credit:{" "}
                    {money(r.remainingCredit)}
                  </Typography>
                  {r.applications.map((a, i) => (
                    <Typography key={i}>
                      Deducted {money(a.amount)} from{" "}
                      {a.salesInvoice.invoiceNumber}
                    </Typography>
                  ))}
                  {r.status === "TEMPORARY" &&
                    hasAnyPermission(user, ["can_returns.confirm"]) && (
                      <Button onClick={() => setReview(r)}>
                        Review branch receipt
                      </Button>
                    )}
                </Stack>
              </Paper>
            ))}
          <Dialog
            open={Boolean(review)}
            onClose={() => {
              if (!busy) setReview(null);
            }}
            fullWidth
          >
            <DialogTitle>Confirm physical receipt of empty cans</DialogTitle>
            <DialogContent>
              <Stack spacing={2}>
                <Typography>{review?.customer.displayName}</Typography>
                {review?.items.map((i) => (
                  <Typography key={i.name}>
                    {i.quantity} x {i.name} = LKR{" "}
                    {money(i.quantity * i.returnValue)}
                  </Typography>
                ))}
                <Alert severity="info">
                  LKR {money(review?.totalAmount ?? 0)} will be applied to the
                  oldest unpaid invoices. Any remainder is kept for the next
                  invoice.
                </Alert>
                {error && <Alert severity="error">{error}</Alert>}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button disabled={busy} onClick={() => setReview(null)}>
                Close
              </Button>
              <Button
                color="error"
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      apiRequest(`can-returns/${review!.id}/reject`, {
                        method: "POST",
                        body: {},
                      }),
                    "Return rejected",
                  )
                }
              >
                Reject
              </Button>
              <Button
                variant="contained"
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      apiRequest(`can-returns/${review!.id}/confirm`, {
                        method: "POST",
                        body: {},
                      }),
                    "Cans received and credit applied",
                  )
                }
              >
                Confirm received
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Stack>
  );
}
