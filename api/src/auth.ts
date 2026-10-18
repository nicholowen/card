import { betterAuth, type BetterAuthOptions } from "better-auth";
import { emailOTP } from "better-auth/plugins/email-otp";
import { expo } from "@better-auth/expo";
import type { Pool } from "pg";
import type { EmailSender, IdentityTokenVerifier, SocialProviderId } from "./ports.ts";

export const ACCOUNT_ROLES = ["member", "admin"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

/** The mobile app's deep-link scheme (mobile/app.json). A dev build sends origins like card://192.168.1.20:8081. */
export const APP_ORIGIN = "card://";
/** Expo Go sends exp://… instead of the app's scheme. Trusted only in development. */
export const EXPO_GO_ORIGIN = "exp://";
/** Apple posts the browser sign-in result back to the API from this origin. */
const APPLE_ORIGIN = "https://appleid.apple.com";
/** Native Sign in with Apple inside Expo Go issues tokens for Expo Go's bundle ID, not ours. */
const EXPO_GO_BUNDLE_IDENTIFIER = "host.exp.Exponent";

/** Credentials for each social provider. A provider left out isn't offered. */
export interface SocialProvidersConfig {
  google?: {
    /** The "Web application" OAuth client used by the browser sign-in. */
    clientId: string;
    clientSecret: string;
  };
  apple?: {
    /** The Services ID used by the browser sign-in (Android). */
    serviceId: string;
    /** The signed JWT Apple expects as a client secret. It expires after at most six months. */
    clientSecret: string;
    /** The iOS app's bundle ID: native Sign in with Apple issues tokens for it. */
    appBundleIdentifier: string;
  };
}

export interface AuthConfig {
  pool: Pool;
  email: EmailSender;
  secret: string;
  baseURL: string;
  /** Extra origins to trust (e.g. the web surface). The app's own scheme is always trusted. */
  trustedOrigins: string[];
  /** Development also trusts Expo Go. */
  development: boolean;
  socialProviders: SocialProvidersConfig;
  /** Unset in production, where Better Auth checks ID tokens against Google's and Apple's keys. */
  identityTokens?: IdentityTokenVerifier;
}

export function authOptions(config: AuthConfig) {
  const { google, apple } = config.socialProviders;
  return {
    database: config.pool,
    secret: config.secret,
    baseURL: config.baseURL,
    basePath: "/api/auth",
    trustedOrigins: [
      APP_ORIGIN,
      ...(config.development ? [EXPO_GO_ORIGIN] : []),
      ...(apple ? [APPLE_ORIGIN] : []),
      ...config.trustedOrigins,
    ],
    // A Google or Apple sign-in joins an existing Account with the same email only
    // when the provider says it verified that email (Better Auth's default rule),
    // so nobody can take over an email-code Account with an unverified address.
    socialProviders: {
      ...(google && {
        google: {
          clientId: google.clientId,
          clientSecret: google.clientSecret,
          ...verifiedBy(config.identityTokens, "google"),
        },
      }),
      ...(apple && {
        apple: {
          clientId: apple.serviceId,
          clientSecret: apple.clientSecret,
          appBundleIdentifier: apple.appBundleIdentifier,
          audience: [
            apple.appBundleIdentifier,
            ...(config.development ? [EXPO_GO_BUNDLE_IDENTIFIER] : []),
          ],
          ...verifiedBy(config.identityTokens, "apple"),
        },
      }),
    },
    // Better Auth skips origin checks when NODE_ENV=test. Keep them on so the
    // test suite exercises the same checks the phone hits.
    advanced: { disableOriginCheck: false },
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

/** Provider options that hand the ID-token signature check to our own verifier. */
function verifiedBy(verifier: IdentityTokenVerifier | undefined, provider: SocialProviderId) {
  if (!verifier) return {};
  return {
    verifyIdToken: (token: string, nonce?: string) => verifier.verify(provider, token, nonce),
  };
}

export function createAuth(config: AuthConfig) {
  return betterAuth(authOptions(config));
}

export type Auth = ReturnType<typeof createAuth>;
