import { describe, expect, it } from "vitest";
import { heuristicParser } from "../src/collection/adapters/heuristic-parser";
import type { ParsedFields, RecognisedText } from "../src/collection/ports";

/**
 * A card as OCR reads it: each line with its text height as a fraction of the
 * card's height, stacked top to bottom.
 */
function card(...lines: Array<string | [string, number]>): RecognisedText {
  let y = 0.05;
  return {
    lines: lines.map((line) => {
      const [text, height] = typeof line === "string" ? [line, 0.05] : line;
      const box = { x: 0.08, y, width: 0.6, height };
      y += height + 0.03;
      return { text, box };
    }),
  };
}

/** Just the values, for asserting on what was found. */
function values(fields: ParsedFields): Record<string, string> {
  return Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value]));
}

describe("the on-device heuristic parser", () => {
  it("finds the email, phone and website by their patterns, and is confident about them", async () => {
    const parsed = await heuristicParser.parse(
      card("aroha@kowhai.example", "+64 21 555 0199", "www.kowhai.example"),
    );

    expect(values(parsed)).toEqual({
      email: "aroha@kowhai.example",
      phone: "+64 21 555 0199",
      website: "www.kowhai.example",
    });
    for (const field of Object.values(parsed)) expect(field.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("reads past labels, skips the fax number and prefers the mobile number", async () => {
    const parsed = await heuristicParser.parse(
      card("T: (04) 555 0100", "Fax: (04) 555 0101", "Mobile: 021 555 0199", "Email: Aroha@Kowhai.example"),
    );

    expect(values(parsed)).toEqual({ phone: "021 555 0199", email: "aroha@kowhai.example" });
  });

  it("takes the largest person-shaped line as the name, and finds the job title and company by their wording", async () => {
    const parsed = await heuristicParser.parse(
      card(
        ["Kōwhai Labs Ltd", 0.07],
        ["Aroha Ngata", 0.09],
        "Chief Technology Officer",
        "021 555 0199",
      ),
    );

    expect(values(parsed)).toMatchObject({
      name: "Aroha Ngata",
      jobTitle: "Chief Technology Officer",
      company: "Kōwhai Labs Ltd",
    });
    expect(parsed.jobTitle!.confidence).toBeGreaterThanOrEqual(0.6);
    expect(parsed.company!.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("is confident about the name when the email address agrees with it, and finds the company from the email's domain", async () => {
    const parsed = await heuristicParser.parse(
      card(["KŌWHAI", 0.12], ["Aroha Ngata", 0.06], "Head of Product", "aroha.ngata@kowhai.example"),
    );

    expect(values(parsed)).toMatchObject({ name: "Aroha Ngata", jobTitle: "Head of Product", company: "KŌWHAI" });
    expect(parsed.name!.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("flags its guesses with low confidence when nothing on the card backs them up", async () => {
    const parsed = await heuristicParser.parse(card(["Mere Tawhiri", 0.08], "Something Creative", "hello@studio.example"));

    expect(values(parsed)).toMatchObject({ name: "Mere Tawhiri" });
    expect(parsed.name!.confidence).toBeGreaterThanOrEqual(0.6);
    for (const key of ["jobTitle", "company"] as const) {
      if (parsed[key]) expect(parsed[key]!.confidence).toBeLessThan(0.6);
    }
  });

  it("joins a street address printed over several lines", async () => {
    const parsed = await heuristicParser.parse(
      card(["Aroha Ngata", 0.08], "Level 3, 12 Cuba Street", "Te Aro, Wellington 6011", "New Zealand"),
    );

    expect(values(parsed)).toMatchObject({
      name: "Aroha Ngata",
      address: "Level 3, 12 Cuba Street, Te Aro, Wellington 6011, New Zealand",
    });
    expect(parsed.company).toBeUndefined();
  });

  it("stops the address at the next contact detail", async () => {
    const parsed = await heuristicParser.parse(card("12 Cuba Street", "Wellington 6011", "+64 4 555 0100", "PO Box 9, Auckland 1140"));

    expect(values(parsed)).toEqual({ address: "12 Cuba Street, Wellington 6011", phone: "+64 4 555 0100" });
  });

  it("reads social profile links as social handles rather than the website", async () => {
    const parsed = await heuristicParser.parse(
      card("kowhai.example", "linkedin.com/in/arohangata", "instagram.com/aroha.makes"),
    );

    expect(values(parsed)).toEqual({
      website: "kowhai.example",
      "social:LinkedIn": "arohangata",
      "social:Instagram": "aroha.makes",
    });
  });

  it("reads a busy card with everything on it", async () => {
    const parsed = await heuristicParser.parse(
      card(
        ["TUI DIGITAL", 0.1],
        ["MERE TAWHIRI", 0.07],
        "Senior Software Engineer",
        "P +64 4 555 0100",
        "M +64 27 555 0123",
        "E mere.t@tuidigital.example",
        "tuidigital.example",
        "Level 2, 40 Lambton Quay, Wellington 6011",
        "linkedin.com/in/meretawhiri",
      ),
    );

    expect(values(parsed)).toEqual({
      company: "TUI DIGITAL",
      name: "MERE TAWHIRI",
      jobTitle: "Senior Software Engineer",
      phone: "+64 27 555 0123",
      email: "mere.t@tuidigital.example",
      website: "tuidigital.example",
      address: "Level 2, 40 Lambton Quay, Wellington 6011",
      "social:LinkedIn": "meretawhiri",
    });
    expect(parsed.name!.confidence).toBeGreaterThanOrEqual(0.8);
    expect(parsed.company!.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("finds nothing on a card it couldn't read", async () => {
    expect(await heuristicParser.parse({ lines: [] })).toEqual({});
  });

  it("doesn't mistake an email's domain or a street number for a website or phone", async () => {
    const parsed = await heuristicParser.parse(card("aroha@kowhai.example", "Level 3, 12 Cuba Street"));

    expect(parsed.website).toBeUndefined();
    expect(parsed.phone).toBeUndefined();
  });
});
