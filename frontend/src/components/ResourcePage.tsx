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
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormGroup,
  FormControlLabel,
  IconButton,
  MenuItem,
  Pagination,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  apiRequest,
  normalizeListResponse
} from "../api/client";
import { useAuth, AuthUser } from "../auth/AuthContext";
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

type ReferenceOption = {
  code?: string;
  label: string;
  value: string;
};

type OrderItemValue = {
  discountAmount?: number;
  freeQuantity?: number;
  lineTotal?: number;
  productId: number;
  productName?: string;
  quantity: number;
  unitPrice?: number;
};

type DeliveryConfirmationItemValue = {
  deliveredQuantity: number;
  deliveryItemId: number;
  notes?: string;
  orderedQuantity: number;
  productName: string;
  rejectedQuantity: number;
};

export type ResourceField = {
  createOnly?: boolean;
  defaultValue?: "now";
  helperText?: string;
  label: string;
  loadOptions?: boolean;
  name: string;
  options?: ReferenceOption[];
  reference?: ResourceReference;
  referenceQuery?: (values: Record<string, unknown>) => Record<string, number | string | boolean | undefined>;
  required?: boolean;
  type?: "checkbox" | "date" | "datetime" | "deliveryItemSummary" | "deliveryItems" | "deliveryPlanSummary" | "json" | "multiReference" | "number" | "orderItems" | "select" | "text";
  visible?: (user: AuthUser | null) => boolean;
};

export type ResourceAction<T> = {
  bodyFields?: ResourceField[];
  bodyMessage?: (record: T) => string;
  disabled?: (record: T, user: AuthUser | null) => boolean;
  endpoint: (record: T) => string;
  label: string;
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  previewOnly?: boolean;
  visible?: (record: T, user: AuthUser | null) => boolean;
  variant?: "outlined" | "contained";
};

export type ResourcePageConfig<T extends Record<string, unknown>> = {
  actions?: ResourceAction<T>[];
  canCreate?: (user: AuthUser | null) => boolean;
  canEdit?: (user: AuthUser | null) => boolean;
  columns: DataColumn<T>[];
  createEndpoint?: string | ((payload: Record<string, unknown>) => string);
  createMethod?: "POST" | "PUT";
  deleteEndpoint?: (record: T) => string;
  detailEndpoint?: (record: T) => string;
  endpoint: string;
  formContextEndpoint?: string;
  formContextSalesRepReference?: ResourceReference;
  fields?: ResourceField[];
  getRowId?: (record: T) => string | number;
  listQuery?: Record<string, number | string | boolean | undefined>;
  requiredPermissions?: string[];
  roleAssignmentEndpoint?: (record: T) => string;
  searchPlaceholder?: string;
  subtitle?: string;
  title: string;
  updateEndpoint?: (record: T) => string;
};

type ResourcePageProps<T extends Record<string, unknown>> = {
  config: ResourcePageConfig<T>;
};

type CustomerFormContext = {
  salesRep: null | {
    id: number;
    name: string;
    office?: { id: number; name: string };
    officeId?: number;
  };
};

const pageSize = 10;

