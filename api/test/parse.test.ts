import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startTestApi, type TestApi, type TestClient } from "./harness.ts";

interface ParseResponse {
  parsedBy: string | null;
  imageWanted?: boolean;
  fields: Record<string, { value: string; confidence: number }>;
}

const CARD_TEXT = "Aroha Ngata\nCTO\nKōwhai Labs\naroha@kowhai.example\n021 555 0199";

async function signIn(api: TestApi, email: string): Promise<TestClient> {
  const phone = api.appClient("card://");
  await phone.post("/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
  await phone.post("/api/auth/sign-in/email-otp", { email, otp: api.email.lastCodeFor(email) });
  return phone;
}

describe("parsing a Scan's recognised text in the cloud", () => {
  let api: TestApi;

  beforeEach(async () => {
    api = await startTestApi();
  });

  afterEach(async () => {
    await api.close();
  });

  it("sends the recognised text to the LLM and returns its fields, each with its Field Confidence", async () => {
    const phone = await signIn(api, "owen@example.com");
    api.llm.textResponse = {
      name: { value: "Aroha Ngata", confidence: 0.97 },
      jobTitle: { value: "CTO", confidence: 0.55 },
      company: { value: "Kōwhai Labs", confidence: 0.82 },
      email: { value: "aroha@kowhai.example", confidence: 0.99 },
      phone: { value: "021 555 0199", confidence: 0.93 },
      "social:LinkedIn": { value: "arohangata", confidence: 0.7 },
    };

    const parsed = await phone.post<ParseResponse>("/api/parse", { text: CARD_TEXT });

    expect(parsed.status).toBe(200);
    expect(parsed.body).toEqual({
      parsedBy: "cloud-text",
      imageWanted: false,
      fields: {
        name: { value: "Aroha Ngata", confidence: 0.97 },
        jobTitle: { value: "CTO", confidence: 0.55 },
        company: { value: "Kōwhai Labs", confidence: 0.82 },
        email: { value: "aroha@kowhai.example", confidence: 0.99 },
        phone: { value: "021 555 0199", confidence: 0.93 },
        "social:LinkedIn": { value: "arohangata", confidence: 0.7 },
      },
    });
    expect(api.llm.calls).toEqual([{ kind: "text", text: CARD_TEXT }]);
  });

  it("returns only card fields with a value, and keeps each Field Confidence between 0 and 1", async () => {
    const phone = await signIn(api, "owen@example.com");
    api.llm.textResponse = {
      name: { value: "  Aroha Ngata ", confidence: 1.4 },
      company: { value: "Kōwhai Labs", confidence: -0.2 },
      email: { value: "", confidence: 0.9 },
      phone: { value: "021 555 0199", confidence: Number.NaN },
      favouriteColour: { value: "Green", confidence: 0.9 },
      "social:": { value: "nobody", confidence: 0.9 },
      "social:Instagram": { value: "aroha.makes", confidence: 0.6 },
      website: { value: 42, confidence: 0.9 } as unknown as { value: string; confidence: number },
    };

    const parsed = await phone.post<ParseResponse>("/api/parse", { text: CARD_TEXT });

    expect(parsed.body.fields).toEqual({
      name: { value: "Aroha Ngata", confidence: 1 },
      company: { value: "Kōwhai Labs", confidence: 0 },
      phone: { value: "021 555 0199", confidence: 0 },
      "social:Instagram": { value: "aroha.makes", confidence: 0.6 },
    });
  });

  it.each([
    ["no text", {}],
    ["blank text", { text: "  \n " }],
    ["text that isn't a string", { text: ["Aroha"] }],
    ["more text than a business card holds", { text: "Aroha Ngata ".repeat(500) }],
  ])("rejects %s without calling the LLM or metering it", async (_case, body) => {
    const phone = await signIn(api, "owen@example.com");

    const parsed = await phone.post("/api/parse", body);

    expect(parsed.status).toBe(400);
    expect(api.llm.calls).toEqual([]);
    expect((await phone.get("/api/parse/usage")).body).toEqual({ "cloud-text": 0, "cloud-vision": 0 });
  });

  it("reports a failed LLM call, so the app can parse on the device instead", async () => {
    const phone = await signIn(api, "owen@example.com");
    api.llm.failure = new Error("provider overloaded");

    const parsed = await phone.post("/api/parse", { text: CARD_TEXT });

    expect(parsed.status).toBe(502);
    expect(parsed.body).toEqual({ error: "parse-failed" });
  });

  it("refuses someone who isn't signed in, without calling the LLM", async () => {
    const phone = api.appClient("card://");

    const parsed = await phone.post("/api/parse", { text: CARD_TEXT });

    expect(parsed.status).toBe(401);
    expect(api.llm.calls).toEqual([]);
  });
});

describe("asking for the card's image when the text Parse is unsure (vision fallback)", () => {
  let api: TestApi;

  afterEach(async () => {
    await api.close();
  });

  it("asks for the image when the fields' overall Field Confidence is below the threshold, and still returns them", async () => {
    api = await startTestApi();
    const phone = await signIn(api, "owen@example.com");
    api.llm.textResponse = {
      name: { value: "Aroha Ngata", confidence: 0.7 },
      company: { value: "KOWHAI", confidence: 0.3 },
    };

    const parsed = await phone.post<ParseResponse>("/api/parse", { text: CARD_TEXT });

    expect(parsed.status).toBe(200);
    expect(parsed.body).toEqual({
      parsedBy: "cloud-text",
      imageWanted: true,
      fields: {
        name: { value: "Aroha Ngata", confidence: 0.7 },
        company: { value: "KOWHAI", confidence: 0.3 },
      },
    });
  });

  it("asks for the image when the text Parse found no fields at all", async () => {
    api = await startTestApi();
    const phone = await signIn(api, "owen@example.com");
    api.llm.textResponse = {};

    const parsed = await phone.post<ParseResponse>("/api/parse", { text: CARD_TEXT });

    expect(parsed.body).toEqual({ parsedBy: "cloud-text", imageWanted: true, fields: {} });
  });

  it("asks for the image straight away when OCR read too little text, without calling the LLM or metering it", async () => {
    api = await startTestApi();
    const phone = await signIn(api, "owen@example.com");

    const parsed = await phone.post<ParseResponse>("/api/parse", { text: "  AROHA\n" });

    expect(parsed.status).toBe(200);
    expect(parsed.body).toEqual({ parsedBy: null, imageWanted: true });
    expect(api.llm.calls).toEqual([]);
    expect((await phone.get("/api/parse/usage")).body).toEqual({ "cloud-text": 0, "cloud-vision": 0 });
  });

  it("uses the thresholds the API is configured with", async () => {
    api = await startTestApi({ visionFallback: { belowConfidence: 0.9, belowTextLength: 3 } });
    const phone = await signIn(api, "owen@example.com");
    api.llm.textResponse = { name: { value: "Aroha Ngata", confidence: 0.85 } };

    const short = await phone.post<ParseResponse>("/api/parse", { text: "AROHA" });

    expect(short.body).toEqual({
      parsedBy: "cloud-text",
      imageWanted: true,
      fields: { name: { value: "Aroha Ngata", confidence: 0.85 } },
    });
    expect(api.llm.calls).toEqual([{ kind: "text", text: "AROHA" }]);
  });
});

/** A card's photo as the app uploads it: a JPEG file in the `image` part of a form. */
function photoForm(bytes = 2048, type = "image/jpeg"): FormData {
  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(bytes).fill(0xff)], { type }), "card.jpg");
  return form;
}

