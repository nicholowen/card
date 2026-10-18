import { betterAuth, type BetterAuthOptions } from "better-auth";
import { emailOTP } from "better-auth/plugins/email-otp";
import { expo } from "@better-auth/expo";
import type { Pool } from "pg";
import type { EmailSender } from "./ports.ts";

export const ACCOUNT_ROLES = ["member", "admin"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export interface AuthConfig {
  pool: Pool;
  email: EmailSender;
  secret: string;
  baseURL: string;
  trustedOrigins: string[];
}

export function authOptions(config: AuthConfig) {
  return {
    database: config.pool,
    secret: config.secret,
    baseURL: config.baseURL,
    basePath: "/api/auth",
    trustedOrigins: config.trustedOrigins,
    // Better Auth's "user" is our Account (CONTEXT.md). Its own "account" table
    // holds sign-in methods, so it is renamed to avoid clashing with the glossary.
    // Foreign keys use account_id so every row belongs to one Account (ADR 0003).
    user: {
      modelName: "account",
      additionalFields: {
        role: {
          type: [...ACCOUNT_ROLES],
          required: true,
          defaultValue: "member",
          input: false,
        },
      },
    },
    account: { modelName: "auth_credential", fields: { userId: "account_id" } },
    session: { modelName: "auth_session", fields: { userId: "account_id" } },
    verification: { modelName: "auth_verification" },
    plugins: [
      expo(),
      emailOTP({
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp, type }) {
          await config.email.sendOneTimeCode({ to: email, code: otp, purpose: type });
        },
      }),
    ],
  } satisfies BetterAuthOptions;
}

export function createAuth(config: AuthConfig) {
  return betterAuth(authOptions(config));
}

export type Auth = ReturnType<typeof createAuth>;
