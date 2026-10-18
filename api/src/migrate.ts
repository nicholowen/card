import { getMigrations } from "better-auth/db/migration";
import type { Pool } from "pg";
import { authOptions } from "./auth.ts";

/**
 * Brings the database schema (the one on the pool's search_path) up to date.
 * For now that is only Better Auth's tables; app tables join here as they arrive.
 */
export async function migrate(pool: Pool): Promise<void> {
  const options = authOptions({
    pool,
    email: { sendOneTimeCode: async () => {} },
    secret: "migration-only-secret-not-used-for-signing",
    baseURL: "http://localhost",
    trustedOrigins: [],
  });
  const { runMigrations } = await getMigrations(options);
  await runMigrations();
}
