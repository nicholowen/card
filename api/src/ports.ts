// Ports: the outside services the API talks to. Production adapters and
// in-process test fakes both implement these, so tests never reach the network.

/** Sends transactional email (sign-in codes, Identifier verification codes). */
export interface EmailSender {
  sendOneTimeCode(message: { to: string; code: string; purpose: OneTimeCodePurpose }): Promise<void>;
}

export type OneTimeCodePurpose = "sign-in" | "email-verification" | "forget-password" | "change-email";

/** Turns a Scan's recognised text (and optionally its image) into structured card fields (ADR 0004). */
export interface LlmProvider {
  parseCardText(input: { text: string }): Promise<ParsedFields>;
  parseCardImage(input: { image: Uint8Array; mimeType: string }): Promise<ParsedFields>;
}

/** One parsed field value with its Field Confidence (0..1). */
export interface ParsedField {
  value: string;
  confidence: number;
}

export type ParsedFields = Record<string, ParsedField>;

/** Stores card images. Keys are always prefixed with the Account ID (ADR 0003). */
export interface ObjectStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
  deletePrefix(prefix: string): Promise<void>;
}

export type SocialProviderId = "google" | "apple";

/**
 * Checks that an ID token the app got from Google or Apple through native sign-in
 * really was issued by that provider for this app (and, when given, for this nonce).
 * Better Auth reads the person's details from the token once it passes.
 */
export interface IdentityTokenVerifier {
  verify(provider: SocialProviderId, token: string, nonce?: string): Promise<boolean>;
}

export interface Ports {
  email: EmailSender;
  llm: LlmProvider;
  storage: ObjectStorage;
  /**
   * Unset in production, where Better Auth checks ID-token signatures against
   * Google's and Apple's published keys. Tests set it to a fake provider, since
   * they can't get tokens signed by the real ones. Only the signature check is
   * replaced: reading the token's profile is still Better Auth's own code.
   */
  identityTokens?: IdentityTokenVerifier;
}
