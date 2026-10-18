import type { Pool } from "pg";
import type { LlmProvider, ParsedFields } from "./ports.ts";

/** Where a card was parsed (`card_copy.parsed_by`). The API only ever parses in the cloud. */
export type CloudParsedBy = "cloud-text" | "cloud-vision";

export interface ParseResult {
  parsedBy: CloudParsedBy;
  fields: ParsedFields;
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
export function createParser({ llm, pool }: { llm: LlmProvider; pool: Pool }) {
  async function meter(accountId: string, parsedBy: CloudParsedBy) {
    await pool.query("INSERT INTO parse_call (account_id, parsed_by) VALUES ($1, $2)", [accountId, parsedBy]);
  }

  return {
    /**
     * Parses a Scan's recognised text. Throws ParseFailed when the LLM call
     * fails; only calls that return a result are metered, so a provider outage
     * never counts against an Account.
     */
    async parseText(accountId: string, text: string): Promise<ParseResult> {
      let fields: ParsedFields;
      try {
        fields = await llm.parseCardText({ text });
      } catch (cause) {
        throw new ParseFailed(cause);
      }
      await meter(accountId, "cloud-text");
      return { parsedBy: "cloud-text", fields: cardFieldsFrom(fields) };
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
