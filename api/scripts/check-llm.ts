// Checks the Claude API settings in api/.env by parsing a sample card.
// Run with: npm run check-llm -w api
// Or parse a card of your own, one argument per line of text as OCR read it:
//   npm run check-llm -w api -- "Aroha Ngata" "DIRECTOR" "Mobile: 027 243 I450"
// To check the vision fallback too, add a photo of a card:
//   npm run check-llm -w api -- --photo ~/Desktop/stylised-card.jpg
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { parseArgs } from "node:util";
import { anthropicLlmProvider } from "../src/adapters/anthropic.ts";
import { loadLlm } from "../src/config.ts";
import type { ParsedFields } from "../src/ports.ts";

const { values, positionals: cardLines } = parseArgs({ options: { photo: { type: "string" } }, allowPositionals: true });
const photo = values.photo;
const SAMPLE_CARD = cardLines.length > 0 ? cardLines.join("\n") : ["Aroha Ngata", "Chief Technology Officer", "KOWHAI LABS LTD", "M 021 555 0199", "F 04 555 0100",
  "aroha@kowhai.example", "www.kowhai.example", "Level 3, 12 Cuba Street", "Wellington 6011", "linkedin.com/in/arohangata"].join("\n");

const settings = loadLlm();
if (!settings) {
  console.error("ANTHROPIC_API_KEY isn't set in api/.env.");
  process.exit(1);
}

const llm = anthropicLlmProvider(settings);
const MIME_TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

async function check(what: string, parse: () => Promise<ParsedFields>) {
  const started = Date.now();
  try {
    const fields = await parse();
    console.log(`${settings!.model} parsed ${what} in ${Date.now() - started} ms:`);
    console.table(Object.fromEntries(Object.entries(fields).map(([key, f]) => [key, { value: f.value, confidence: f.confidence }])));
  } catch (error) {
    console.error(`${settings!.model} couldn't parse ${what}:`, error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

await check("the sample card's text", () => llm.parseCardText({ text: SAMPLE_CARD }));
if (photo) {
  const mimeType = MIME_TYPES[extname(photo).toLowerCase()];
  if (!mimeType) {
    console.error(`${photo} isn't a JPEG, PNG or WebP photo.`);
    process.exit(1);
  }
  const image = new Uint8Array(await readFile(photo));
  await check(`the photo ${photo}`, () => llm.parseCardImage({ image, mimeType }));
}
