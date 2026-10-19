import type { RecognisedLine, RecognisedText } from "./ports";

/**
 * Top to bottom, then left to right for lines side by side. OCR doesn't
 * promise any order, and parsing depends on it: layout rules (an address's
 * next line, the job title under the name) on the device, and the sense of the
 * text the cloud Parse reads.
 */
export function readingOrder(a: RecognisedLine, b: RecognisedLine): number {
  const middle = (line: RecognisedLine) => line.box.y + line.box.height / 2;
  const sameRow = Math.abs(middle(a) - middle(b)) < Math.min(a.box.height, b.box.height) / 2;
  return sameRow ? a.box.x - b.box.x : a.box.y - b.box.y;
}

/** What OCR read, as plain text: one line per line, in reading order, blank lines left out. */
export function textInReadingOrder(recognised: RecognisedText): string {
  return [...recognised.lines]
    .sort(readingOrder)
    .map((line) => line.text.trim())
    .filter((text) => text !== "")
    .join("\n");
}
