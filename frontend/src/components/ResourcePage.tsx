import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Pagination,
  Stack,
  Switch,
  TextField,
  Tooltip
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  apiRequest,
  normalizeListResponse
} from "../api/client";
import { compactObject, getValueByPath } from "../utils/object";
import { DataState } from "./DataState";
import { PageHeader } from "./PageHeader";
import { DataColumn, ResponsiveDataView } from "./ResponsiveDataView";

export type ResourceReference = {
  endpoint: string;
  labelPath: string;
  query?: Record<string, number | string | boolean | undefined>;
  secondaryLabelPath?: string;
  valuePath?: string;
};

export type ResourceField = {
  createOnly?: boolean;
  helperText?: string;
  label: string;
  name: string;
  options?: { label: string; value: string }[];
  reference?: ResourceReference;
  required?: boolean;
  type?: "checkbox" | "date" | "datetime" | "json" | "number" | "select" | "text";
};

export type ResourceAction<T> = {
  bodyFields?: ResourceField[];
  endpoint: (record: T) => string;
  label: string;
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  variant?: "outlined" | "contained";
};

export type ResourcePageConfig<T extends Record<string, unknown>> = {
  actions?: ResourceAction<T>[];
  columns: DataColumn<T>[];
  createEndpoint?: string | ((payload: Record<string, unknown>) => string);
  createMethod?: "POST" | "PUT";
  deleteEndpoint?: (record: T) => string;
  endpoint: string;
  fields?: ResourceField[];
  getRowId?: (record: T) => string | number;
  listQuery?: Record<string, number | string | boolean | undefined>;
  searchPlaceholder?: string;
  subtitle?: string;
  title: string;
  updateEndpoint?: (record: T) => string;
};

type ResourcePageProps<T extends Record<string, unknown>> = {
  config: ResourcePageConfig<T>;
};

const pageSize = 10;

