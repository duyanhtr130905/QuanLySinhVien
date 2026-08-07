export default () => ({
  app: {
    port: Number(process.env.PORT ?? 3002),
    corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? 'http://localhost:3001')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },
});
