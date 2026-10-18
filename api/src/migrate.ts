import { getMigrations } from "better-auth/db/migration";
import type { Pool } from "pg";
import { ACCOUNT_ROLES, authOptions } from "./auth.ts";

/**
 * Brings the database schema (the one on the pool's search_path) up to date.
 * For now that is Better Auth's tables plus constraints it can't express;
 * app tables join here as they arrive.
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

  // Better Auth applies the role default in app code only. Enforce it in the
  // database too, so rows written outside Better Auth (e.g. promoting an admin
  // by hand) can't end up with a missing or unknown role.
  const allowedRoles = ACCOUNT_ROLES.map((role) => `'${role}'`).join(", ");
  await pool.query(`
    ALTER TABLE account ALTER COLUMN role SET DEFAULT 'member';
    ALTER TABLE account DROP CONSTRAINT IF EXISTS account_role_check;
    ALTER TABLE account ADD CONSTRAINT account_role_check CHECK (role IN (${allowedRoles}));
  `);
}