describe("parsing a card from its image with a vision model", () => {
  let api: TestApi;

  beforeEach(async () => {
    api = await startTestApi();
  });

  afterEach(async () => {
    await api.close();
  });

  it("sends the image to the vision model and returns its fields as parsed from the image", async () => {
    const phone = await signIn(api, "owen@example.com");
    api.llm.imageResponse = {
      name: { value: "Aroha Ngata", confidence: 0.92 },
      company: { value: "Kōwhai Labs", confidence: 1.3 },
      favouriteColour: { value: "Green", confidence: 0.9 },
    };

    const parsed = await phone.postForm<ParseResponse>("/api/parse/image", photoForm());

    expect(parsed.status).toBe(200);
    expect(parsed.body).toEqual({
      parsedBy: "cloud-vision",
      fields: {
        name: { value: "Aroha Ngata", confidence: 0.92 },
        company: { value: "Kōwhai Labs", confidence: 1 },
      },
    });
    expect(api.llm.calls).toEqual([{ kind: "image", image: new Uint8Array(2048).fill(0xff), mimeType: "image/jpeg" }]);
  });

  it("meters a vision Parse separately from text Parses", async () => {
    const phone = await signIn(api, "owen@example.com");
    api.llm.textResponse = { name: { value: "AROHA", confidence: 0.3 } };
    api.llm.imageResponse = { name: { value: "Aroha Ngata", confidence: 0.92 } };

    await phone.post("/api/parse", { text: CARD_TEXT });
    await phone.postForm("/api/parse/image", photoForm());

    expect((await phone.get("/api/parse/usage")).body).toEqual({ "cloud-text": 1, "cloud-vision": 1 });
  });

  it("reports and meters a failed vision call, so the app can fall back", async () => {
    const phone = await signIn(api, "owen@example.com");
    api.llm.failure = new Error("provider overloaded");

    const parsed = await phone.postForm("/api/parse/image", photoForm());

    expect(parsed.status).toBe(502);
    expect(parsed.body).toEqual({ error: "parse-failed" });
    expect((await phone.get("/api/parse/usage")).body).toEqual({ "cloud-text": 0, "cloud-vision": 1 });
  });

  it.each([
    ["no image", () => new FormData(), 400, "no-image"],
    ["an empty image", () => photoForm(0), 400, "no-image"],
    ["a file that isn't a photo", () => photoForm(2048, "application/pdf"), 400, "unsupported-image-type"],
    ["a photo larger than the vision model accepts", () => photoForm(4 * 1024 * 1024), 413, "image-too-large"],
  ])("rejects %s without calling the LLM or metering it", async (_case, form, status, error) => {
    const phone = await signIn(api, "owen@example.com");

    const parsed = await phone.postForm("/api/parse/image", form());

    expect(parsed).toEqual({ status, body: { error } });
    expect(api.llm.calls).toEqual([]);
    expect((await phone.get("/api/parse/usage")).body).toEqual({ "cloud-text": 0, "cloud-vision": 0 });
  });

  it("refuses someone who isn't signed in, without calling the LLM", async () => {
    const parsed = await api.appClient("card://").postForm("/api/parse/image", photoForm());

    expect(parsed.status).toBe(401);
    expect(api.llm.calls).toEqual([]);
  });
});

