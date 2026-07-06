export const configuration = () => ({
  databaseUrl: process.env.DATABASE_URL,
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  jwt: {
    expiresIn: process.env.JWT_EXPIRES_IN ?? "1d",
    secret: process.env.JWT_SECRET
  },
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000)
});

