/// <reference types="node" />
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { openCollection, type CollectionDependencies } from "../src/collection";
import type { ApiClient, LocalDatabase, OcrAdapter, OnDeviceParser, ParsedFields, SqlValue } from "../src/collection/ports";

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

/** Returns whatever text the test says the camera saw. */
export class FakeOcr implements OcrAdapter {
  text = "";
  async recognise() {
    return { text: this.text };
  }
}

/** Returns the fields the test configures, and records what it was asked to parse. */
export class FakeOnDeviceParser implements OnDeviceParser {
  fields: ParsedFields = {};
  readonly calls: string[] = [];
  async parse(text: string) {
    this.calls.push(text);
    return this.fields;
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
    newId: () => randomUUID(),
    now: clock.now,
  } satisfies CollectionDependencies;
  const collection = await openCollection(deps);
  return { collection, clock, db, deps };
}
