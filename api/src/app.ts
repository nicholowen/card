import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { Pool } from "pg";
import { createAuth, type SocialProvidersConfig } from "./auth.ts";
import {
  createParser,
  isCardPhotoType,
  MAX_PARSE_IMAGE_BYTES,
  ParseFailed,
  type VisionFallbackThresholds,
} from "./parse.ts";
import type { Ports } from "./ports.ts";

export interface AppConfig {
  pool: Pool;
  ports: Ports;
  authSecret: string;
  baseURL: string;
  trustedOrigins: string[];
  development: boolean;
  socialProviders: SocialProvidersConfig;
  /** When a text Parse asks for the card's image instead. Defaults to DEFAULT_VISION_FALLBACK. */
  visionFallback?: VisionFallbackThresholds;
}

/**
 * The most recognised text a Parse accepts. Both sides of a busy business card
 * come to well under a thousand characters; anything far longer isn't a card,
 * and the LLM bills by length.
 */
const MAX_PARSE_TEXT_LENGTH = 4000;

export function createApp(config: AppConfig) {
  const auth = createAuth({
    pool: config.pool,
    email: config.ports.email,
    secret: config.authSecret,
    baseURL: config.baseURL,
    trustedOrigins: config.trustedOrigins,
    development: config.development,
    socialProviders: config.socialProviders,
    identityTokens: config.ports.identityTokens,
  });

  const app = new Hono<{ Variables: { accountId: string } }>();

  const parser = createParser({ llm: config.ports.llm, pool: config.pool, visionFallback: config.visionFallback });

  /** The signed-in Account's id, or null. Better Auth calls the Account a "user". */
  async function accountIdOf(request: Request): Promise<string | null> {
    const session = await auth.api.getSession({ headers: request.headers });
    return session?.user.id ?? null;
  }

  app.get("/health", (c) => c.json({ ok: true }));
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  app.post("/api/parse", async (c) => {
    const accountId = await accountIdOf(c.req.raw);
    if (!accountId) return c.json({ error: "not-signed-in" }, 401);
    const body = await c.req.json<{ text?: unknown }>().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) return c.json({ error: "no-text" }, 400);
    if (text.length > MAX_PARSE_TEXT_LENGTH) return c.json({ error: "text-too-long" }, 400);
    try {
      return c.json(await parser.parseText(accountId, text));
    } catch (error) {
      if (!(error instanceof ParseFailed)) throw error;
      // The card's text stays out of the log; only the provider's reason goes in.
      console.error("[parse] LLM call failed:", error.cause);
      return c.json({ error: "parse-failed" }, 502);
    }
  });

  // The vision fallback: the app sends a card's photo only after /api/parse
  // answers `imageWanted` (ADR 0004), as a multipart form with the photo in `image`.
  app.post(
    "/api/parse/image",
    async (c, next) => {
      const accountId = await accountIdOf(c.req.raw);
      if (!accountId) return c.json({ error: "not-signed-in" }, 401);
      c.set("accountId", accountId);
      await next();
    },
    // Refuses an oversized upload as it arrives, before it is held in memory.
    // The allowance over the photo's own limit is for the form's own framing.
    bodyLimit({
      maxSize: MAX_PARSE_IMAGE_BYTES + 64 * 1024,
      onError: (c) => c.json({ error: "image-too-large" }, 413),
    }),
    async (c) => {
      const form = await c.req.formData().catch(() => null);
      const image = form?.get("image");
      if (!(image instanceof File) || image.size === 0) return c.json({ error: "no-image" }, 400);
      if (image.size > MAX_PARSE_IMAGE_BYTES) return c.json({ error: "image-too-large" }, 413);
      const mimeType = image.type;
      if (!isCardPhotoType(mimeType)) return c.json({ error: "unsupported-image-type" }, 400);
      const bytes = new Uint8Array(await image.arrayBuffer());
      try {
        return c.json(await parser.parseImage(c.get("accountId"), { image: bytes, mimeType }));
      } catch (error) {
        if (!(error instanceof ParseFailed)) throw error;
        // The photo stays out of the log; only the provider's reason goes in.
        console.error("[parse] LLM vision call failed:", error.cause);
        return c.json({ error: "parse-failed" }, 502);
      }
    },
  );

  app.get("/api/parse/usage", async (c) => {
    const accountId = await accountIdOf(c.req.raw);
    if (!accountId) return c.json({ error: "not-signed-in" }, 401);
    return c.json(await parser.usage(accountId));
  });

  return app;
}
