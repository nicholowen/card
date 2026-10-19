import Anthropic from "@anthropic-ai/sdk";
import { CARD_TEXT_FIELDS } from "../parse.ts";
import type { LlmProvider, ParsedFields } from "../ports.ts";

/** Claude Haiku: Anthropic's fastest and cheapest model, built for extraction (ADR 0004). */
export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-5-5";

/**
 * How long the API waits for the model. Shorter than the app's own 8-second
 * limit, so the API answers (and meters) before the app gives up and parses on
 * the device, and the Card Copy's `parsed_by` matches the meter.
 */
const TIMEOUT_MS = 6000;

const INSTRUCTIONS = `You read the text that OCR recognised on a business card and return the card's details.

Rules:
- Use only what is on the card. Never invent or complete a detail. Set a field to null when the card doesn't have it.
- name: the person's name. jobTitle: their role. company: the organisation.
- email and phone: as printed. If there are several phone numbers, choose the mobile; otherwise the first. Never return a fax number.
- website: the company or personal website, not a social profile.
- address: the street or postal address on one line, parts separated by commas.
- socials: social profiles such as LinkedIn, Instagram, X, Facebook or GitHub. network is the service's name; handle is the username or profile path.
- OCR makes mistakes (0 for O, 1 for l, stray characters). Correct obvious ones.
- confidence is how sure you are that the value is right and in the right field, from 0 to 1. Use below 0.6 when you corrected OCR, guessed between fields, or the text was unclear.`;

const FIELD = {
  anyOf: [
    {
      type: "object",
      properties: { value: { type: "string" }, confidence: { type: "number" } },
      required: ["value", "confidence"],
      additionalProperties: false,
    },
    { type: "null" },
  ],
};

/** The shape Claude must answer in (structured outputs). */
const CARD_SCHEMA = {
  type: "object",
  properties: {
    ...Object.fromEntries(CARD_TEXT_FIELDS.map((key) => [key, FIELD])),
    socials: {
      type: "array",
      items: {
        type: "object",
        properties: {
          network: { type: "string" },
          handle: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["network", "handle", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: [...CARD_TEXT_FIELDS, "socials"],
  additionalProperties: false,
};

type ParsedCardField = { value: string; confidence: number } | null;
type ParsedCard = Record<(typeof CARD_TEXT_FIELDS)[number], ParsedCardField> & {
  socials: { network: string; handle: string; confidence: number }[];
};

/**
 * The LLM provider as Claude Haiku on the Claude API. Only a card's
 * recognised text is sent; nothing is kept beyond Anthropic's retention terms
 * (zero data retention once it's enabled for the organisation).
 */
export function anthropicLlmProvider({ apiKey, model }: { apiKey: string; model: string }): LlmProvider {
  // No retries: a slow or failed call should fall back to the device Parse, not keep the Holder waiting.
  const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 0 });

  return {
    async parseCardText({ text }) {
      const response = await client.messages.create({
        model,
        max_tokens: 1024,
        // Extraction from a few lines of text needs no deliberation: the fastest setting.
        thinking: { type: "disabled" },
        output_config: { effort: "low", format: { type: "json_schema", schema: CARD_SCHEMA } },
        system: INSTRUCTIONS,
        messages: [{ role: "user", content: `<card_text>\n${text}\n</card_text>` }],
      });
      const answer = response.content.find((block) => block.type === "text");
      if (!answer || answer.type !== "text") throw new Error(`No answer from ${model} (${response.stop_reason})`);
      return toParsedFields(JSON.parse(answer.text) as ParsedCard);
    },

    async parseCardImage() {
      throw new Error("Parsing a card from its image isn't built yet (#7)");
    },
  };
}

/** Claude's answer as Parse fields, keyed the way the app keys them. */
function toParsedFields(card: ParsedCard): ParsedFields {
  const fields: ParsedFields = {};
  for (const key of CARD_TEXT_FIELDS) {
    const field = card[key];
    if (field) fields[key] = field;
  }
  for (const social of card.socials ?? []) {
    fields[`social:${social.network}`] ??= { value: social.handle, confidence: social.confidence };
  }
  return fields;
}
