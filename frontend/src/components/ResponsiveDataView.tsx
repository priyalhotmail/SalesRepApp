import {
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme
} from "@mui/material";
import { ReactNode } from "react";
import { formatDisplayValue, getValueByPath } from "../utils/object";

export type DataColumn<T> = {
  label: string;
  path?: string;
  render?: (record: T) => ReactNode;
};

type ResponsiveDataViewProps<T> = {
  actions?: (record: T) => ReactNode;
  columns: DataColumn<T>[];
  getRowId: (record: T) => string | number;
  records: T[];
};

export function ResponsiveDataView<T>({
  actions,
  columns,
  getRowId,
  records
}: ResponsiveDataViewProps<T>) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  if (!isDesktop) {
    return (
      <Stack spacing={1.5}>
        {records.map((record) => (
          <Card key={getRowId(record)} variant="outlined">
            <CardContent>
              <Stack spacing={1}>
                {columns.map((column) => (
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    key={column.label}
                    spacing={2}
                  >
                    <Typography color="text.secondary" variant="body2">
                      {column.label}
                    </Typography>
                    <Typography
                      sx={{ maxWidth: "58%", overflowWrap: "anywhere", textAlign: "right" }}
                      variant="body2"
                    >
                      {renderCell(record, column)}
                    </Typography>
                  </Stack>
                ))}
                {actions && <Stack direction="row" flexWrap="wrap" gap={1}>{actions(record)}</Stack>}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    );
  }

  return (
    <Table size="small" sx={{ tableLayout: "fixed" }}>
      <TableHead>
        <TableRow>
          {columns.map((column) => (
            <TableCell key={column.label}>{column.label}</TableCell>
          ))}
          {actions && <TableCell width={180}>Actions</TableCell>}
        </TableRow>
      </TableHead>
      <TableBody>
        {records.map((record) => (
          <TableRow hover key={getRowId(record)}>
            {columns.map((column) => (
              <TableCell key={column.label} sx={{ overflowWrap: "anywhere" }}>
                {renderCell(record, column)}
              </TableCell>
            ))}
            {actions && <TableCell>{actions(record)}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function renderCell<T>(record: T, column: DataColumn<T>) {
  if (column.render) {
    return column.render(record);
  }
  const value = column.path ? getValueByPath(record, column.path) : undefined;
  if (typeof value === "string" && isStatusLike(value)) {
    return <Chip label={value} size="small" variant="outlined" />;
  }
  return formatDisplayValue(value);
}

function isStatusLike(value: string) {
  return /^[A-Z_]{3,}$/.test(value) && value.length <= 24;
}
