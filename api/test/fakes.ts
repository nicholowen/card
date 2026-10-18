import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type {
  EmailSender,
  IdentityTokenVerifier,
  LlmProvider,
  ObjectStorage,
  OneTimeCodePurpose,
  ParsedFields,
  SocialProviderId,
} from "../src/ports.ts";

export class FakeEmailSender implements EmailSender {
  readonly sent: { to: string; code: string; purpose: OneTimeCodePurpose }[] = [];

  async sendOneTimeCode(message: { to: string; code: string; purpose: OneTimeCodePurpose }) {
    this.sent.push(message);
  }

  /** The most recent code emailed to this address. */
  lastCodeFor(to: string): string {
    const message = this.sent.findLast((m) => m.to === to.toLowerCase());
    if (!message) throw new Error(`No code was emailed to ${to}`);
    return message.code;
  }
}

export class FakeLlmProvider implements LlmProvider {
  textResponse: ParsedFields = {};
  imageResponse: ParsedFields = {};
  readonly calls: ({ kind: "text"; text: string } | { kind: "image"; mimeType: string })[] = [];

  async parseCardText({ text }: { text: string }) {
    this.calls.push({ kind: "text", text });
    return this.textResponse;
  }

  async parseCardImage({ mimeType }: { image: Uint8Array; mimeType: string }) {
    this.calls.push({ kind: "image", mimeType });
    return this.imageResponse;
  }
}

export class InMemoryObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, { body: Uint8Array; contentType: string }>();

  async put(key: string, body: Uint8Array, contentType: string) {
    this.objects.set(key, { body, contentType });
  }

  async get(key: string) {
    return this.objects.get(key) ?? null;
  }

  async deletePrefix(prefix: string) {
    for (const key of [...this.objects.keys()]) {
      if (key.startsWith(prefix)) this.objects.delete(key);
    }
  }
}

/** A person as Google or Apple would describe them in an ID token. */
export interface FakeIdentity {
  /** The provider's stable ID for the person (the token's `sub`). */
  subject: string;
  email?: string;
  emailVerified: boolean;
  /** Google puts the name in the token. Apple never does: the app passes it alongside. */
  name?: string;
}

const ISSUERS: Record<SocialProviderId, string> = {
  google: "https://accounts.google.com",
  apple: "https://appleid.apple.com",
};

/** Where the API swaps a browser sign-in's code for the person's ID token. */
const TOKEN_ENDPOINTS: Record<string, SocialProviderId> = {
  "https://oauth2.googleapis.com/token": "google",
  "https://appleid.apple.com/auth/token": "apple",
};

const AUTHORIZE_ORIGINS: Record<string, SocialProviderId> = {
  "https://accounts.google.com": "google",
  "https://appleid.apple.com": "apple",
};

/**
 * Stands in for Google and Apple. Tests ask it to issue an ID token for a person,
 * as the provider would after native sign-in on the phone. The tokens are real
 * JWTs with the provider's claims, so Better Auth reads them exactly as it reads
 * the real thing; only the signature is ours, and only this fake accepts it.
 */
export class FakeIdentityProviders implements IdentityTokenVerifier {
  private readonly signingKey = randomBytes(32);
  private readonly approvals = new Map<
    string,
    { provider: SocialProviderId; identity: FakeIdentity; nonce?: string; redirectUri: string }
  >();

  /**
   * The person approves the sign-in on the provider's page that the API sent the
   * browser to. Returns what the provider sends the browser back to the API with.
   */
  approve(authorizationUrl: string, identity: FakeIdentity): { code: string; state: string } {
    const url = new URL(authorizationUrl);
    const provider = AUTHORIZE_ORIGINS[url.origin];
    const state = url.searchParams.get("state");
    const redirectUri = url.searchParams.get("redirect_uri");
    if (!provider || !state || !redirectUri) throw new Error(`Not a sign-in URL this fake recognises: ${authorizationUrl}`);

    const code = randomBytes(12).toString("hex");
    this.approvals.set(code, { provider, identity, nonce: url.searchParams.get("nonce") ?? undefined, redirectUri });
    return { code, state };
  }

  /**
   * Answers the API's server-to-server code exchange with Google or Apple, and
   * nothing else. A code is good once, and only at the provider that issued it.
   */
  async answerTokenRequest(url: string, body: string): Promise<Response | null> {
    const provider = TOKEN_ENDPOINTS[url];
    if (!provider) return null;

    const params = new URLSearchParams(body);
    const approval = this.approvals.get(params.get("code") ?? "");
    if (!approval || approval.provider !== provider || approval.redirectUri !== params.get("redirect_uri")) {
      return Response.json({ error: "invalid_grant" }, { status: 400 });
    }
    this.approvals.delete(params.get("code")!);

    return Response.json({
      access_token: randomBytes(12).toString("hex"),
      token_type: "Bearer",
      expires_in: 3600,
      id_token: this.issue(provider, approval.identity, { nonce: approval.nonce }),
    });
  }

  issue(provider: SocialProviderId, identity: FakeIdentity, options: { nonce?: string } = {}): string {
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      iss: ISSUERS[provider],
      sub: identity.subject,
      iat: now,
      exp: now + 3600,
      ...(identity.email !== undefined && { email: identity.email }),
      email_verified: identity.emailVerified,
      ...(provider === "google" && identity.name !== undefined && { name: identity.name }),
      ...(options.nonce !== undefined && { nonce: options.nonce }),
    };
    const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}`;
    return `${unsigned}.${this.sign(unsigned)}`;
  }

  async verify(provider: SocialProviderId, token: string, nonce?: string) {
    const [header, payload, signature] = token.split(".");
    if (!header || !payload || !signature) return false;
    const expected = Buffer.from(this.sign(`${header}.${payload}`));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;

    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as { iss: string; nonce?: string };
    if (claims.iss !== ISSUERS[provider]) return false;
    // Like a real ID token: a nonce presented with the token must be the one it was issued for.
    if (nonce !== undefined && nonce !== claims.nonce) return false;
    return true;
  }

  private sign(unsigned: string) {
    return createHmac("sha256", this.signingKey).update(unsigned).digest("base64url");
  }
}

function encode(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
