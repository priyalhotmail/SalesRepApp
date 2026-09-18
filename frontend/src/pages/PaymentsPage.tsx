import { formatMoney as money } from "../utils/money";
import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Box,
} from "@mui/material";
import { apiRequest, ApiListResponse } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { hasAnyPermission } from "../auth/permissions";

type Customer = { id: number; code: string; displayName: string };
type Invoice = {
  id: number;
  invoiceNumber: string;
  dueDate: string;
  balanceAmount: string;
  canCreditTotal?: string;
};
type Outstanding = {
  invoices: Invoice[];
  totalOutstanding: number;
  overdueAmount: number;
};
type Allocation = {
  invoiceId: number;
  amount: number;
  invoiceNumber?: string;
  dueDate?: string;
  balanceAtCollection?: number;
};
type Payment = {
  allocations?: Allocation[];
  salesInvoice?: Invoice;
  id: number;
  paymentNumber: string;
  customer: Customer;
  amount: string;
  method: string;
  status: string;
  cheque?: { chequeNumber?: string; chequeDate?: string };
};
const statusLabel = (status: string) =>
  ({
    TEMPORARY: "Temporary",
    AWAITING_CLEARANCE: "Awaiting bank reconciliation",
    POSTED: "Confirmed",
    CANCELLED: "Cancelled",
  })[status] ?? status;

