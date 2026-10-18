function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export function loadConfig() {
  return {
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: required("DATABASE_URL"),
    authSecret: required("BETTER_AUTH_SECRET"),
    baseURL: required("BETTER_AUTH_URL"),
    trustedOrigins: (process.env.TRUSTED_ORIGINS ?? "card://")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}
