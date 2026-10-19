import { DEFAULT_ANTHROPIC_MODEL } from "./adapters/anthropic.ts";
import type { SocialProvidersConfig } from "./auth.ts";
import { DEFAULT_VISION_FALLBACK, type VisionFallbackThresholds } from "./parse.ts";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

/**
 * A provider is offered only when all of its settings are present, so the API
 * runs without Google or Apple credentials (email codes still work).
 */
function loadSocialProviders(): SocialProvidersConfig {
  const googleClientId = optional("GOOGLE_CLIENT_ID");
  const googleClientSecret = optional("GOOGLE_CLIENT_SECRET");
  const appleServiceId = optional("APPLE_SERVICE_ID");
  const appleClientSecret = optional("APPLE_CLIENT_SECRET");
  const appleBundleId = optional("APPLE_APP_BUNDLE_IDENTIFIER");

  return {
    ...(googleClientId && googleClientSecret && {
      google: { clientId: googleClientId, clientSecret: googleClientSecret },
    }),
    ...(appleServiceId && appleClientSecret && appleBundleId && {
      apple: { serviceId: appleServiceId, clientSecret: appleClientSecret, appBundleIdentifier: appleBundleId },
    }),
  };
}

export function loadConfig() {
  return {
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: required("DATABASE_URL"),
    authSecret: required("BETTER_AUTH_SECRET"),
    baseURL: required("BETTER_AUTH_URL"),
    development: process.env.NODE_ENV !== "production",
    trustedOrigins: (process.env.TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    socialProviders: loadSocialProviders(),
    llm: loadLlm(),
    visionFallback: loadVisionFallback(),
  };
}

function optionalNumber(name: string, { min, max }: { min: number; max: number }): number | undefined {
  const value = optional(name);
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`Environment variable ${name} must be a number from ${min} to ${max}, not "${value}"`);
  }
  return number;
}

/** When a text Parse asks for the card's image instead (ADR 0004). Unset settings keep the defaults. */
export function loadVisionFallback(): VisionFallbackThresholds {
  return {
    belowConfidence: optionalNumber("PARSE_VISION_BELOW_CONFIDENCE", { min: 0, max: 1 }) ?? DEFAULT_VISION_FALLBACK.belowConfidence,
    belowTextLength: optionalNumber("PARSE_VISION_BELOW_TEXT_LENGTH", { min: 0, max: 4000 }) ?? DEFAULT_VISION_FALLBACK.belowTextLength,
  };
}

/** The Claude API settings for cloud Parse. Without a key, cloud Parse is off and the app parses on the device. */
export function loadLlm() {
  const apiKey = optional("ANTHROPIC_API_KEY");
  if (!apiKey) return undefined;
  return {
    apiKey,
    model: optional("ANTHROPIC_MODEL") ?? DEFAULT_ANTHROPIC_MODEL,
    workspaceId: optional("ANTHROPIC_WORKSPACE_ID"),
  };
}
