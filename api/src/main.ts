import { serve } from "@hono/node-server";
import pg from "pg";
import { anthropicLlmProvider } from "./adapters/anthropic.ts";
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
  if (!config.llm) console.warn("ANTHROPIC_API_KEY isn't set: cloud Parse is off, and the app parses cards on the device.");
  const llm = config.llm ? anthropicLlmProvider(config.llm) : unconfiguredLlmProvider;

  const app = createApp({
    pool,
    ports: { email: consoleEmailSender, llm, storage: unconfiguredObjectStorage },
    authSecret: config.authSecret,
    baseURL: config.baseURL,
    trustedOrigins: config.trustedOrigins,
    development: config.development,
    socialProviders: config.socialProviders,
  });
  serve({ fetch: app.fetch, port: config.port, hostname: "0.0.0.0" }, (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  });
}
