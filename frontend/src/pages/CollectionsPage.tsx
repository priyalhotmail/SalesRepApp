import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { apiRequest, ApiListResponse } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { hasAnyPermission } from "../auth/permissions";
import { formatMoney } from "../utils/money";

type Bucket = { cash: number; cheque: number; chequeCount: number };
type Branch = { id: number; name: string; buckets: Record<string, Bucket> };
type Receipt = {
  id: number;
  paymentNumber: string;
  paymentDate: string;
  amount: string;
  method: string;
  customer: { displayName: string };
  cheque?: { chequeNumber: string; chequeDate: string; status: string };
};
type Transfer = {
  id: string;
  officeId: number;
  destination: string;
  status: string;
  reference: string;
  bankName?: string;
  sentAt: string;
  notes?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  items: { amount: string; method: string; payment: Receipt }[];
};
const buckets = [
  ["TEMPORARY", "Awaiting branch handover"],
  ["AVAILABLE", "Held at branch"],
  ["HEAD_OFFICE_PENDING", "Sent to head office"],
  ["HEAD_OFFICE_RECEIVED", "Received at head office"],
  ["HEAD_OFFICE_NOT_RECEIVED", "Head office: not received"],
  ["BANK_PENDING", "Bank deposits awaiting verification"],
  ["BANK_RECEIVED", "Bank deposits verified"],
  ["BANK_NOT_RECEIVED", "Bank deposits not verified"],
  ["PREVIOUS_BANK", "Other cheques already deposited / cleared"],
] as const;
const today = () => new Date().toISOString().slice(0, 10);
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Request failed";
export function CollectionsPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [office, setOffice] = useState("");
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [history, setHistory] = useState<Transfer[]>([]);
  const [page, setPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [historyPages, setHistoryPages] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sendOpen, setSendOpen] = useState(false);
  const [review, setReview] = useState<Transfer | null>(null);
  const [destination, setDestination] = useState("HEAD_OFFICE");
  const [sentAt, setSentAt] = useState(today());
  const [reference, setReference] = useState("");
  const [bank, setBank] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewStatus, setReviewStatus] = useState("RECEIVED");
  const [reviewNotes, setReviewNotes] = useState("");
  const revision = useRef(0);
  const load = useCallback(async () => {
    const current = ++revision.current;
    setLoading(true);
    try {
      const [summary, available, transfers] = await Promise.all([
        apiRequest<{ branches: Branch[]; canReview: boolean }>(
          "collections/dashboard",
        ),
        office
          ? apiRequest<ApiListResponse<Receipt>>("collections/available", {
              query: { officeId: office, page, limit: 20 },
            })
          : Promise.resolve({ data: [], meta: undefined }),
        apiRequest<ApiListResponse<Transfer>>("collections/history", {
          query: {
            officeId: office || undefined,
            page: historyPage,
            limit: 20,
          },
        }),
      ]);
      if (current !== revision.current) return;
      setBranches(summary.branches);
      setCanReview(summary.canReview);
      setReceipts(available.data);
      setPages(available.meta?.totalPages ?? 1);
      setHistory(transfers.data);
      setHistoryPages(transfers.meta?.totalPages ?? 1);
      if (!office && summary.branches.length === 1)
        setOffice(String(summary.branches[0]!.id));
    } catch (e) {
      if (current === revision.current) setError(message(e));
    } finally {
      if (current === revision.current) setLoading(false);
    }
  }, [office, page, historyPage]);
  useEffect(() => {
    void load();
    return () => {
      revision.current++;
    };
  }, [load]);
  useEffect(() => {
    if (sendOpen || review || busy) return;
    const refresh = () => {
      void load();
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [load, sendOpen, review, busy]);
  const selectedReceipts = receipts.filter((r) => selected.includes(r.id));
  const selectedCash = selectedReceipts.filter((r) => r.method === "CASH");
  const selectedCheques = selectedReceipts.filter((r) => r.method === "CHEQUE");
  const cashAmount = selectedCash.reduce((sum, r) => sum + Math.round(Number(r.amount) * 100), 0) / 100;
  const chequeAmount = selectedCheques.reduce((sum, r) => sum + Math.round(Number(r.amount) * 100), 0) / 100;
  const total =
    selectedReceipts.reduce(
      (sum, r) => sum + Math.round(Number(r.amount) * 100),
      0,
    ) / 100;
  const chooseOffice = (id: string) => {
    setOffice(id);
    setSelected([]);
    setPage(1);
    setHistoryPage(1);
  };
  const submit = async () => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (review) {
        await apiRequest(`collections/${review.id}/review`, {
          method: "POST",
          body: { status: reviewStatus, notes: reviewNotes },
        });
        setReview(null);
        setSuccess("Head-office review saved.");
      } else {
        await apiRequest("collections", {
          method: "POST",
          body: {
            officeId: Number(office),
            paymentIds: selectedReceipts.map((r) => r.id),
            destination,
            sentAt: sentAt + "T00:00:00.000Z",
            reference,
            bankName: bank,
            notes,
          },
        });
        setSendOpen(false);
        setSelected([]);
        setReference("");
        setBank("");
        setNotes("");
        setSuccess("Transfer recorded. Awaiting head-office review.");
      }
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="h4">Branch Collections</Typography>
        <Button
          disabled={busy || loading}
          onClick={() => {
            setError("");
            void load();
          }}
        >
          Refresh
        </Button>
      </Stack>
      <Typography color="text.secondary">
        All-time collection custody. Amounts are in LKR. Temporary payments must
        be handed over to the branch before sending. Deposit verification does
        not clear a cheque or change customer balances.
      </Typography>
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
      <TextField
        label="Branch"
        select
        value={office}
        onChange={(e) => chooseOffice(e.target.value)}
        sx={{ maxWidth: 400 }}
      >
        <MenuItem value="">All branches — summary only</MenuItem>
        {branches.map((b) => (
          <MenuItem key={b.id} value={String(b.id)}>
            {b.name}
          </MenuItem>
        ))}
      </TextField>
      {branches
        .filter((b) => !office || b.id === Number(office))
        .map((branch) => (
          <Paper key={branch.id} sx={{ p: 2 }} variant="outlined">
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="h6">{branch.name}</Typography>
              <Button onClick={() => chooseOffice(String(branch.id))}>
                View collections
              </Button>
            </Stack>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Location / status</TableCell>
                    <TableCell align="right">Cash</TableCell>
                    <TableCell align="right">Cheques</TableCell>
                    <TableCell align="right">Cheque amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {buckets.map(([key, label]) => (
                    <TableRow key={key}>
                      <TableCell>{label}</TableCell>
                      <TableCell align="right">
                        {formatMoney(branch.buckets[key]?.cash ?? 0)}
                      </TableCell>
                      <TableCell align="right">
                        {branch.buckets[key]?.chequeCount ?? 0}
                      </TableCell>
                      <TableCell align="right">
                        {formatMoney(branch.buckets[key]?.cheque ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell>
                      <strong>Total tracked collections</strong>
                    </TableCell>
                    <TableCell align="right">
                      {formatMoney(
                        Object.values(branch.buckets).reduce(
                          (sum, b) => sum + Math.round(b.cash * 100),
                          0,
                        ) / 100,
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {Object.values(branch.buckets).reduce(
                        (sum, b) => sum + b.chequeCount,
                        0,
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {formatMoney(
                        Object.values(branch.buckets).reduce(
                          (sum, b) => sum + Math.round(b.cheque * 100),
                          0,
                        ) / 100,
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>
          </Paper>
        ))}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6">
          Available receipts{" "}
          {office &&
            `— ${branches.find((b) => b.id === Number(office))?.name ?? ""}`}
        </Typography>
        {!office ? (
          <Typography>
            Select a branch to choose cash receipts and cheques.
          </Typography>
        ) : (
          <>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Select</TableCell>
                    <TableCell>Receipt / customer</TableCell>
                    <TableCell>Method / cheque</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {receipts.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Checkbox
                          disabled={busy || loading}
                          checked={selected.includes(r.id)}
                          inputProps={{
                            "aria-label": `Select ${r.paymentNumber}`,
                          }}
                          onChange={(e) =>
                            setSelected((s) =>
                              e.target.checked
                                ? [...s, r.id]
                                : s.filter((id) => id !== r.id),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {r.paymentNumber}
                        <Typography variant="body2">
                          {r.customer.displayName} ·{" "}
                          {r.paymentDate.slice(0, 10)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {r.method}
                        {r.cheque && (
                          <Typography variant="body2">
                            {r.cheque.chequeNumber} ·{" "}
                            {r.cheque.chequeDate?.slice(0, 10)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {formatMoney(r.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            {!receipts.length && (
              <Typography sx={{ py: 2 }}>
                No confirmed receipts available for transfer.
              </Typography>
            )}
            <Pagination
              count={Math.max(1, pages)}
              page={page}
              disabled={busy || loading}
              onChange={(_, p) => {
                setPage(p);
                setSelected([]);
              }}
            />
            <Button
              variant="contained"
              sx={{ mt: 2 }}
              disabled={
                busy ||
                loading ||
                !selectedReceipts.length ||
                !hasAnyPermission(user, ["collections.send"])
              }
              onClick={() => {
                setError("");
                setSendOpen(true);
              }}
            >
              Send / Deposit {selectedReceipts.length} receipts — Cash: {formatMoney(cashAmount)}, Cheques {selectedCheques.length}: {formatMoney(chequeAmount)}
            </Button>
          </>
        )}
      </Paper>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6">
          Transfer history and head-office review
        </Typography>
        {!history.length && <Typography>No transfers recorded.</Typography>}
        <Stack spacing={2} sx={{ my: 2 }}>
          {history.map((t) => (
            <Paper key={t.id} variant="outlined" sx={{ p: 2 }}>
              <Typography fontWeight={700}>
                {branches.find((b) => b.id === t.officeId)?.name} ·{" "}
                {t.destination === "BANK"
                  ? `Bank deposit: ${t.bankName}`
                  : "Sent to head office"}
              </Typography>
              <Typography>
                {t.sentAt.slice(0, 10)} · {t.reference} ·{" "}
                {t.status === "RECEIVED"
                  ? t.destination === "BANK"
                    ? "Verified"
                    : "Received"
                  : t.status.replaceAll("_", " ")}
              </Typography>
              <Typography>{t.notes}</Typography>
              {t.items.map((i) => (
                <Typography variant="body2" key={i.payment.id}>
                  {i.payment.paymentNumber} · {i.payment.customer.displayName} ·{" "}
                  {i.method}
                  {i.payment.cheque
                    ? ` #${i.payment.cheque.chequeNumber} (${i.payment.cheque.status})`
                    : ""}{" "}
                  · {formatMoney(i.amount)}
                </Typography>
              ))}
              <Typography fontWeight={600}>
                Total:{" "}
                {formatMoney(
                  t.items.reduce(
                    (sum, i) => sum + Math.round(Number(i.amount) * 100),
                    0,
                  ) / 100,
                )}
              </Typography>
              {t.reviewedAt && (
                <Typography variant="body2">
                  Reviewed {new Date(t.reviewedAt).toLocaleString()} ·{" "}
                  {t.reviewNotes}
                </Typography>
              )}
              {canReview &&
                hasAnyPermission(user, ["collections.receive"]) &&
                t.status !== "RECEIVED" && (
                  <Button
                    disabled={busy}
                    onClick={() => {
                      setReview(t);
                      setReviewStatus("RECEIVED");
                      setReviewNotes("");
                      setError("");
                    }}
                  >
                    Review receipt / deposit
                  </Button>
                )}
            </Paper>
          ))}
        </Stack>
        <Pagination
          count={Math.max(1, historyPages)}
          page={historyPage}
          disabled={busy || loading}
          onChange={(_, p) => setHistoryPage(p)}
        />
      </Paper>
      <Dialog
        open={sendOpen || Boolean(review)}
        onClose={() => {
          if (!busy) {
            setSendOpen(false);
            setReview(null);
          }
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {review
            ? "Head-office review"
            : "Send collections / record bank deposit"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {review ? (
              <>
                <Typography>
                  {review.reference} ·{" "}
                  {review.destination === "BANK"
                    ? review.bankName
                    : "Head-office handover"}
                </Typography>
                <TextField
                  select
                  label="Result"
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value)}
                >
                  <MenuItem value="RECEIVED">
                    {review.destination === "BANK"
                      ? "Deposit verified"
                      : "Received"}
                  </MenuItem>
                  {review.status === "PENDING" && (
                    <MenuItem value="NOT_RECEIVED">
                      {review.destination === "BANK"
                        ? "Not verified"
                        : "Not received"}
                    </MenuItem>
                  )}
                </TextField>
                <TextField
                  label="Review notes"
                  multiline
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  required={reviewStatus === "NOT_RECEIVED"}
                  inputProps={{ maxLength: 500 }}
                />
              </>
            ) : (
              <>
                <Typography>
                  {branches.find((b) => b.id === Number(office))?.name} ·{" "}
                  {selectedReceipts.length} receipts — Cash: {formatMoney(cashAmount)}, Cheques {selectedCheques.length}: {formatMoney(chequeAmount)} · Total: {formatMoney(total)}
                </Typography>
                {selectedReceipts.map((r) => (
                  <Typography key={r.id} variant="body2">
                    {r.paymentNumber} · {r.method} · {formatMoney(r.amount)}
                  </Typography>
                ))}
                <TextField
                  select
                  label="Destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                >
                  <MenuItem value="HEAD_OFFICE">Head office</MenuItem>
                  <MenuItem value="BANK">Bank deposit</MenuItem>
                </TextField>
                <TextField
                  label="Sent / deposit date"
                  type="date"
                  value={sentAt}
                  onChange={(e) => setSentAt(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  inputProps={{ max: today() }}
                />
                {destination === "BANK" && (
                  <TextField
                    required
                    label="Bank / company account"
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                    inputProps={{ maxLength: 160 }}
                  />
                )}
                <TextField
                  required
                  label={
                    destination === "BANK"
                      ? "Deposit slip / transaction reference"
                      : "Handover / courier reference"
                  }
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  inputProps={{ maxLength: 160 }}
                />
                <TextField
                  label="Notes"
                  multiline
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  inputProps={{ maxLength: 500 }}
                />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={busy}
            onClick={() => {
              setSendOpen(false);
              setReview(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={
              busy ||
              (review
                ? reviewStatus === "NOT_RECEIVED" && !reviewNotes.trim()
                : !selectedReceipts.length ||
                  !reference.trim() ||
                  !sentAt ||
                  (destination === "BANK" && !bank.trim()))
            }
            onClick={() => void submit()}
          >
            {busy ? "Saving…" : review ? "Save review" : "Record transfer"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
