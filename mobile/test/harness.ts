/// <reference types="node" />
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { openCollection, type CollectionDependencies } from "../src/collection";
import type {
  ApiClient,
  CardImage,
  CardImageStore,
  LocalDatabase,
  OcrAdapter,
  OnDeviceParser,
  ParsedFields,
  RecognisedText,
  SqlValue,
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
  readonly recognised: string[] = [];
  async recognise(image: CardImage): Promise<RecognisedText> {
    this.recognised.push(image.uri);
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

/** Keeps photos in memory, at a durable address that says which card they belong to. */
export class FakeImageStore implements CardImageStore {
  readonly kept = new Map<string, string>();
  async keep(image: CardImage, name: string): Promise<CardImage> {
    const uri = `file:///documents/card-images/${name}.jpg`;
    this.kept.set(uri, image.uri);
    return { uri };
  }
}

/** Stands in for the HTTP API; set `online = false` to simulate no signal. */
export class FakeApiClient implements ApiClient {
  online = true;
  fields: ParsedFields = {};
  readonly parseCalls: string[] = [];
  async parseCardText(text: string) {
    if (!this.online) throw new Error("Network request failed");
    this.parseCalls.push(text);
    return this.fields;
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
