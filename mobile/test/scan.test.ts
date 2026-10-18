import { describe, expect, it } from "vitest";
import { CardHasNoDetails, openCollection } from "../src/collection";
import { createTestCollection } from "./harness";

const FRONT = { uri: "file:///cache/scan-front.jpg" };

describe("scanning the front of a card", () => {
  it("reads the card on the device and offers its fields for review", async () => {
    const { collection, deps } = await createTestCollection();
    deps.ocr.lines = ["Aroha Ngata", "CTO", "Kōwhai Labs", "aroha@kowhai.example"];
    deps.parser.fields = {
      name: { value: "Aroha Ngata", confidence: 0.9 },
      jobTitle: { value: "CTO", confidence: 0.8 },
      company: { value: "Kōwhai Labs", confidence: 0.8 },
      email: { value: "aroha@kowhai.example", confidence: 0.99 },
    };

    const review = await collection.scan(FRONT);

    expect(review.fields).toEqual({
      name: "Aroha Ngata",
      jobTitle: "CTO",
      company: "Kōwhai Labs",
      email: "aroha@kowhai.example",
    });
  });

  it("offers the social handles it found alongside the other fields", async () => {
    const { collection, deps } = await createTestCollection();
    deps.parser.fields = {
      name: { value: "Aroha Ngata", confidence: 0.9 },
      "social:LinkedIn": { value: "arohangata", confidence: 0.9 },
      "social:Instagram": { value: "aroha.makes", confidence: 0.7 },
    };

    const review = await collection.scan(FRONT);

    expect(review.fields).toEqual({
      name: "Aroha Ngata",
      socials: [
        { network: "LinkedIn", handle: "arohangata" },
        { network: "Instagram", handle: "aroha.makes" },
      ],
    });
  });

  it("flags the fields it isn't confident about, so the Holder knows which to check", async () => {
    const { collection, deps } = await createTestCollection();
    deps.parser.fields = {
      name: { value: "Aroha Ngata", confidence: 0.95 },
      jobTitle: { value: "CTO", confidence: 0.6 },
      company: { value: "K0whai Labs", confidence: 0.59 },
      address: { value: "12 Cuba St", confidence: 0.2 },
    };

    const review = await collection.scan(FRONT);

    expect(review.needsChecking).toEqual(["company", "address"]);
  });

  it("saves the fields as the Holder corrected them, not as they were read", async () => {
    const { collection, deps } = await createTestCollection();
    deps.parser.fields = {
      name: { value: "Aroha Ngota", confidence: 0.4 },
      company: { value: "K0whai Labs", confidence: 0.3 },
      phone: { value: "021 555 0199", confidence: 0.95 },
    };
    const review = await collection.scan(FRONT);

    const card = await collection.saveScan(review, {
      ...review.fields,
      name: " Aroha Ngata ",
      company: "Kōwhai Labs",
      phone: "",
    });

    expect((await collection.get(card.id))?.fields).toEqual({ name: "Aroha Ngata", company: "Kōwhai Labs" });
  });

  it("still finds a card's photo after the app's documents folder moves, as on iOS after an update", async () => {
    const { collection, deps } = await createTestCollection();
    deps.parser.fields = { name: { value: "Aroha Ngata", confidence: 0.9 } };
    const card = await collection.saveScan(await collection.scan(FRONT), { name: "Aroha Ngata" });

    deps.images.documents = "file:///new-container/documents";
    const reopened = await openCollection(deps);

    expect((await reopened.get(card.id))?.frontImage).toEqual({
      uri: `file:///new-container/documents/card-images/${card.id}-front.jpg`,
    });
  });

  it("works signed out and with no signal, without calling the API", async () => {
    const { collection, deps } = await createTestCollection();
    deps.api.online = false;
    deps.parser.fields = { name: { value: "Aroha Ngata", confidence: 0.9 } };

    const review = await collection.scan(FRONT);
    const card = await collection.saveScan(review, review.fields);

    expect(await collection.get(card.id)).toMatchObject({ source: "scan", parsedBy: "device" });
    expect(await collection.unsyncedCards()).toMatchObject([{ id: card.id }]);
  });

  it("opens a card it can't read for review with no fields, and won't save it until the Holder types a detail", async () => {
    const { collection, deps } = await createTestCollection();
    deps.ocr.lines = [];

    const review = await collection.scan(FRONT);

    expect(review.fields).toEqual({});
    expect(review.needsChecking).toEqual([]);
    await expect(collection.saveScan(review, review.fields)).rejects.toThrow(CardHasNoDetails);
    const card = await collection.saveScan(review, { name: "Aroha Ngata" });
    expect(await collection.list()).toMatchObject([{ id: card.id, name: "Aroha Ngata" }]);
  });

  it("keeps a scanned card's photo and source when the Holder later edits My Version", async () => {
    const { collection, deps, clock } = await createTestCollection();
    deps.parser.fields = { name: { value: "Aroha Ngata", confidence: 0.9 } };
    const scanned = await collection.saveScan(await collection.scan(FRONT), { name: "Aroha Ngata" });
    clock.advance(10);

    await collection.editMyVersion(scanned.id, { name: "Aroha Ngata", jobTitle: "CTO" });

    expect(await collection.get(scanned.id)).toEqual({
      ...scanned,
      fields: { name: "Aroha Ngata", jobTitle: "CTO" },
      updatedAt: "2026-10-19T09:10:00.000Z",
    });
  });

  it("saves the reviewed card as a scanned Card Copy, parsed on the device, with its photo kept", async () => {
    const { collection, deps } = await createTestCollection();
    deps.parser.fields = { name: { value: "Aroha Ngata", confidence: 0.9 } };
    const review = await collection.scan(FRONT);

    const card = await collection.saveScan(review, review.fields);

    const reopened = await openCollection(deps);
    const saved = await reopened.get(card.id);
    expect(saved).toEqual({
      id: card.id,
      source: "scan",
      parsedBy: "device",
      fields: { name: "Aroha Ngata" },
      frontImage: { uri: `file:///documents/card-images/${card.id}-front.jpg` },
      createdAt: "2026-10-19T09:00:00.000Z",
      updatedAt: "2026-10-19T09:00:00.000Z",
    });
    expect(await reopened.list()).toMatchObject([{ id: card.id, name: "Aroha Ngata" }]);
  });
});
