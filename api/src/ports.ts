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

/** Who a social provider says signed in, read from an ID token it issued. */
export interface VerifiedIdentity {
  /** The provider's stable ID for the person (the token's `sub`). */
  subject: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
}

/**
 * Checks ID tokens that the app got from Google or Apple through native sign-in.
 * Returns null for a token the provider didn't issue, or one issued for a different nonce.
 */
export interface IdentityTokenVerifier {
  verify(provider: SocialProviderId, token: string, nonce?: string): Promise<VerifiedIdentity | null>;
}

export interface Ports {
  email: EmailSender;
  llm: LlmProvider;
  storage: ObjectStorage;
  /**
   * Leave unset in production: Better Auth then verifies ID tokens itself against
   * Google's and Apple's published signing keys. Tests set it to a fake provider.
   */
  identityTokens?: IdentityTokenVerifier;
}
