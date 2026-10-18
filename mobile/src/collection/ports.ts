// Adapters the Collection depends on. The app wires real ones (expo-sqlite,
// Apple Vision / ML Kit, the HTTP API); tests wire in-memory fakes.

/** The device's local SQLite database (ADR 0006). */
export interface LocalDatabase {
  execute(sql: string, params?: SqlValue[]): Promise<void>;
  all<Row>(sql: string, params?: SqlValue[]): Promise<Row[]>;
}

export type SqlValue = string | number | null;

/** On-device text recognition (Apple Vision on iOS, ML Kit on Android). */
export interface OcrAdapter {
  recognise(image: { uri: string }): Promise<{ text: string }>;
}

/** Parses recognised text on the device when the cloud Parse isn't available (ADR 0004). */
export interface OnDeviceParser {
  parse(text: string): Promise<ParsedFields>;
}

/** The parts of the API the Collection calls. Grows as sync and cloud Parse arrive. */
export interface ApiClient {
  parseCardText(text: string): Promise<ParsedFields>;
}

/** One parsed field value with its Field Confidence (0..1). */
export interface ParsedField {
  value: string;
  confidence: number;
}

export type ParsedFields = Record<string, ParsedField>;