export function PaymentsPage() {
  const [routeParams] = useSearchParams();
  const collectorId = routeParams.get("collectorId") || undefined;
  const collectionDate = routeParams.get("date") || undefined;
  const collectionMethod = routeParams.get("method") || undefined;
  const { user } = useAuth();
  const canCreate = hasAnyPermission(user, ["payments.create"]);
  const canConfirm = hasAnyPermission(user, ["payments.confirm"]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [outstanding, setOutstanding] = useState<Outstanding | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filter, setFilter] = useState("");
  const [revision, setRevision] = useState(0);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [reviewCollection, setReviewCollection] = useState(false);
  const [number, setNumber] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState<Payment | null>(null);
  const [confirmNumber, setConfirmNumber] = useState("");
  const [confirmDate, setConfirmDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      apiRequest<ApiListResponse<Customer>>("customers", {
        query: { search, limit: 50 },
      })
        .then((r) => {
          if (active) setCustomers(r.data);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);
  useEffect(() => {
    let active = true;
    setOutstanding(null);
    if (customer)
      apiRequest<Outstanding>(`payments/customer/${customer.id}/outstanding`)
        .then((r) => {
          if (active) setOutstanding(r);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [customer, revision]);
  useEffect(() => {
    let active = true;
    apiRequest<ApiListResponse<Payment>>("payments", {
      query: { page, limit: 20, status: filter || undefined, collectorId, date: collectionDate, method: collectionMethod },
    })
      .then((r) => {
        if (active) {
          setPayments(r.data);
          setPages(r.meta?.totalPages ?? 1);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [page, filter, revision, collectorId, collectionDate, collectionMethod]);
  const selectedAllocations: Allocation[] = Object.entries(selected).map(
    ([id, value]) => {
      const invoice = outstanding?.invoices.find((i) => i.id === Number(id));
      return {
        invoiceId: Number(id),
        amount: Number(value),
        invoiceNumber: invoice?.invoiceNumber,
        dueDate: invoice?.dueDate,
        balanceAtCollection: Number(invoice?.balanceAmount ?? 0),
      };
    },
  );
  const allocatedCents = selectedAllocations.reduce(
    (sum, a) => sum + Math.round(a.amount * 100),
    0,
  );
  const allocationError = !selectedAllocations.length
    ? "Select at least one invoice."
    : selectedAllocations.some(
          (a) =>
            !Number.isFinite(a.amount) ||
            a.amount <= 0 ||
            !/^\d+(\.\d{1,2})?$/.test(selected[a.invoiceId] ?? "") ||
            a.amount > (a.balanceAtCollection ?? 0),
        )
      ? "Enter a positive amount within each selected invoice balance (up to two decimal places)."
      : !/^\d+(\.\d{1,2})?$/.test(amount) ||
          Math.round(Number(amount) * 100) !== allocatedCents
        ? "Selected invoice amounts must equal the payment amount."
        : "";
  function updateSelection(next: Record<number, string>) {
    setSelected(next);
    setAmount(
      (
        Object.values(next).reduce(
          (sum, value) => sum + Math.round((Number(value) || 0) * 100),
          0,
        ) / 100
      ).toFixed(2),
    );
  }
  async function submit() {
    setError("");
    setSuccess("");
    if (
      !customer ||
      !outstanding ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0
    ) {
      setError("Select a customer and enter a positive payment amount.");
      return;
    }
    if (allocationError) {
      setError(allocationError);
      return;
    }
    setBusy(true);
    try {
      await apiRequest("payments", {
        method: "POST",
        body: {
          customerId: customer.id,
          allocations: selectedAllocations.map(({ invoiceId, amount }) => ({
            invoiceId,
            amount,
          })),
          amount: Number(amount),
          method,
          notes: notes || undefined,
          cheque:
            method === "CHEQUE"
              ? {
                  chequeNumber: number || undefined,
                  chequeDate: date || undefined,
                }
              : undefined,
        },
      });
      setAmount("");
      setNumber("");
      setDate("");
      setNotes("");
      setSelected({});
      setAmount("");
      setReviewCollection(false);
      setRevision((r) => r + 1);
      setSuccess(
        "Temporary collection saved. The invoice balance stays unchanged until confirmation and, for cheques, bank reconciliation.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save payment");
    } finally {
      setBusy(false);
    }
  }
  async function cancelCollection(payment: Payment) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await apiRequest(`payments/${payment.id}/cancel`, {
        method: "POST",
        body: {},
      });
      setSuccess("Payment cancelled.");
      setRevision((r) => r + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to cancel payment");
    } finally {
      setBusy(false);
    }
  }
  async function confirmHandover() {
    if (!confirm) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await apiRequest(`payments/${confirm.id}/confirm`, {
        method: "POST",
        body:
          confirm.method === "CHEQUE"
            ? { chequeNumber: confirmNumber, chequeDate: confirmDate }
            : {},
      });
      setSuccess(
        confirm.method === "CHEQUE"
          ? "Cheque handover recorded. Bank reconciliation is still required."
          : "Cash handover confirmed and invoice balances updated.",
      );
      setConfirm(null);
      setRevision((r) => r + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to confirm payment");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack spacing={3}>
      <Typography variant="h4">Payment Collection</Typography>
      {collectorId && <Alert severity="info">Showing {collectionMethod?.toLowerCase()} collections recorded by user #{collectorId} on {collectionDate}. Confirm handover below, then return to the driver summary.</Alert>}
      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}
      {canCreate && (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Record a temporary collection</Typography>
            <Autocomplete
              options={customers}
              value={customer}
              filterOptions={(options) => options}
              getOptionLabel={(c) => `${c.code} � ${c.displayName}`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onInputChange={(_, value) => setSearch(value)}
              onChange={(_, value) => {
                setCustomer(value);
                setSelected({});
                setAmount("");
              }}
              renderInput={(params) => (
                <TextField {...params} label="Customer" required />
              )}
            />
            {customer && !outstanding && (
              <Typography>Loading outstanding invoices�</Typography>
            )}
            {outstanding && (
              <>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={4}>
                  <Typography>
                    Total outstanding:{" "}
                    <strong>{money(outstanding.totalOutstanding)}</strong>
                  </Typography>
                  <Typography color="error">
                    Overdue: <strong>{money(outstanding.overdueAmount)}</strong>
                  </Typography>
                </Stack>
                <Box sx={{ overflowX: "auto" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Select</TableCell>
                        <TableCell>Due invoice</TableCell>
                        <TableCell>Due date</TableCell>
                        <TableCell align="right">Balance</TableCell>
                        <TableCell>Payment allocation</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {outstanding.invoices.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell>
                            <Checkbox
                              checked={selected[i.id] !== undefined}
                              inputProps={{
                                "aria-label": `Select ${i.invoiceNumber}`,
                              }}
                              onChange={(_, checked) => {
                                const next = { ...selected };
                                if (checked)
                                  next[i.id] = Number(i.balanceAmount).toFixed(
                                    2,
                                  );
                                else delete next[i.id];
                                updateSelection(next);
                              }}
                            />
                          </TableCell>
                          <TableCell>{i.invoiceNumber}{Number(i.canCreditTotal??0)>0 && <Typography variant="caption" display="block">Can credit deducted: {money(i.canCreditTotal??0)}</Typography>}</TableCell>
                          <TableCell>{i.dueDate.slice(0, 10)}</TableCell>
                          <TableCell align="right">
                            {money(i.balanceAmount)}
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              size="small"
                              sx={{ minWidth: 130 }}
                              disabled={selected[i.id] === undefined}
                              value={selected[i.id] ?? ""}
                              onChange={(e) =>
                                updateSelection({
                                  ...selected,
                                  [i.id]: e.target.value,
                                })
                              }
                              slotProps={{
                                htmlInput: {
                                  min: 0.01,
                                  max: Number(i.balanceAmount),
                                  step: 0.01,
                                  "aria-label": `Payment for ${i.invoiceNumber}`,
                                },
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                      {!outstanding.invoices.length && (
                        <TableRow>
                          <TableCell colSpan={5}>
                            No outstanding invoices.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Box>
                <Typography>
                  {selectedAllocations.length} invoice(s) selected. Allocated
                  total: {money(allocatedCents / 100)}
                </Typography>
                <Typography variant="body2">
                  Select one or more invoices and enter the amount to pay
                  against each. Partial payments are accepted.
                </Typography>
              </>
            )}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                fullWidth
                required
                label="Payment amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
              />
              <TextField
                fullWidth
                select
                label="Payment method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <MenuItem value="CASH">Cash</MenuItem>
                <MenuItem value="CHEQUE">Cheque</MenuItem>
              </TextField>
            </Stack>
            {method === "CHEQUE" && (
              <>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    fullWidth
                    label="Cheque number (optional)"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    slotProps={{ htmlInput: { maxLength: 80 } }}
                  />
                  <TextField
                    fullWidth
                    label="Cheque date (optional)"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Stack>
                <Typography variant="body2">
                  Current and post-dated cheques are accepted. Number and date
                  are required when the super user confirms handover.
                </Typography>
              </>
            )}
            <TextField
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 500 } }}
            />
            <Button
              variant="contained"
              disabled={
                busy || !outstanding || outstanding.totalOutstanding <= 0
              }
              onClick={() => {
                setError("");
                if (allocationError) {
                  setError(allocationError);
                  return;
                }
                setReviewCollection(true);
              }}
            >
              Review payment collection
            </Button>
          </Stack>
        </Paper>
      )}
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Collections</Typography>
          <TextField
            select
            label="Status"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <MenuItem value="">All statuses</MenuItem>
            {["TEMPORARY", "AWAITING_CLEARANCE", "POSTED", "CANCELLED"].map(
              (s) => (
                <MenuItem key={s} value={s}>
                  {statusLabel(s)}
                </MenuItem>
              ),
            )}
          </TextField>
          {payments.map((p) => (
            <Paper variant="outlined" key={p.id} sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Typography fontWeight={600}>
                  {p.customer.displayName} � {money(p.amount)} � {p.method}
                </Typography>
                <Typography variant="caption">{p.paymentNumber}</Typography>
                <Chip
                  sx={{ alignSelf: "start" }}
                  label={statusLabel(p.status)}
                />
                {p.status === "TEMPORARY" && canConfirm && (
                  <Button
                    sx={{ alignSelf: "start" }}
                    onClick={() => {
                      setConfirm(p);
                      setConfirmNumber(p.cheque?.chequeNumber ?? "");
                      setConfirmDate(p.cheque?.chequeDate?.slice(0, 10) ?? "");
                    }}
                  >
                    Confirm handover
                  </Button>
                )}
                {p.status !== "CANCELLED" &&
                  hasAnyPermission(user, ["payments.cancel"]) && (
                    <Button
                      disabled={busy}
                      color="error"
                      sx={{ alignSelf: "start" }}
                      onClick={() => cancelCollection(p)}
                    >
                      Cancel payment
                    </Button>
                  )}
              </Stack>
            </Paper>
          ))}
          {!payments.length && <Typography>No collections found.</Typography>}
          <Stack direction="row" spacing={2}>
            <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Typography>
              Page {page} of {Math.max(1, pages)}
            </Typography>
            <Button
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </Stack>
        </Stack>
      </Paper>
      <Dialog
        open={reviewCollection}
        onClose={() => {
          if (!busy) setReviewCollection(false);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Confirm Payment Collection</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography>
              {customer?.displayName} - {method} - {money(amount)}
            </Typography>
            <InvoiceBreakdown allocations={selectedAllocations} />
            {method === "CHEQUE" && (
              <Typography>
                Cheque number: {number || "Not supplied"} | Cheque date:{" "}
                {date || "Not supplied"}
              </Typography>
            )}
            <Alert severity="info">
              This collection will be saved as temporary until handover is
              confirmed. Cheques also require bank reconciliation.
            </Alert>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setReviewCollection(false)}>
            Back
          </Button>
          <Button
            variant="contained"
            disabled={busy || Boolean(allocationError)}
            onClick={submit}
          >
            Confirm collection
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(confirm)}
        onClose={() => {
          if (!busy) setConfirm(null);
        }}
        fullWidth
      >
        <DialogTitle>Confirm Payment Collection Handover</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography>
              {confirm?.customer.displayName} � {money(confirm?.amount ?? 0)}
            </Typography>
            {confirm?.allocations?.length ? (
              <InvoiceBreakdown allocations={confirm.allocations} />
            ) : confirm?.salesInvoice ? (
              <InvoiceBreakdown
                allocations={[
                  {
                    invoiceId: confirm.salesInvoice.id,
                    invoiceNumber: confirm.salesInvoice.invoiceNumber,
                    dueDate: confirm.salesInvoice.dueDate,
                    amount: Number(confirm.amount),
                  },
                ]}
              />
            ) : (
              <Alert severity="info">
                This earlier collection has no selected invoices. It will be
                allocated to the oldest due invoices when settled.
              </Alert>
            )}
            {confirm?.method === "CHEQUE" ? (
              <>
                <Alert severity="info">
                  This records receipt of the cheque. Payment remains pending
                  until bank reconciliation.
                </Alert>
                <TextField
                  required
                  label="Cheque number"
                  value={confirmNumber}
                  onChange={(e) => setConfirmNumber(e.target.value)}
                  slotProps={{ htmlInput: { maxLength: 80 } }}
                />
                <TextField
                  required
                  label="Cheque date"
                  type="date"
                  value={confirmDate}
                  onChange={(e) => setConfirmDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </>
            ) : (
              <Typography>
                Confirm that you have received this cash. Invoice balances will
                be updated.
              </Typography>
            )}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setConfirm(null)}>
            Close
          </Button>
          <Button
            variant="contained"
            disabled={
              busy ||
              (confirm?.method === "CHEQUE" &&
                (!confirmNumber.trim() || !confirmDate))
            }
            onClick={confirmHandover}
          >
            Confirm handover
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function InvoiceBreakdown({ allocations }: { allocations: Allocation[] }) {
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Typography variant="subtitle1">Selected invoice breakdown</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Invoice</TableCell>
            <TableCell>Due date</TableCell>
            <TableCell align="right">Balance at collection</TableCell>
            <TableCell align="right">Payment</TableCell>
            <TableCell align="right">Remaining after payment</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {allocations.map((a) => (
            <TableRow key={a.invoiceId}>
              <TableCell>
                {a.invoiceNumber ?? `Invoice #${a.invoiceId}`}
              </TableCell>
              <TableCell>{a.dueDate?.slice(0, 10) ?? "-"}</TableCell>
              <TableCell align="right">
                {a.balanceAtCollection === undefined
                  ? "-"
                  : money(a.balanceAtCollection)}
              </TableCell>
              <TableCell align="right">{money(a.amount)}</TableCell>
              <TableCell align="right">
                {a.balanceAtCollection === undefined
                  ? "-"
                  : money(a.balanceAtCollection - a.amount)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell colSpan={3}>
              <strong>Total payment</strong>
            </TableCell>
            <TableCell align="right">
              <strong>
                {money(
                  allocations.reduce(
                    (sum, a) => sum + Math.round(a.amount * 100),
                    0,
                  ) / 100,
                )}
              </strong>
            </TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </Box>
  );
}
