import type { Pool } from "pg";
import type { LlmProvider, ParsedFields } from "./ports.ts";

/** Where a card was parsed (`card_copy.parsed_by`). The API only ever parses in the cloud. */
export type CloudParsedBy = "cloud-text" | "cloud-vision";

export interface ParseResult {
  parsedBy: CloudParsedBy;
  fields: ParsedFields;
}

/**
 * A text Parse's answer. When the text Parse is unsure, `imageWanted` asks the
 * app for the card's image, to parse with a vision model instead (ADR 0004).
 * The app sends the image only then, so a card's photo leaves the phone only
 * when its text wasn't enough (spec story 2).
 */
export type TextParseResult =
  | (ParseResult & { parsedBy: "cloud-text"; imageWanted: boolean })
  /** OCR read too little for a text Parse to be worth making: nothing was parsed. */
  | { parsedBy: null; imageWanted: true };

/** When a text Parse asks for the card's image instead. */
export interface VisionFallbackThresholds {
  /** Ask for the image when the fields' overall Field Confidence (their mean) is below this. */
  belowConfidence: number;
  /**
   * Ask for the image without a text Parse when the recognised text, trimmed,
   * is shorter than this many characters. A stylised card OCR can't read
   * yields a stray word or two; a plain one gives a name and an email at least.
   */
  belowTextLength: number;
}

/**
 * Below 0.6 is where the model is told to put values it corrected or guessed,
 * and where the app flags fields for checking. 20 characters is about a name
 * and nothing else.
 */
export const DEFAULT_VISION_FALLBACK: VisionFallbackThresholds = {
  belowConfidence: 0.6,
  belowTextLength: 20,
};

/** The mean Field Confidence of a Parse's fields; none at all counts as no confidence. */
function overallConfidence(fields: ParsedFields): number {
  const confidences = Object.values(fields).map((field) => field.confidence);
  if (confidences.length === 0) return 0;
  return confidences.reduce((sum, confidence) => sum + confidence, 0) / confidences.length;
}

/**
 * The card fields a Parse returns, keyed as the app's Collection keys them.
 * Social handles are keyed `social:<Network>`, such as `social:LinkedIn`.
 * Keep in step with CARD_TEXT_FIELDS in mobile/src/collection.
 */
export const CARD_TEXT_FIELDS = ["name", "jobTitle", "company", "email", "phone", "website", "address"] as const;
const SOCIAL_FIELD = /^social:\S/;

/**
 * Keeps only what an LLM returned that fits the Parse contract: known card
 * fields with a non-blank string value, each Field Confidence a number
 * clamped to 0..1 (one that isn't a number counts as no confidence at all).
 */
function cardFieldsFrom(returned: ParsedFields): ParsedFields {
  const fields: ParsedFields = {};
  for (const [key, field] of Object.entries(returned)) {
    if (!(CARD_TEXT_FIELDS as readonly string[]).includes(key) && !SOCIAL_FIELD.test(key)) continue;
    const value = typeof field?.value === "string" ? field.value.trim() : "";
    if (!value) continue;
    const confidence = Number.isFinite(field.confidence) ? Math.min(1, Math.max(0, field.confidence)) : 0;
    fields[key] = { value, confidence };
  }
  return fields;
}

/** The photo formats a vision Parse accepts: the ones the vision model reads. The app's scanners take JPEGs. */
export const PARSE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * The largest photo a vision Parse accepts. The Claude API takes images up to
 * 5 MB once base64-encoded, which is 3.75 MB of photo. A business card cropped
 * by the phone's document scanner comes to well under that.
 */
export const MAX_PARSE_IMAGE_BYTES = 3.75 * 1024 * 1024;

/** Thrown when the LLM provider couldn't parse a card, such as during an outage. */
export class ParseFailed extends Error {
  constructor(cause: unknown) {
    super("The LLM provider couldn't parse the card", { cause });
    this.name = "ParseFailed";
  }
}

/** How many cloud Parses an Account has made, by kind. */
export type ParseUsage = Record<CloudParsedBy, number>;

/**
 * Parse (ADR 0004): turns a Scan's recognised text into structured card
 * fields, each with its Field Confidence, using a cheap text-only LLM. Every
 * call to the LLM is metered against the Account that asked for it.
 */
export function createParser({
  llm,
  pool,
  fallback = DEFAULT_VISION_FALLBACK,
}: {
  llm: LlmProvider;
  pool: Pool;
  fallback?: VisionFallbackThresholds;
}) {
  async function meter(accountId: string, parsedBy: CloudParsedBy, succeeded: boolean) {
    await pool.query("INSERT INTO parse_call (account_id, parsed_by, succeeded) VALUES ($1, $2, $3)", [
      accountId,
      parsedBy,
      succeeded,
    ]);
  }

  return {
    /**
     * Parses a Scan's recognised text, or asks for the card's image when the
     * text is too short or the Parse unsure (see VisionFallbackThresholds).
     * Throws ParseFailed when the LLM call fails. Every call is metered, failed
     * ones too (a provider may charge for them), with whether it succeeded.
     */
    async parseText(accountId: string, text: string): Promise<TextParseResult> {
      if (text.trim().length < fallback.belowTextLength) return { parsedBy: null, imageWanted: true };
      let returned: ParsedFields;
      try {
        returned = await llm.parseCardText({ text });
      } catch (cause) {
        await meter(accountId, "cloud-text", false);
        throw new ParseFailed(cause);
      }
      await meter(accountId, "cloud-text", true);
      const fields = cardFieldsFrom(returned);
      return {
        parsedBy: "cloud-text",
        imageWanted: overallConfidence(fields) < fallback.belowConfidence,
        fields,
      };
    },

    /**
     * Parses a card from its photo with a vision model: the fallback for cards
     * whose text the text Parse couldn't read (ADR 0004). Throws ParseFailed
     * when the LLM call fails. Metered like a text Parse, as `cloud-vision`.
     */
    async parseImage(accountId: string, image: Uint8Array, mimeType: string): Promise<ParseResult> {
      let returned: ParsedFields;
      try {
        returned = await llm.parseCardImage({ image, mimeType });
      } catch (cause) {
        await meter(accountId, "cloud-vision", false);
        throw new ParseFailed(cause);
      }
      await meter(accountId, "cloud-vision", true);
      return { parsedBy: "cloud-vision", fields: cardFieldsFrom(returned) };
    },

    async usage(accountId: string): Promise<ParseUsage> {
      const { rows } = await pool.query<{ parsed_by: CloudParsedBy; calls: string }>(
        "SELECT parsed_by, count(*) AS calls FROM parse_call WHERE account_id = $1 GROUP BY parsed_by",
        [accountId],
      );
      const usage: ParseUsage = { "cloud-text": 0, "cloud-vision": 0 };
      for (const row of rows) usage[row.parsed_by] = Number(row.calls);
      return usage;
    },
  };
}
