import { Alert, Box, CircularProgress, Typography } from "@mui/material";

type DataStateProps = {
  empty?: boolean;
  error?: string | null;
  loading?: boolean;
};

export function DataState({ empty, error, loading }: DataStateProps) {
  if (loading) {
    return (
      <Box sx={{ display: "grid", minHeight: 180, placeItems: "center" }}>
        <CircularProgress size={30} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (empty) {
    return (
      <Box
        sx={{
          border: "1px dashed",
          borderColor: "divider",
          borderRadius: 2,
          p: 3,
          textAlign: "center"
        }}
      >
        <Typography color="text.secondary">No records found.</Typography>
      </Box>
    );
  }

  return null;
}
