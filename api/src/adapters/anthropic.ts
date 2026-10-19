import Anthropic from "@anthropic-ai/sdk";
import { CARD_TEXT_FIELDS } from "../parse.ts";
import type { LlmProvider, ParsedFields } from "../ports.ts";

/** Claude Haiku: Anthropic's fastest and cheapest model, built for extraction (ADR 0004). */
export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-5-5";

/**
 * How long the API waits for the model. Each is shorter than the app's own
 * limit for that request (8 seconds for text, 12 for a photo, which also has to
 * upload), so the API answers (and meters) before the app gives up and falls
 * back, and the Card Copy's `parsed_by` matches the meter.
 */
const TEXT_TIMEOUT_MS = 6000;
const IMAGE_TIMEOUT_MS = 8000;

const RULES = `Rules:
- Use only what is on the card. Never invent or complete a detail. Set a field to null when the card doesn't have it.
- name: the person's name. jobTitle: their role. company: the organisation.
- email and phone: as printed. If there are several phone numbers, choose the mobile; otherwise the first. Never return a fax number.
- website: the company or personal website, not a social profile.
- address: the street or postal address on one line, parts separated by commas.
- socials: social profiles such as LinkedIn, Instagram, X, Facebook or GitHub. network is the service's name; handle is the username or profile path.
- Keep people's names and company names exactly as read. Names from every culture look unfamiliar to someone; never change one because it is unusual or resembles a more common name.
- Change a name or company only when another part of the card shows a different spelling of it (for example in the email address or website), and then use that spelling.`;

const TEXT_INSTRUCTIONS = `You read the text that OCR recognised on a business card and return the card's details.

${RULES}
- The text comes from OCR, which can misread letters, especially where a design crosses the text.
  - In phone numbers, postcodes, email addresses and websites, fix characters that can't belong there, such as a letter I or O among digits.
- confidence is how sure you are that the value is right and in the right field, from 0 to 1. It reflects the evidence in the text, not how familiar a word looks. Use below 0.6 when you changed what OCR read, when parts of the card disagree, when the text has stray characters or broken words, or when you guessed which field it belongs in.`;

/** For cards OCR couldn't read: stylised fonts, a logo for the company name, vertical layouts (ADR 0004). */
const IMAGE_INSTRUCTIONS = `You read a photo of a business card and return the card's details.

${RULES}
- Read stylised lettering, vertical text and text set into a logo. When the company's name appears only as a logo, use it as the company.
- The photo may be cropped, skewed or have glare. Return only what you can read; never guess hidden text.
- confidence is how sure you are that the value is right and in the right field, from 0 to 1. It reflects the evidence on the card, not how familiar a word looks. Use below 0.6 when lettering was hard to make out, when parts of the card disagree, or when you guessed which field it belongs in.`;

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
 * The LLM provider as Claude Haiku on the Claude API. A card's recognised text
 * is sent, and its photo only when the text Parse wasn't enough (ADR 0004).
 * Nothing is kept beyond Anthropic's retention terms (zero data retention once
 * it's enabled for the organisation).
 */
export function anthropicLlmProvider({
  apiKey,
  model,
  workspaceId,
}: {
  apiKey: string;
  model: string;
  /** Needed when the API key isn't scoped to a workspace: the Claude API then asks which workspace to use. */
  workspaceId?: string;
}): LlmProvider {
  const client = new Anthropic({
    apiKey,
    // No retries: a slow or failed call should fall back to the device Parse, not keep the Holder waiting.
    maxRetries: 0,
    ...(workspaceId && { defaultHeaders: { "anthropic-workspace-id": workspaceId } }),
  });

  /** Asks Claude for a card's details in CARD_SCHEMA's shape. */
  async function ask(
    system: string,
    content: Anthropic.MessageParam["content"],
    timeout: number,
  ): Promise<ParsedFields> {
    const response = await client.messages.create(
      {
        model,
        max_tokens: 1024,
        // Parsing one card needs no deliberation: the fastest setting.
        thinking: { type: "disabled" },
        output_config: { effort: "low", format: { type: "json_schema", schema: CARD_SCHEMA } },
        system,
        messages: [{ role: "user", content }],
      },
      { timeout },
    );
    const answer = response.content.find((block) => block.type === "text");
    if (!answer || answer.type !== "text") throw new Error(`No answer from ${model} (${response.stop_reason})`);
    return toParsedFields(JSON.parse(answer.text) as ParsedCard);
  }

  return {
    parseCardText: ({ text }) => ask(TEXT_INSTRUCTIONS, `<card_text>\n${text}\n</card_text>`, TEXT_TIMEOUT_MS),

    async parseCardImage({ image, mimeType }) {
      const source = { type: "base64", media_type: mimeType, data: Buffer.from(image).toString("base64") } as const;
      return ask(IMAGE_INSTRUCTIONS, [{ type: "image", source }], IMAGE_TIMEOUT_MS);
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
