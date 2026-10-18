// Adapters the Collection depends on. The app wires real ones (expo-sqlite,
// Apple Vision / ML Kit, the HTTP API); tests wire in-memory fakes.

/** The device's local SQLite database (ADR 0006). */
export interface LocalDatabase {
  execute(sql: string, params?: SqlValue[]): Promise<void>;
  all<Row>(sql: string, params?: SqlValue[]): Promise<Row[]>;
}

export type SqlValue = string | number | null;

/** A photo of a card, as a file address on the device. */
export interface CardImage {
  uri: string;
}

/** On-device text recognition (Apple Vision on iOS, ML Kit on Android). */
export interface OcrAdapter {
  recognise(image: CardImage): Promise<RecognisedText>;
}

/** What OCR read on a card: its lines, in no particular order. */
export interface RecognisedText {
  lines: RecognisedLine[];
}

/** One line of text and where it sits on the card. */
export interface RecognisedLine {
  text: string;
  /** The line's bounding box as fractions (0..1) of the image, measured from the top-left corner. */
  box: { x: number; y: number; width: number; height: number };
}

/** Parses recognised text on the device when the cloud Parse isn't available (ADR 0004). */
export interface OnDeviceParser {
  parse(recognised: RecognisedText): Promise<ParsedFields>;
}

/**
 * Keeps card photos on the device for as long as their Card Copy exists. The
 * camera writes to a cache the system may clear, so a photo is copied here
 * before its card is saved.
 *
 * The Collection stores the reference `keep` returns rather than a file
 * address, because the app's own folder can move (on iOS, after an update or a
 * restore) and a stored address would then point nowhere.
 */
export interface CardImageStore {
  /** Copies the photo to durable storage under `name`, and returns a reference to it. */
  keep(image: CardImage, name: string): Promise<string>;
  /** Where a kept photo is now. */
  locate(reference: string): CardImage;
}

/** How a Parse keys a social handle, such as `social:LinkedIn` (see ParsedFields). */
export function socialFieldKey(network: string): string {
  return `${SOCIAL_FIELD_PREFIX}${network}`;
}

export const SOCIAL_FIELD_PREFIX = "social:";

/** The parts of the API the Collection calls. Grows as sync and cloud Parse arrive. */
export interface ApiClient {
  parseCardText(text: string): Promise<ParsedFields>;
}

/** One parsed field value with its Field Confidence (0..1). */
export interface ParsedField {
  value: string;
  confidence: number;
}

/**
 * A Parse's fields, keyed by card field name (`name`, `email`, …). Social
 * handles are keyed `social:<Network>`, such as `social:LinkedIn`.
 */
export type ParsedFields = Record<string, ParsedField>;
