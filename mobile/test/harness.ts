/// <reference types="node" />
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { openCollection, type CollectionDependencies } from "../src/collection";
import type {
  ApiClient,
  CardImage,
  CardImageStore,
  CloudParse,
  LocalDatabase,
  OcrAdapter,
  OnDeviceParser,
  ParsedFields,
  RecognisedText,
  SqlValue,
  TextParse,
} from "../src/collection/ports";

/** An in-memory SQLite database standing in for expo-sqlite. */
export class InMemoryDatabase implements LocalDatabase {
  private readonly db = new DatabaseSync(":memory:");

  async execute(sql: string, params: SqlValue[] = []) {
    if (params.length === 0) this.db.exec(sql);
    else this.db.prepare(sql).run(...params);
  }

  async all<Row>(sql: string, params: SqlValue[] = []) {
    return this.db.prepare(sql).all(...params) as Row[];
  }
}

/** Returns whatever lines of text the test says the camera saw, one above the other. */
export class FakeOcr implements OcrAdapter {
  lines: string[] = [];
  async recognise(): Promise<RecognisedText> {
    return {
      lines: this.lines.map((text, i) => ({ text, box: { x: 0.1, y: 0.1 + i * 0.1, width: 0.5, height: 0.05 } })),
    };
  }
}

/** Returns the fields the test configures, and records the text it was asked to parse. */
export class FakeOnDeviceParser implements OnDeviceParser {
  fields: ParsedFields = {};
  readonly calls: string[][] = [];
  async parse(recognised: RecognisedText) {
    this.calls.push(recognised.lines.map((line) => line.text));
    return this.fields;
  }
}

/**
 * Keeps photos in memory under a documents folder whose address can change, as
 * an iOS app's container does after an update or a restore.
 */
export class FakeImageStore implements CardImageStore {
  documents = "file:///documents";
  async keep(_image: CardImage, name: string): Promise<string> {
    return `card-images/${name}.jpg`;
  }
  locate(reference: string): CardImage {
    return { uri: `${this.documents}/${reference}` };
  }
}

/**
 * Stands in for the HTTP API. It answers only once the Holder has signed in
 * (`signedIn = true`), as the real API refuses a Parse without a session, and
 * only while there is signal (set `online = false` for none).
 */
export class FakeApiClient implements ApiClient {
  signedIn = false;
  online = true;
  /** Set to make the API's Parse fail, as when the LLM provider is down. */
  parseFails = false;
  /** The fields the text Parse finds. */
  fields: ParsedFields = {};
  /** Set to make the text Parse unsure, so the API asks for the card's photo. */
  imageWanted = false;
  /** Set to make the API judge OCR's text too short to parse, and ask for the photo instead. */
  textTooShort = false;
  /** The fields the vision Parse finds in the photo. */
  imageFields: ParsedFields = {};
  /** Set to make the vision Parse fail. */
  imageParseFails = false;
  /** The text of each Parse the API received. */
  readonly parseCalls: string[] = [];
  /** The photo of each vision Parse the API received. */
  readonly imageParseCalls: string[] = [];

  private reach() {
    if (!this.online) throw new Error("Network request failed");
    if (!this.signedIn) throw new Error("401 not-signed-in");
  }

  async parseCardText(text: string): Promise<TextParse> {
    this.reach();
    this.parseCalls.push(text);
    if (this.textTooShort) return { parsedBy: null, imageWanted: true };
    if (this.parseFails) throw new Error("502 parse-failed");
    return { parsedBy: "cloud-text", imageWanted: this.imageWanted, fields: this.fields };
  }

  async parseCardImage(image: CardImage): Promise<CloudParse> {
    this.reach();
    this.imageParseCalls.push(image.uri);
    if (this.imageParseFails) throw new Error("502 parse-failed");
    return { parsedBy: "cloud-vision", fields: this.imageFields };
  }
}

/** A clock that only moves when the test says so. */
export class TestClock {
  private time = new Date("2026-10-19T09:00:00.000Z").getTime();
  now = () => new Date(this.time);
  advance(minutes: number) {
    this.time += minutes * 60_000;
  }
}

export async function createTestCollection() {
  const db = new InMemoryDatabase();
  const clock = new TestClock();
  const deps = {
    db,
    ocr: new FakeOcr(),
    parser: new FakeOnDeviceParser(),
    api: new FakeApiClient(),
    images: new FakeImageStore(),
    newId: () => randomUUID(),
    now: clock.now,
  } satisfies CollectionDependencies;
  const collection = await openCollection(deps);
  return { collection, clock, db, deps };
}