export function ResourcePage<T extends Record<string, unknown>>({
  config
}: ResourcePageProps<T>) {
  const { user } = useAuth();
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
    Record<string, ReferenceOption[]>
  >({});
  const [formContext, setFormContext] = useState<CustomerFormContext | null>(null);
  const [deliveryDriverId, setDeliveryDriverId] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [deliveryDrivers, setDeliveryDrivers] = useState<ReferenceOption[]>([]);
  const isDeliveryPage = config.endpoint === "deliveries";

  const getRowId = config.getRowId ?? ((record: T) => record.id as number);
  const canCreate = Boolean(config.fields?.length && config.createEndpoint) && (config.canCreate?.(user) ?? true);
  const canEdit = Boolean(config.fields?.length && config.updateEndpoint) && (config.canEdit?.(user) ?? true);
  const canDelete = Boolean(config.deleteEndpoint);
  const referenceFields = useMemo(() => collectReferenceFields(config), [config]);
  const visibleColumns = config.columns.filter((column) => column.visible?.(user) ?? true);
  const visibleFormFields = (config.fields ?? []).filter(
    (field) =>
      (!editingRecord || !field.createOnly) &&
      (field.visible?.(user) ?? true)
  );

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiRequest<unknown>(config.endpoint, {
        query: {
          ...config.listQuery,
          driverId: isDeliveryPage && deliveryDriverId ? Number(deliveryDriverId) : undefined,
          limit: pageSize,
          page,
          search,
          status: isDeliveryPage && deliveryStatus ? deliveryStatus : undefined
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
  }, [config.endpoint, config.listQuery, deliveryDriverId, deliveryStatus, isDeliveryPage, page, search]);

  useEffect(() => {
    if (!isDeliveryPage || user?.roles.includes("DELIVERY_PERSON")) return;
    void apiRequest<unknown>("deliveries/drivers").then((response) => setDeliveryDrivers(toReferenceOptions(response, { endpoint: "", labelPath: "user.displayName", secondaryLabelPath: "code" })));
  }, [isDeliveryPage, user?.roles]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const loadReferenceOptions = useCallback(async () => {
    if (referenceFields.length === 0) {
      setReferenceOptions({});
      return;
    }

    try {
      const entries = await Promise.all(
        referenceFields.map(async (field) => {
          const reference = field.reference!;
          const response = await apiRequest<unknown>(reference.endpoint, {
              query: { limit: 100, ...reference.query, ...field.referenceQuery?.(formValues) }
          });
          const rows = normalizeListResponse<Record<string, unknown>>(response).data;
          return [
            field.name,
            rows.map((row) => toReferenceOption(row, reference))
          ] as const;
        })
      );
      setReferenceOptions(Object.fromEntries(entries));
    } catch (currentError) {
      setError(getErrorMessage(currentError));
    }
  }, [formValues, referenceFields]);

  useEffect(() => {
    void loadReferenceOptions();
  }, [loadReferenceOptions]);

  const salesRepCustomerContext = formContext?.salesRep;

  useEffect(() => {
    if (!formOpen || !config.formContextEndpoint) {
      return;
    }

    let isActive = true;
    async function loadFormContext() {
      try {
        const context = await apiRequest<CustomerFormContext>(config.formContextEndpoint!);
        if (!isActive) {
          return;
        }
        setFormContext(context);
        if (context.salesRep) {
          const office = context.salesRep.office;
          setFormValues((current) => ({
            ...current,
            salesRepId: String(context.salesRep!.id)
          }));
          setReferenceOptions((current) => ({
            ...current,
            ...(office ? { officeId: [{ label: office.name, value: String(office.id) }] } : {}),
            salesRepId: [{ label: context.salesRep!.name, value: String(context.salesRep!.id) }]
          }));
          if (office) {
            setFormValues((current) => ({ ...current, officeId: String(office.id) }));
          }
        } else if (config.formContextSalesRepReference) {
          const salesReps = await apiRequest<unknown>(config.formContextSalesRepReference.endpoint, {
            query: { limit: 100, ...config.formContextSalesRepReference.query }
          });
          if (isActive) {
            setReferenceOptions((current) => ({
              ...current,
              salesRepId: toReferenceOptions(salesReps, config.formContextSalesRepReference!)
            }));
          }
        } else if (config.endpoint === "customers") {
          const offices = await apiRequest<unknown>("offices", { query: { limit: 100 } });
          if (isActive) {
            setReferenceOptions((current) => ({
              ...current,
              officeId: toReferenceOptions(offices, {
                endpoint: "offices",
                labelPath: "name",
                secondaryLabelPath: "code"
              })
            }));
          }
        }
      } catch (currentError) {
        if (isActive) {
          setFormError(getErrorMessage(currentError));
        }
      }
    }

    void loadFormContext();
    return () => {
      isActive = false;
    };
  }, [config.endpoint, config.formContextEndpoint, config.formContextSalesRepReference, formOpen]);

  useEffect(() => {
    if (!formOpen || !config.formContextEndpoint || config.endpoint !== "customers") {
      return;
    }

    const officeId = Number(formValues.officeId);
    if (!officeId) {
      return;
    }

    let isActive = true;
    async function loadOfficeOptions() {
      try {
        const [salesReps, routes] = await Promise.all([
          salesRepCustomerContext
            ? Promise.resolve(undefined)
            : apiRequest<unknown>("sales-reps", { query: { limit: 100, officeId } }),
          apiRequest<unknown>("routes", { query: { limit: 100, officeId } })
        ]);
        if (!isActive) {
          return;
        }

        setReferenceOptions((current) => ({
          ...current,
          ...(salesReps === undefined
            ? {}
            : { salesRepId: toReferenceOptions(salesReps, { endpoint: "sales-reps", labelPath: "name", secondaryLabelPath: "code" }) }),
          routeId: toReferenceOptions(routes, { endpoint: "routes", labelPath: "name", secondaryLabelPath: "code" })
        }));
      } catch (currentError) {
        if (isActive) {
          setFormError(getErrorMessage(currentError));
        }
      }
    }

    void loadOfficeOptions();
    return () => {
      isActive = false;
    };
  }, [config.formContextEndpoint, formOpen, formValues.officeId, salesRepCustomerContext]);

  const openCreate = () => {
    setEditingRecord(null);
    setFormContext(null);
    setFormValues(getInitialValues(config.fields ?? []));
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = async (record: T) => {
    setFormContext(null);
    setFormError(null);
    try {
      const savedRecord = config.detailEndpoint
        ? await apiRequest<T>(config.detailEndpoint(record))
        : record;
      setEditingRecord(savedRecord);
      setFormValues(getInitialValues(config.fields ?? [], savedRecord, referenceOptions));
      setFormOpen(true);
    } catch (currentError) {
      setFormError(getErrorMessage(currentError));
    }
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
        const { roleIds, ...updatePayload } = payload;
        await apiRequest(config.updateEndpoint(editingRecord), {
          body: updatePayload,
          method: "PATCH"
        });
        if (config.roleAssignmentEndpoint && Array.isArray(roleIds)) {
          await apiRequest(config.roleAssignmentEndpoint(editingRecord), {
            body: { roleIds },
            method: "PUT"
          });
        }
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
      await loadReferenceOptions();
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
      await loadReferenceOptions();
    } catch (currentError) {
      setError(getErrorMessage(currentError));
    }
  };

  const openAction = (record: T, action: ResourceAction<T>) => {
    setActionRecord(record);
    setActionConfig(action);
    setActionValues(getInitialValues(action.bodyFields ?? [], record));
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
      if (actionConfig.previewOnly) {
        setActionConfig(null);
        return;
      }
      await apiRequest(actionConfig.endpoint(actionRecord), {
        body: buildPayload(bodyFields, actionValues, "create"),
        method: actionConfig.method ?? "POST"
      });
      if (actionConfig.label === "Dispatch") {
        const confirmAction = config.actions?.find((action) => action.label === "Confirm");
        if (confirmAction) {
          setActionConfig(confirmAction);
          setActionValues(getInitialValues(confirmAction.bodyFields ?? [], actionRecord));
          return;
        }
      }
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
            <IconButton color="primary" onClick={() => void openEdit(record)} size="small">
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {config.actions
          ?.filter((action) => action.visible?.(record, user) ?? true)
          .map((action) => (
            <Button
              disabled={action.disabled?.(record, user) ?? false}
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
    [canDelete, canEdit, config.actions, user]
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
            {isDeliveryPage && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                {!user?.roles.includes("DELIVERY_PERSON") && <TextField label="Driver" onChange={(event) => { setPage(1); setDeliveryDriverId(event.target.value); }} select size="small" value={deliveryDriverId}><MenuItem value="">All drivers</MenuItem>{deliveryDrivers.map((driver) => <MenuItem key={driver.value} value={driver.value}>{driver.label}</MenuItem>)}</TextField>}
                <TextField label="Status" onChange={(event) => { setPage(1); setDeliveryStatus(event.target.value); }} select size="small" value={deliveryStatus}><MenuItem value="">Planned & Dispatched</MenuItem>{["PLANNED", "DISPATCHED", "DELIVERED"].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}</TextField>
              </Stack>
            )}
            <DataState error={error} loading={isLoading} />
            {!isLoading && !error && (
              <>
                <ResponsiveDataView
                  actions={canEdit || canDelete || config.actions?.length ? actionButtons : undefined}
                  columns={visibleColumns}
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
                disabled={Boolean(
                  salesRepCustomerContext &&
                  (field.name === "officeId" || field.name === "salesRepId")
                )}
                field={field}
                key={field.name}
                onChange={(value) =>
                  setFormValues((current) =>
                    field.name === "officeId"
                      ? { ...current, officeId: value, routeId: "", salesRepId: "" }
                      : field.name === "routeId"
                        ? { ...current, routeId: value, orderIds: [] }
                      : { ...current, [field.name]: value }
                  )
                }
                options={getFieldOptions(field, referenceOptions)}
                helperText={
                  salesRepCustomerContext && field.name === "officeId"
                    ? "Automatically set from your Sales Rep profile."
                    : salesRepCustomerContext && field.name === "salesRepId"
                      ? "Automatically set to your Sales Rep profile."
                      : undefined
                }
                values={formValues}
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
            {actionConfig?.bodyMessage && actionRecord && (
              <Typography>{actionConfig.bodyMessage(actionRecord)}</Typography>
            )}
            {(actionConfig?.bodyFields ?? []).map((field) => (
              <FormField
                field={field}
                key={field.name}
                onChange={(value) =>
                  setActionValues((current) => ({ ...current, [field.name]: value }))
                }
                options={getFieldOptions(field, referenceOptions)}
                values={actionValues}
                value={actionValues[field.name]}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          {actionConfig?.previewOnly ? (
            <Button onClick={() => setActionConfig(null)} variant="contained">OK</Button>
          ) : (
            <>
              <Button onClick={() => setActionConfig(null)}>Cancel</Button>
              <Button disabled={isSaving} onClick={() => void runAction()} variant="contained">Submit</Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function FormField({
  disabled,
  field,
  helperText,
  onChange,
  options,
  values,
  value
}: {
  disabled?: boolean;
  field: ResourceField;
  helperText?: string;
  onChange: (value: unknown) => void;
  options?: ReferenceOption[];
  values?: Record<string, unknown>;
  value: unknown;
}) {
  if (field.type === "multiReference") {
    const currentValues = Array.isArray(value) ? value.map(String) : [];
    return (
      <FormGroup>
        <Typography component="div" sx={{ mb: 0.5 }} variant="body2">
          {field.label}
        </Typography>
        {options?.map((option) => {
          const checked =
            currentValues.includes(option.value) ||
            Boolean(option.code && currentValues.includes(option.code));
          return (
            <FormControlLabel
              control={
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onChange={(event) => {
                    const next = new Set(
                      currentValues
                        .map((item) => options.find((candidate) => candidate.code === item)?.value ?? item)
                        .filter((item) => /^\d+$/.test(item))
                    );
                    if (event.target.checked) {
                      next.add(option.value);
                    } else {
                      next.delete(option.value);
                    }
                    onChange(Array.from(next).map(Number));
                  }}
                />
              }
              key={option.value}
              label={option.label}
            />
          );
        })}
      </FormGroup>
    );
  }

  if (field.type === "orderItems") {
    return (
      <OrderItemsField
        customerId={Number(values?.customerId || 0)}
        onChange={onChange}
        value={Array.isArray(value) ? (value as OrderItemValue[]) : []}
      />
    );
  }

  if (field.type === "deliveryItems") {
    return (
      <DeliveryConfirmationItemsField
        onChange={onChange}
        value={Array.isArray(value) ? (value as DeliveryConfirmationItemValue[]) : []}
      />
    );
  }
  if (field.type === "deliveryItemSummary") {
    return <Table size="small"><TableHead><TableRow><TableCell>Item</TableCell><TableCell>Qty</TableCell></TableRow></TableHead><TableBody>{(Array.isArray(value) ? value : []).map((item) => { const row = item as Record<string, unknown>; const product = row.product as Record<string, unknown> | undefined; return <TableRow key={String(row.id)}><TableCell>{product?.name ?? "Item description unavailable"}</TableCell><TableCell>{Number(row.orderedQuantity ?? 0)}</TableCell></TableRow>; })}</TableBody></Table>;
  }

  if (field.type === "deliveryPlanSummary") {
    return <DeliveryPlanSummary value={Array.isArray(value) ? value : []} />;
  }

  if (field.type === "checkbox") {
    return (
      <FormControlLabel
        control={
          <Switch
            checked={Boolean(value)}
            disabled={disabled}
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
        disabled={disabled}
        helperText={helperText ?? field.helperText}
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
      disabled={disabled}
      helperText={helperText ?? field.helperText}
      label={field.label}
      minRows={field.type === "json" ? 4 : undefined}
      multiline={field.type === "json"}
      onChange={(event) => onChange(event.target.value)}
      required={field.required}
      slotProps={
        field.type === "date" || field.type === "datetime"
          ? { inputLabel: { shrink: true } }
          : undefined
      }
      type={
        field.type === "number"
          ? "number"
          : field.type === "datetime"
            ? "datetime-local"
            : field.type === "date"
              ? "date"
              : "text"
      }
      value={value ?? ""}
    />
  );
}

function DeliveryConfirmationItemsField({
  onChange,
  value
}: {
  onChange: (value: DeliveryConfirmationItemValue[]) => void;
  value: DeliveryConfirmationItemValue[];
}) {
  const updateItem = (deliveryItemId: number, changes: Partial<DeliveryConfirmationItemValue>) => {
    onChange(value.map((item) => item.deliveryItemId === deliveryItemId ? { ...item, ...changes } : item));
  };

  return (
    <Stack spacing={1}>
      <Typography fontWeight={600}>Delivery items</Typography>
      <Typography color="text.secondary" variant="body2">
        Update delivered or rejected quantities as needed. Their total cannot exceed the ordered quantity.
      </Typography>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow><TableCell>Item</TableCell><TableCell>Ordered</TableCell><TableCell>Delivered</TableCell><TableCell>Rejected</TableCell><TableCell>Notes</TableCell></TableRow></TableHead>
          <TableBody>
            {value.map((item) => (
              <TableRow key={item.deliveryItemId}>
                <TableCell>{item.productName}</TableCell>
                <TableCell>{item.orderedQuantity}</TableCell>
                <TableCell><TextField inputProps={{ min: 0 }} onChange={(event) => updateItem(item.deliveryItemId, { deliveredQuantity: Number(event.target.value) })} size="small" type="number" value={item.deliveredQuantity} /></TableCell>
                <TableCell><TextField inputProps={{ min: 0 }} onChange={(event) => updateItem(item.deliveryItemId, { rejectedQuantity: Number(event.target.value) })} size="small" type="number" value={item.rejectedQuantity} /></TableCell>
                <TableCell><TextField onChange={(event) => updateItem(item.deliveryItemId, { notes: event.target.value })} size="small" value={item.notes ?? ""} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Stack>
  );
}

function DeliveryPlanSummary({ value }: { value: unknown[] }) {
  const [rows, setRows] = useState<{ itemName: string; quantity: number; freeQuantity: number; totalQuantity: number }[]>([]);
  useEffect(() => {
    const ids = value.map((item) => typeof item === "number" ? item : Number((item as Record<string, unknown>).orderId)).filter(Number.isInteger);
    if (ids.length === 0) { setRows([]); return; }
    void apiRequest<{ itemName: string; quantity: number; freeQuantity: number; totalQuantity: number }[]>("deliveries/plans/loading-summary", { query: { orderIds: ids.join(",") } }).then(setRows).catch(() => setRows([]));
  }, [value]);
  if (rows.length === 0) return <Typography color="text.secondary">Select orders to see the loading summary.</Typography>;
  return <Table size="small"><TableHead><TableRow><TableCell>Item name</TableCell><TableCell>Qty</TableCell><TableCell>Free issue</TableCell><TableCell>Total qty</TableCell></TableRow></TableHead><TableBody>{rows.map((row, index) => <TableRow key={`${row.itemName}-${index}`}><TableCell>{row.itemName || "Item description unavailable"}</TableCell><TableCell>{row.quantity}</TableCell><TableCell>{row.freeQuantity ?? 0}</TableCell><TableCell>{row.totalQuantity}</TableCell></TableRow>)}</TableBody></Table>;
}

function OrderItemsField({
  customerId,
  onChange,
  value
}: {
  customerId: number;
  onChange: (value: OrderItemValue[]) => void;
  value: OrderItemValue[];
}) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [products, setProducts] = useState<ReferenceOption[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    async function loadProducts() {
      const response = await apiRequest<unknown>("orders/catalogue-products", {
        query: { limit: 100 }
      });
      const rows = normalizeListResponse<Record<string, unknown>>(response).data;
      if (isActive) {
        setProducts(
          rows.map((row) => ({
            code: typeof row.code === "string" ? row.code : undefined,
            label: [row.code, row.name].filter(Boolean).join(" - "),
            value: String(row.id)
          }))
        );
      }
    }

    void loadProducts().catch((currentError) => setError(getErrorMessage(currentError)));

    return () => {
      isActive = false;
    };
  }, []);

  const addItem = async () => {
    const selectedProductId = Number(productId);
    const selectedQuantity = Number(quantity);
    if (!selectedProductId || selectedQuantity <= 0) {
      setError("Select an item and enter a quantity greater than 0.");
      return;
    }
    if (value.some((item) => item.productId === selectedProductId)) {
      setError("This item is already in the order.");
      return;
    }
    const next = await quoteItems([
      ...value,
      { productId: selectedProductId, quantity: selectedQuantity }
    ], customerId, products);
    onChange(next);
    setProductId("");
    setQuantity("1");
    setError(null);
  };

  const updateQuantity = async (targetProductId: number, nextQuantity: number) => {
    if (nextQuantity <= 0) {
      setError("Quantity must be greater than 0.");
      return;
    }
    onChange(await quoteItems(
      value.map((item) =>
        item.productId === targetProductId ? { ...item, quantity: nextQuantity } : item
      ),
      customerId,
      products
    ));
    setError(null);
  };

  const removeItem = (targetProductId: number) => {
    onChange(value.filter((item) => item.productId !== targetProductId));
  };

  const subtotal = value.reduce((sum, item) => sum + item.quantity * (item.unitPrice ?? 0), 0);
  const discount = value.reduce((sum, item) => sum + (item.discountAmount ?? 0), 0);
  const total = value.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0);

  return (
    <Stack spacing={1.5}>
      <Typography fontWeight={600}>Items</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField
          fullWidth
          label="Item"
          onChange={(event) => setProductId(event.target.value)}
          select
          value={productId}
        >
          {products.map((product) => (
            <MenuItem key={product.value} value={product.value}>
              {product.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          inputProps={{ min: 1 }}
          label="Qty"
          onChange={(event) => setQuantity(event.target.value)}
          sx={{ width: { sm: 140 } }}
          type="number"
          value={quantity}
        />
        <Button onClick={() => void addItem()} sx={{ minHeight: 48 }} variant="contained">
          Add
        </Button>
      </Stack>

      {isDesktop ? (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Item Name</TableCell>
              <TableCell>Qty</TableCell>
              <TableCell>Retail Price</TableCell>
              <TableCell>Discount</TableCell>
              <TableCell>Net Value</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {value.map((item) => (
              <TableRow key={item.productId}>
                <TableCell>{item.productName}</TableCell>
                <TableCell>
                  <TextField
                    inputProps={{ min: 1 }}
                    onChange={(event) => void updateQuantity(item.productId, Number(event.target.value))}
                    size="small"
                    type="number"
                    value={item.quantity}
                  />
                </TableCell>
                <TableCell>{formatMoney(item.unitPrice)}</TableCell>
                <TableCell>{formatMoney(item.discountAmount)}</TableCell>
                <TableCell>{formatMoney(item.lineTotal)}</TableCell>
                <TableCell>
                  <Button color="error" onClick={() => removeItem(item.productId)} size="small">
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Stack spacing={1}>
          {value.map((item) => (
            <Card key={item.productId} variant="outlined">
              <CardContent>
                <Stack spacing={1}>
                  <Typography fontWeight={600}>{item.productName}</Typography>
                  <TextField
                    inputProps={{ min: 1 }}
                    label="Qty"
                    onChange={(event) => void updateQuantity(item.productId, Number(event.target.value))}
                    type="number"
                    value={item.quantity}
                  />
                  <Typography variant="body2">Retail Price: {formatMoney(item.unitPrice)}</Typography>
                  <Typography variant="body2">Discount: {formatMoney(item.discountAmount)}</Typography>
                  <Typography variant="body2">Net Value: {formatMoney(item.lineTotal)}</Typography>
                  <Button color="error" onClick={() => removeItem(item.productId)}>
                    Remove
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Stack alignItems="flex-end" spacing={0.5}>
        <Typography variant="body2">Subtotal: {formatMoney(subtotal)}</Typography>
        <Typography variant="body2">Discount: {formatMoney(discount)}</Typography>
        <Typography fontWeight={700}>Total: {formatMoney(total)}</Typography>
      </Stack>
    </Stack>
  );
}

async function quoteItems(
  items: Pick<OrderItemValue, "productId" | "quantity">[],
  customerId: number,
  products: ReferenceOption[]
) {
  if (!customerId) {
    throw new Error("Select a customer before adding items.");
  }

  const quote = await apiRequest<{
    lines: {
      discountAmount: number;
      freeQuantity?: number;
      lineTotal: number;
      productId: number;
      unitPrice: number;
    }[];
    items: {
      discountAmount: number;
      freeQuantity?: number;
      lineTotal: number;
      productId: number;
      unitPrice: number;
    }[];
  }>("orders/quote-items", {
    body: {
      customerId,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity
      }))
    },
    method: "POST"
  });

  return items.map((item) => {
    const quoteLine = quote.items.find((line) => line.productId === item.productId);
    return {
      discountAmount: quoteLine?.discountAmount ?? 0,
      freeQuantity: quoteLine?.freeQuantity ?? 0,
      lineTotal: quoteLine?.lineTotal ?? 0,
      productId: item.productId,
      productName: products.find((product) => product.value === String(item.productId))?.label ?? String(item.productId),
      quantity: item.quantity,
      unitPrice: quoteLine?.unitPrice ?? 0
    };
  });
}

function formatMoney(value?: number) {
  return Number(value ?? 0).toFixed(2);
}

function getInitialValues(
  fields: ResourceField[],
  record?: Record<string, unknown>,
  referenceOptions: Record<string, ReferenceOption[]> = {}
) {
  return fields.reduce<Record<string, unknown>>((result, field) => {
    const value = record
      ? getValueByPath(record, field.name)
      : field.defaultValue === "now" && (field.type === "date" || field.type === "datetime")
        ? toLocalDateTimeValue(field.type)
        : undefined;
    if (field.type === "json") {
      result[field.name] = value === undefined ? "" : JSON.stringify(value, null, 2);
    } else if (field.type === "multiReference") {
      if (Array.isArray(value)) {
        result[field.name] = value;
      } else if (field.name === "roleIds" && Array.isArray(record?.roles)) {
        const options = referenceOptions[field.name] ?? [];
        result[field.name] = (record.roles as string[]).map(
          (roleCode) => options.find((option) => option.code === roleCode)?.value ?? roleCode
        );
      } else {
        result[field.name] = [];
      }
    } else if (field.type === "deliveryItems") {
      result[field.name] = Array.isArray(value)
        ? value.map((item) => {
            const row = item as Record<string, unknown>;
            const product = row.product as Record<string, unknown> | undefined;
            return {
              deliveredQuantity: Number(row.orderedQuantity ?? 0),
              deliveryItemId: Number(row.id),
              notes: "",
              orderedQuantity: Number(row.orderedQuantity ?? 0),
              productName: product
                ? [product.code, product.name].filter(Boolean).join(" - ")
                : String(row.productId ?? "Item"),
              rejectedQuantity: 0
            } satisfies DeliveryConfirmationItemValue;
          })
        : [];
    } else if (field.type === "orderItems") {
      result[field.name] = Array.isArray(value)
        ? value.map((item) => {
            const row = item as Record<string, unknown>;
            const product = row.product as Record<string, unknown> | undefined;
            return {
              discountAmount: Number(row.discountAmount ?? 0),
              freeQuantity: Number(row.freeQuantity ?? 0),
              lineTotal: Number(row.lineTotal ?? 0),
              productId: Number(row.productId),
              productName: product
                ? [product.code, product.name].filter(Boolean).join(" - ")
                : String(row.productId),
              quantity: Number(row.quantity ?? 0),
              unitPrice: Number(row.unitPrice ?? 0)
            };
          })
        : [];
    } else if (field.name === "routeId" && value === undefined && Array.isArray(record?.routeAssignments)) {
      const primaryRoute = (record.routeAssignments as Record<string, unknown>[])[0];
      result[field.name] = primaryRoute?.routeId ?? "";
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

function toLocalDateTimeValue(type: "date" | "datetime") {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  const local = new Date(now.getTime() - offset).toISOString();
  return type === "date" ? local.slice(0, 10) : local.slice(0, 16);
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
    if (field.reference && field.loadOptions !== false && !references.has(field.name)) {
      references.set(field.name, field);
    }
  });

  return Array.from(references.values());
}

function getFieldOptions(
  field: ResourceField,
  referenceOptions: Record<string, ReferenceOption[]>
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
    code: typeof row.code === "string" ? row.code : undefined,
    label: label || String(value),
    value: String(value)
  };
}

function toReferenceOptions(response: unknown, reference: ResourceReference) {
  return normalizeListResponse<Record<string, unknown>>(response).data.map((row) =>
    toReferenceOption(row, reference)
  );
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
    if (field.type === "deliveryItemSummary" || field.type === "deliveryPlanSummary") {
      return result;
    } else if (field.type === "number") {
      result[field.name] = Number(value);
    } else if (field.type === "checkbox") {
      result[field.name] = Boolean(value);
    } else if (field.type === "json") {
      result[field.name] = typeof value === "string" ? JSON.parse(value) : value;
    } else if (field.type === "multiReference") {
      const values = Array.isArray(value) ? value : [];
      const numericValues = values.map(Number).filter((item) => Number.isInteger(item));
      if (numericValues.length > 0) {
        result[field.name] = numericValues;
      }
    } else if (field.type === "deliveryItems") {
      result[field.name] = Array.isArray(value)
        ? value.map((item) => ({
            deliveredQuantity: Number((item as DeliveryConfirmationItemValue).deliveredQuantity),
            deliveryItemId: Number((item as DeliveryConfirmationItemValue).deliveryItemId),
            notes: (item as DeliveryConfirmationItemValue).notes || undefined,
            rejectedQuantity: Number((item as DeliveryConfirmationItemValue).rejectedQuantity)
          }))
        : [];
    } else if (field.type === "orderItems") {
      result[field.name] = Array.isArray(value)
        ? value.map((item) => ({
            productId: Number((item as OrderItemValue).productId),
            quantity: Number((item as OrderItemValue).quantity)
          }))
        : [];
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
