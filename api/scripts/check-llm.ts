// Checks the Claude API settings in api/.env by parsing a sample card.
// Run with: npm run check-llm -w api
// Or parse a card of your own, one argument per line of text as OCR read it:
//   npm run check-llm -w api -- "Hamish Erench" "DIRECTOR" "Mobile: 027 243 I450"
import { anthropicLlmProvider } from "../src/adapters/anthropic.ts";
import { loadLlm } from "../src/config.ts";

const cardLines = process.argv.slice(2);
const SAMPLE_CARD = cardLines.length > 0 ? cardLines.join("\n") : ["Aroha Ngata", "Chief Technology Officer", "KOWHAI LABS LTD", "M 021 555 0199", "F 04 555 0100",
  "aroha@kowhai.example", "www.kowhai.example", "Level 3, 12 Cuba Street", "Wellington 6011", "linkedin.com/in/arohangata"].join("\n");

const settings = loadLlm();
if (!settings) {
  console.error("ANTHROPIC_API_KEY isn't set in api/.env.");
  process.exit(1);
}

const started = Date.now();
try {
  const fields = await anthropicLlmProvider(settings).parseCardText({ text: SAMPLE_CARD });
  console.log(`${settings.model} parsed the sample card in ${Date.now() - started} ms:`);
  console.table(Object.fromEntries(Object.entries(fields).map(([key, f]) => [key, { value: f.value, confidence: f.confidence }])));
} catch (error) {
  console.error(`${settings.model} couldn't parse the sample card:`, error instanceof Error ? error.message : error);
  process.exit(1);
}
