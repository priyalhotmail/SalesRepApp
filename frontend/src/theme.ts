import { createTheme } from "@mui/material";

export const theme = createTheme({
  palette: {
    background: {
      default: "#f8fafc"
    },
    primary: {
      main: "#0f766e"
    },
    secondary: {
      main: "#f59e0b"
    }
  },
  shape: {
    borderRadius: 8
  },
  typography: {
    fontFamily: [
      "Roboto",
      "Arial",
      "sans-serif"
    ].join(",")
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8
        }
      }
    }
  }
});

