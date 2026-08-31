import { Alert, Box } from "@mui/material";

export function AccessDenied() {
  return (
    <Box sx={{ maxWidth: 680 }}>
      <Alert severity="warning">Access denied. You do not have permission to view this page.</Alert>
    </Box>
  );
}