export function ResourcePage<T extends Record<string, unknown>>({
  config
}: ResourcePageProps<T>) {
  const [records, setRecords] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [totalPages, setTotalPages] = useState(1);
  const [editingRecord, setEditingRecord] = useState<T | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [actionRecord, setActionRecord] = useState<T | null>(null);
  const [actionConfig, setActionConfig] = useState<ResourceAction<T> | null>(null);
  const [actionValues, setActionValues] = useState<Record<string, unknown>>({});
  const [referenceOptions, setReferenceOptions] = useState<
    Record<string, { label: string; value: string }[]>
  >({});

  const getRowId = config.getRowId ?? ((record: T) => record.id as number);
  const canCreate = Boolean(config.fields?.length && config.createEndpoint);
  const canEdit = Boolean(config.fields?.length && config.updateEndpoint);
  const canDelete = Boolean(config.deleteEndpoint);
  const referenceFields = useMemo(() => collectReferenceFields(config), [config]);
  const visibleFormFields = editingRecord
    ? (config.fields ?? []).filter((field) => !field.createOnly)
    : config.fields ?? [];

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiRequest<unknown>(config.endpoint, {
        query: {
          ...config.listQuery,
          limit: pageSize,
          page,
          search
        }
      });
      const normalized = normalizeListResponse<T>(response);
      setRecords(normalized.data);
      setTotalPages(normalized.meta?.totalPages ?? 1);
    } catch (currentError) {
      setError(getErrorMessage(currentError));
    } finally {
      setIsLoading(false);
    }
  }, [config.endpoint, config.listQuery, page, search]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    let isActive = true;

    async function loadReferenceOptions() {
      if (referenceFields.length === 0) {
        setReferenceOptions({});
        return;
      }

      try {
        const entries = await Promise.all(
          referenceFields.map(async (field) => {
            const reference = field.reference!;
            const response = await apiRequest<unknown>(reference.endpoint, {
              query: { limit: 100, ...reference.query }
            });
            const rows = normalizeListResponse<Record<string, unknown>>(response).data;
            return [
              field.name,
              rows.map((row) => toReferenceOption(row, reference))
            ] as const;
          })
        );

        if (isActive) {
          setReferenceOptions(Object.fromEntries(entries));
        }
      } catch (currentError) {
        if (isActive) {
          setError(getErrorMessage(currentError));
        }
      }
    }

    void loadReferenceOptions();

    return () => {
      isActive = false;
    };
  }, [referenceFields]);

  const openCreate = () => {
    setEditingRecord(null);
    setFormValues(getInitialValues(config.fields ?? []));
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (record: T) => {
    setEditingRecord(record);
    setFormValues(getInitialValues(config.fields ?? [], record));
    setFormError(null);
    setFormOpen(true);
  };

  const saveForm = async () => {
    if (!config.fields) {
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      const payload = buildPayload(
        config.fields,
        formValues,
        editingRecord ? "update" : "create"
      );
      if (editingRecord && config.updateEndpoint) {
        await apiRequest(config.updateEndpoint(editingRecord), {
          body: payload,
          method: "PATCH"
        });
      } else if (config.createEndpoint) {
        const endpoint =
          typeof config.createEndpoint === "function"
            ? config.createEndpoint(payload)
            : config.createEndpoint;
        await apiRequest(endpoint, {
          body: payload,
          method: config.createMethod ?? "POST"
        });
      }
      setFormOpen(false);
      await loadRecords();
    } catch (currentError) {
      setFormError(getErrorMessage(currentError));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRecord = async (record: T) => {
    if (!config.deleteEndpoint || !window.confirm("Delete this record?")) {
      return;
    }
    try {
      await apiRequest(config.deleteEndpoint(record), { method: "DELETE" });
      await loadRecords();
    } catch (currentError) {
      setError(getErrorMessage(currentError));
    }
  };

  const openAction = (record: T, action: ResourceAction<T>) => {
    setActionRecord(record);
    setActionConfig(action);
    setActionValues(getInitialValues(action.bodyFields ?? []));
    setFormError(null);
  };

  const runAction = async () => {
    if (!actionConfig || !actionRecord) {
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      const bodyFields = actionConfig.bodyFields ?? [];
      await apiRequest(actionConfig.endpoint(actionRecord), {
        body: buildPayload(bodyFields, actionValues, "create"),
        method: actionConfig.method ?? "POST"
      });
      setActionConfig(null);
      setActionRecord(null);
      await loadRecords();
    } catch (currentError) {
      setFormError(getErrorMessage(currentError));
    } finally {
      setIsSaving(false);
    }
  };

  const actionButtons = useCallback(
    (record: T) => (
      <Stack direction="row" flexWrap="wrap" gap={0.5}>
        {canEdit && (
          <Tooltip title="Edit">
            <IconButton color="primary" onClick={() => openEdit(record)} size="small">
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {config.actions?.map((action) => (
          <Button
            key={action.label}
            onClick={() => openAction(record, action)}
            size="small"
            variant={action.variant ?? "outlined"}
          >
            {action.label}
          </Button>
        ))}
        {canDelete && (
          <Tooltip title="Delete">
            <IconButton color="error" onClick={() => void deleteRecord(record)} size="small">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    ),
    [canDelete, canEdit, config.actions]
  );

  const actions = useMemo(
    () => (
      <Stack direction="row" spacing={1}>
        <Button onClick={() => void loadRecords()} startIcon={<RefreshIcon />}>
          Refresh
        </Button>
        {canCreate && (
          <Button onClick={openCreate} startIcon={<AddIcon />} variant="contained">
            New
          </Button>
        )}
      </Stack>
    ),
    [canCreate, loadRecords]
  );

  return (
    <Stack spacing={2.5}>
      <PageHeader actions={actions} subtitle={config.subtitle} title={config.title} />

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label={config.searchPlaceholder ?? "Search"}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              size="small"
              value={search}
            />
            <DataState error={error} loading={isLoading} />
            {!isLoading && !error && (
              <>
                <ResponsiveDataView
                  actions={canEdit || canDelete || config.actions?.length ? actionButtons : undefined}
                  columns={config.columns}
                  getRowId={getRowId}
                  records={records}
                />
                <DataState empty={records.length === 0} />
                {totalPages > 1 && (
                  <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                    <Pagination
                      count={totalPages}
                      onChange={(_, value) => setPage(value)}
                      page={page}
                    />
                  </Box>
                )}
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Dialog fullWidth maxWidth="sm" onClose={() => setFormOpen(false)} open={formOpen}>
        <DialogTitle>{editingRecord ? `Edit ${config.title}` : `New ${config.title}`}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            {visibleFormFields.map((field) => (
              <FormField
                field={field}
                key={field.name}
                onChange={(value) =>
                  setFormValues((current) => ({ ...current, [field.name]: value }))
                }
                options={getFieldOptions(field, referenceOptions)}
                value={formValues[field.name]}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button disabled={isSaving} onClick={() => void saveForm()} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        fullWidth
        maxWidth="sm"
        onClose={() => setActionConfig(null)}
        open={Boolean(actionConfig)}
      >
        <DialogTitle>{actionConfig?.label}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            {(actionConfig?.bodyFields ?? []).map((field) => (
              <FormField
                field={field}
                key={field.name}
                onChange={(value) =>
                  setActionValues((current) => ({ ...current, [field.name]: value }))
                }
                options={getFieldOptions(field, referenceOptions)}
                value={actionValues[field.name]}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionConfig(null)}>Cancel</Button>
          <Button disabled={isSaving} onClick={() => void runAction()} variant="contained">
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function FormField({
  field,
  onChange,
  options,
  value
}: {
  field: ResourceField;
  onChange: (value: unknown) => void;
  options?: { label: string; value: string }[];
  value: unknown;
}) {
  if (field.type === "checkbox") {
    return (
      <FormControlLabel
        control={
          <Switch
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
          />
        }
        label={field.label}
      />
    );
  }

  if (field.type === "select" || field.reference) {
    return (
      <TextField
        fullWidth
        helperText={field.helperText}
        label={field.label}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        select
        value={value ?? ""}
      >
        {options?.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
    );
  }

  return (
    <TextField
      fullWidth
      helperText={field.helperText}
      label={field.label}
      minRows={field.type === "json" ? 4 : undefined}
      multiline={field.type === "json"}
      onChange={(event) => onChange(event.target.value)}
      required={field.required}
      type={field.type === "number" ? "number" : field.type === "datetime" ? "datetime-local" : "text"}
      value={value ?? ""}
    />
  );
}

function getInitialValues(fields: ResourceField[], record?: Record<string, unknown>) {
  return fields.reduce<Record<string, unknown>>((result, field) => {
    const value = record ? getValueByPath(record, field.name) : undefined;
    if (field.type === "json") {
      result[field.name] = value === undefined ? "" : JSON.stringify(value, null, 2);
    } else if (field.type === "checkbox") {
      result[field.name] = Boolean(value);
    } else if (field.type === "datetime" && typeof value === "string") {
      result[field.name] = value.slice(0, 16);
    } else {
      result[field.name] = value ?? "";
    }
    return result;
  }, {});
}

function collectReferenceFields<T extends Record<string, unknown>>(
  config: ResourcePageConfig<T>
) {
  const fields = [
    ...(config.fields ?? []),
    ...(config.actions?.flatMap((action) => action.bodyFields ?? []) ?? [])
  ];
  const references = new Map<string, ResourceField>();

  fields.forEach((field) => {
    if (field.reference && !references.has(field.name)) {
      references.set(field.name, field);
    }
  });

  return Array.from(references.values());
}

function getFieldOptions(
  field: ResourceField,
  referenceOptions: Record<string, { label: string; value: string }[]>
) {
  return field.reference ? referenceOptions[field.name] ?? [] : field.options;
}

function toReferenceOption(
  row: Record<string, unknown>,
  reference: ResourceReference
) {
  const primary = formatReferencePart(getValueByPath(row, reference.labelPath));
  const secondary = reference.secondaryLabelPath
    ? formatReferencePart(getValueByPath(row, reference.secondaryLabelPath))
    : "";
  const label = [secondary, primary].filter(Boolean).join(" - ");
  const value = getValueByPath(row, reference.valuePath ?? "id");

  return {
    label: label || String(value),
    value: String(value)
  };
}

function formatReferencePart(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  return String(value);
}

function buildPayload(
  fields: ResourceField[],
  values: Record<string, unknown>,
  mode: "create" | "update"
) {
  const payload = fields.reduce<Record<string, unknown>>((result, field) => {
    if (mode === "update" && field.createOnly) {
      return result;
    }
    const value = values[field.name];
    if (value === "" || value === undefined) {
      return result;
    }
    if (field.type === "number") {
      result[field.name] = Number(value);
    } else if (field.type === "checkbox") {
      result[field.name] = Boolean(value);
    } else if (field.type === "json") {
      result[field.name] = typeof value === "string" ? JSON.parse(value) : value;
    } else if (field.type === "datetime") {
      result[field.name] = new Date(String(value)).toISOString();
    } else {
      result[field.name] = value;
    }
    return result;
  }, {});

  return compactObject(payload);
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (Array.isArray((error.details as { message?: unknown })?.message)) {
      return ((error.details as { message: string[] }).message).join(", ");
    }
    return error.message;
  }
  if (error instanceof SyntaxError) {
    return "Check JSON fields for valid JSON.";
  }
  return error instanceof Error ? error.message : "Request failed.";
}
