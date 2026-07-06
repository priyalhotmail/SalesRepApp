import { Box, Stack, Typography } from "@mui/material";
import { ReactNode } from "react";

type PageHeaderProps = {
  actions?: ReactNode;
  subtitle?: string;
  title: string;
};

export function PageHeader({ actions, subtitle, title }: PageHeaderProps) {
  return (
    <Stack
      alignItems={{ xs: "stretch", sm: "center" }}
      direction={{ xs: "column", sm: "row" }}
      justifyContent="space-between"
      spacing={2}
    >
      <Box>
        <Typography component="h2" fontWeight={700} variant="h5">
          {title}
        </Typography>
        {subtitle && (
          <Typography color="text.secondary" variant="body2">
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions}
    </Stack>
  );
}
