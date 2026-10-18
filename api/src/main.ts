import { serve } from "@hono/node-server";
import pg from "pg";
import { consoleEmailSender, unconfiguredLlmProvider, unconfiguredObjectStorage } from "./adapters/dev.ts";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { migrate } from "./migrate.ts";

const config = loadConfig();
const pool = new pg.Pool({ connectionString: config.databaseUrl });

if (process.argv.includes("--migrate-only")) {
  await migrate(pool);
  await pool.end();
  console.log("Migrations applied.");
} else {
  const app = createApp({
    pool,
    ports: { email: consoleEmailSender, llm: unconfiguredLlmProvider, storage: unconfiguredObjectStorage },
    authSecret: config.authSecret,
    baseURL: config.baseURL,
    trustedOrigins: config.trustedOrigins,
  });
  serve({ fetch: app.fetch, port: config.port, hostname: "0.0.0.0" }, (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  });
}
