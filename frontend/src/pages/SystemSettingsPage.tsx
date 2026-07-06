import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { apiRequest, normalizeListResponse } from "../api/client";
import { DataState } from "../components/DataState";
import { PageHeader } from "../components/PageHeader";
import { ResponsiveDataView } from "../components/ResponsiveDataView";

type SettingRow = {
  category: string;
  description?: string;
  id: number;
  isSensitive: boolean;
  key: string;
  status: string;
  value: unknown;
  valueType: "BOOLEAN" | "JSON" | "NUMBER" | "STRING";
};

export function SystemSettingsPage() {
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    category: "general",
    description: "",
    isSensitive: false,
    key: "",
    value: "",
    valueType: "STRING" as SettingRow["valueType"]
  });

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiRequest<unknown>("system-settings", {
        query: { limit: 100 }
      });
      setRows(normalizeListResponse<SettingRow>(response).data);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Request failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const save = async () => {
    setError(null);
    try {
      await apiRequest(`system-settings/${form.key}`, {
        body: {
          category: form.category,
          description: form.description,
          isSensitive: form.isSensitive,
          value: parseValue(form.value, form.valueType),
          valueType: form.valueType
        },
        method: "PUT"
      });
      setDialogOpen(false);
      await loadRows();
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Save failed");
    }
  };

  const edit = (row: SettingRow) => {
    setForm({
      category: row.category,
      description: row.description ?? "",
      isSensitive: row.isSensitive,
      key: row.key,
      value: row.isSensitive ? "" : JSON.stringify(row.value).replace(/^"|"$/g, ""),
      valueType: row.valueType
    });
    setDialogOpen(true);
  };

  return (
    <Stack spacing={2.5}>
      <PageHeader
        actions={
          <Stack direction="row" spacing={1}>
            <Button onClick={() => void loadRows()} startIcon={<RefreshIcon />}>
              Refresh
            </Button>
            <Button onClick={() => setDialogOpen(true)} startIcon={<AddIcon />} variant="contained">
              New
            </Button>
          </Stack>
        }
        title="System Settings"
      />

      <Card variant="outlined">
        <CardContent>
          <DataState empty={!isLoading && rows.length === 0} error={error} loading={isLoading} />
          {!isLoading && rows.length > 0 && (
            <ResponsiveDataView
              actions={(row) => (
                <Button onClick={() => edit(row)} size="small" variant="outlined">
                  Edit
                </Button>
              )}
              columns={[
                { label: "Key", path: "key" },
                { label: "Category", path: "category" },
                { label: "Value", path: "value" },
                { label: "Type", path: "valueType" },
                { label: "Status", path: "status" }
              ]}
              getRowId={(row) => row.id}
              records={rows}
            />
          )}
        </CardContent>
      </Card>

      <Dialog fullWidth maxWidth="sm" onClose={() => setDialogOpen(false)} open={dialogOpen}>
        <DialogTitle>System Setting</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              fullWidth
              label="Key"
              onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))}
              value={form.key}
            />
            <TextField
              fullWidth
              label="Category"
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              value={form.category}
            />
            <TextField
              fullWidth
              label="Value type"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  valueType: event.target.value as SettingRow["valueType"]
                }))
              }
              select
              value={form.valueType}
            >
              {["STRING", "NUMBER", "BOOLEAN", "JSON"].map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              label="Value"
              minRows={form.valueType === "JSON" ? 4 : undefined}
              multiline={form.valueType === "JSON"}
              onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
              value={form.value}
            />
            <TextField
              fullWidth
              label="Description"
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              value={form.description}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.isSensitive}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isSensitive: event.target.checked }))
                  }
                />
              }
              label="Sensitive"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={() => void save()} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function parseValue(value: string, type: SettingRow["valueType"]) {
  if (type === "NUMBER") {
    return Number(value);
  }
  if (type === "BOOLEAN") {
    return value === "true";
  }
  if (type === "JSON") {
    return JSON.parse(value);
  }
  return value;
}
