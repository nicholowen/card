import { randomBytes } from "node:crypto";
import type {
  EmailSender,
  IdentityTokenVerifier,
  LlmProvider,
  ObjectStorage,
  OneTimeCodePurpose,
  ParsedFields,
  SocialProviderId,
  VerifiedIdentity,
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

/**
 * Stands in for Google and Apple. Tests ask it to issue an ID token for a person,
 * as the provider would after native sign-in on the phone, and the API checks
 * tokens against it. Any token it didn't issue is rejected.
 */
export class FakeIdentityProviders implements IdentityTokenVerifier {
  private readonly issued = new Map<
    string,
    { provider: SocialProviderId; identity: VerifiedIdentity; nonce?: string }
  >();

  issue(provider: SocialProviderId, identity: VerifiedIdentity, options: { nonce?: string } = {}): string {
    const token = `fake-${provider}-id-token-${randomBytes(8).toString("hex")}`;
    this.issued.set(token, { provider, identity, nonce: options.nonce });
    return token;
  }

  async verify(provider: SocialProviderId, token: string, nonce?: string) {
    const issued = this.issued.get(token);
    if (!issued || issued.provider !== provider) return null;
    // Like a real ID token: a nonce presented with the token must be the one it was issued for.
    if (nonce !== undefined && nonce !== issued.nonce) return null;
    return issued.identity;
  }
}