describe("metering Parse calls per Account", () => {
  let api: TestApi;

  beforeEach(async () => {
    api = await startTestApi();
  });

  afterEach(async () => {
    await api.close();
  });

  it("counts each Account's cloud Parses separately", async () => {
    api.llm.textResponse = { name: { value: "Aroha Ngata", confidence: 0.9 } };
    const owen = await signIn(api, "owen@example.com");
    const aroha = await signIn(api, "aroha@example.com");

    await owen.post("/api/parse", { text: CARD_TEXT });
    await owen.post("/api/parse", { text: CARD_TEXT });
    await aroha.post("/api/parse", { text: CARD_TEXT });

    expect((await owen.get("/api/parse/usage")).body).toEqual({ "cloud-text": 2, "cloud-vision": 0 });
    expect((await aroha.get("/api/parse/usage")).body).toEqual({ "cloud-text": 1, "cloud-vision": 0 });
  });

  it("counts a call the LLM provider failed, since the provider may still charge for it", async () => {
    const owen = await signIn(api, "owen@example.com");
    api.llm.failure = new Error("provider overloaded");

    await owen.post("/api/parse", { text: CARD_TEXT });

    expect((await owen.get("/api/parse/usage")).body).toEqual({ "cloud-text": 1, "cloud-vision": 0 });
  });

  it("starts a new Account at zero", async () => {
    const owen = await signIn(api, "owen@example.com");

    expect((await owen.get("/api/parse/usage")).body).toEqual({ "cloud-text": 0, "cloud-vision": 0 });
  });

  it("only shows usage to a signed-in Account", async () => {
    const usage = await api.appClient("card://").get("/api/parse/usage");

    expect(usage.status).toBe(401);
  });
});
