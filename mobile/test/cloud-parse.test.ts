import { describe, expect, it } from "vitest";
import { openCollection } from "../src/collection";
import { createTestCollection } from "./harness";

const FRONT = { uri: "file:///cache/scan-front.jpg" };

/** A signed-in Holder with signal, so the Collection can reach the cloud Parse. */
async function signedInCollection() {
  const test = await createTestCollection();
  test.deps.api.signedIn = true;
  return test;
}

describe("parsing a scanned card in the cloud", () => {
  it("sends the recognised text to the API and offers the fields it returns for review", async () => {
    const { collection, deps } = await signedInCollection();
    deps.ocr.lines = ["Aroha Ngata", "CTO", "Kōwhai Labs", "aroha@kowhai.example"];
    deps.api.fields = {
      name: { value: "Aroha Ngata", confidence: 0.97 },
      jobTitle: { value: "CTO", confidence: 0.9 },
      company: { value: "Kōwhai Labs", confidence: 0.85 },
      email: { value: "aroha@kowhai.example", confidence: 0.99 },
    };

    const review = await collection.scan(FRONT);

    expect(deps.api.parseCalls).toEqual(["Aroha Ngata\nCTO\nKōwhai Labs\naroha@kowhai.example"]);
    expect(review.parsedBy).toBe("cloud-text");
    expect(review.fields).toEqual({
      name: "Aroha Ngata",
      jobTitle: "CTO",
      company: "Kōwhai Labs",
      email: "aroha@kowhai.example",
    });
    expect(deps.parser.calls).toEqual([]);
  });

  it("saves the reviewed card as parsed in the cloud from its text", async () => {
    const { collection, deps } = await signedInCollection();
    deps.ocr.lines = ["Aroha Ngata"];
    deps.api.fields = { name: { value: "Aroha Ngata", confidence: 0.97 } };

    const review = await collection.scan(FRONT);
    const card = await collection.saveScan(review, review.fields);

    const reopened = await openCollection(deps);
    expect(await reopened.get(card.id)).toMatchObject({ source: "scan", parsedBy: "cloud-text" });
  });

  it("flags the fields the cloud Parse isn't confident about, so the Holder knows which to check", async () => {
    const { collection, deps } = await signedInCollection();
    deps.ocr.lines = ["Aroha Ngata", "KOWHAI", "12 Cuba St"];
    deps.api.fields = {
      name: { value: "Aroha Ngata", confidence: 0.97 },
      company: { value: "Kōwhai Labs", confidence: 0.45 },
      address: { value: "12 Cuba Street", confidence: 0.3 },
    };

    const review = await collection.scan(FRONT);

    expect(review.needsChecking).toEqual(["company", "address"]);
    expect(review.fieldConfidences).toEqual({ name: 0.97, company: 0.45, address: 0.3 });
  });
});

describe("falling back to the device Parse", () => {
  it("parses on the device when the Holder isn't signed in", async () => {
    const { collection, deps } = await createTestCollection();
    deps.ocr.lines = ["Aroha Ngata"];
    deps.parser.fields = { name: { value: "Aroha Ngata", confidence: 0.7 } };

    const review = await collection.scan(FRONT);

    expect(review).toMatchObject({ parsedBy: "device", fields: { name: "Aroha Ngata" } });
    expect(deps.api.parseCalls).toEqual([]);
  });

  it("parses on the device when a signed-in Holder has no signal", async () => {
    const { collection, deps } = await signedInCollection();
    deps.api.online = false;
    deps.ocr.lines = ["Aroha Ngata"];
    deps.parser.fields = { name: { value: "Aroha Ngata", confidence: 0.7 } };

    const review = await collection.scan(FRONT);
    const card = await collection.saveScan(review, review.fields);

    expect(review).toMatchObject({ parsedBy: "device", fields: { name: "Aroha Ngata" } });
    expect(await collection.get(card.id)).toMatchObject({ parsedBy: "device" });
  });

  it("parses on the device when the cloud Parse fails", async () => {
    const { collection, deps } = await signedInCollection();
    deps.api.parseFails = true;
    deps.ocr.lines = ["Aroha Ngata"];
    deps.parser.fields = { name: { value: "Aroha Ngata", confidence: 0.7 } };

    const review = await collection.scan(FRONT);

    expect(review).toMatchObject({ parsedBy: "device", fields: { name: "Aroha Ngata" } });
  });

  it("parses on the device a card OCR read nothing from, when the Holder isn't signed in", async () => {
    const { collection, deps } = await createTestCollection();
    deps.ocr.lines = [];

    const review = await collection.scan(FRONT);

    expect(review).toMatchObject({ parsedBy: "device", fields: {} });
    expect(deps.api.imageParseCalls).toEqual([]);
  });
});

