import { Hono } from "hono";
import type { Pool } from "pg";
import { createAuth } from "./auth.ts";
import type { Ports } from "./ports.ts";

export interface AppConfig {
  pool: Pool;
  ports: Ports;
  authSecret: string;
  baseURL: string;
  trustedOrigins: string[];
  development: boolean;
}

export function createApp(config: AppConfig) {
  const auth = createAuth({
    pool: config.pool,
    email: config.ports.email,
    secret: config.authSecret,
    baseURL: config.baseURL,
    trustedOrigins: config.trustedOrigins,
    development: config.development,
  });

  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  return app;
}
