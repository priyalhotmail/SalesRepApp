import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@sales.local");
  const [password, setPassword] = useState("Admin@12345");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate replace to="/" />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ py: { xs: 4, sm: 8 } }}>
      <Stack spacing={3}>
        <Box>
          <Typography color="primary" fontWeight={800} variant="h4">
            Sales System
          </Typography>
          <Typography color="text.secondary">
            Sign in to manage sales, delivery, inventory and collections.
          </Typography>
        </Box>

        <Card variant="outlined">
          <CardContent>
            <Stack component="form" onSubmit={handleSubmit} spacing={2}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                autoComplete="email"
                fullWidth
                label="Email"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
              <TextField
                autoComplete="current-password"
                fullWidth
                label="Password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
              <Button
                disabled={isSubmitting}
                fullWidth
                size="large"
                type="submit"
                variant="contained"
              >
                Sign in
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