describe("parsing a stylised card from its photo (vision fallback)", () => {
  it("keeps the photo on the phone when the text Parse is confident", async () => {
    const { collection, deps } = await signedInCollection();
    deps.ocr.lines = ["Aroha Ngata", "aroha@kowhai.example"];
    deps.api.fields = { name: { value: "Aroha Ngata", confidence: 0.97 } };

    await collection.scan(FRONT);

    expect(deps.api.imageParseCalls).toEqual([]);
  });

  it("sends the photo when the API wants it, and offers what the vision Parse found", async () => {
    const { collection, deps } = await signedInCollection();
    deps.ocr.lines = ["AROHA", "aroha@kowhai.example"];
    deps.api.imageWanted = true;
    deps.api.fields = { name: { value: "AROHA", confidence: 0.4 } };
    deps.api.imageFields = {
      name: { value: "Aroha Ngata", confidence: 0.92 },
      company: { value: "Kōwhai Labs", confidence: 0.5 },
    };

    const review = await collection.scan(FRONT);
    const card = await collection.saveScan(review, review.fields);

    expect(deps.api.imageParseCalls).toEqual([FRONT.uri]);
    expect(review).toMatchObject({
      parsedBy: "cloud-vision",
      fields: { name: "Aroha Ngata", company: "Kōwhai Labs" },
      needsChecking: ["company"],
    });
    expect(await collection.get(card.id)).toMatchObject({ parsedBy: "cloud-vision" });
    expect(deps.parser.calls).toEqual([]);
  });

  it("sends the photo when OCR read too little for a text Parse", async () => {
    const { collection, deps } = await signedInCollection();
    deps.ocr.lines = ["AROHA"];
    deps.api.textTooShort = true;
    deps.api.imageFields = { name: { value: "Aroha Ngata", confidence: 0.92 } };

    const review = await collection.scan(FRONT);

    expect(review).toMatchObject({ parsedBy: "cloud-vision", fields: { name: "Aroha Ngata" } });
  });

  it("sends the photo of a card OCR read nothing from, without a text Parse", async () => {
    const { collection, deps } = await signedInCollection();
    deps.ocr.lines = [];
    deps.api.imageFields = { name: { value: "Aroha Ngata", confidence: 0.92 } };

    const review = await collection.scan(FRONT);

    expect(deps.api.parseCalls).toEqual([]);
    expect(deps.api.imageParseCalls).toEqual([FRONT.uri]);
    expect(review).toMatchObject({ parsedBy: "cloud-vision", fields: { name: "Aroha Ngata" } });
  });

  it("keeps the text Parse's fields when the vision Parse fails", async () => {
    const { collection, deps } = await signedInCollection();
    deps.ocr.lines = ["AROHA", "aroha@kowhai.example"];
    deps.api.imageWanted = true;
    deps.api.imageParseFails = true;
    deps.api.fields = { name: { value: "AROHA", confidence: 0.4 } };

    const review = await collection.scan(FRONT);

    expect(review).toMatchObject({ parsedBy: "cloud-text", fields: { name: "AROHA" }, needsChecking: ["name"] });
    expect(deps.parser.calls).toEqual([]);
  });

  it("parses on the device when the vision Parse fails and there was no text Parse", async () => {
    const { collection, deps } = await signedInCollection();
    deps.ocr.lines = ["AROHA"];
    deps.api.textTooShort = true;
    deps.api.imageParseFails = true;
    deps.parser.fields = { name: { value: "Aroha", confidence: 0.5 } };

    const review = await collection.scan(FRONT);

    expect(review).toMatchObject({ parsedBy: "device", fields: { name: "Aroha" } });
  });
});
