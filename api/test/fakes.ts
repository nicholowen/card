import type {
  EmailSender,
  LlmProvider,
  ObjectStorage,
  OneTimeCodePurpose,
  ParsedFields,
} from "../src/ports.ts";

export class FakeEmailSender implements EmailSender {
  readonly sent: { to: string; code: string; purpose: OneTimeCodePurpose }[] = [];

  async sendOneTimeCode(message: { to: string; code: string; purpose: OneTimeCodePurpose }) {
    this.sent.push(message);
  }

  /** The most recent code emailed to this address. */
  lastCodeFor(to: string): string {
    const message = this.sent.findLast((m) => m.to === to.toLowerCase());
    if (!message) throw new Error(`No code was emailed to ${to}`);
    return message.code;
  }
}

export class FakeLlmProvider implements LlmProvider {
  textResponse: ParsedFields = {};
  imageResponse: ParsedFields = {};
  readonly calls: ({ kind: "text"; text: string } | { kind: "image"; mimeType: string })[] = [];

  async parseCardText({ text }: { text: string }) {
    this.calls.push({ kind: "text", text });
    return this.textResponse;
  }

  async parseCardImage({ mimeType }: { image: Uint8Array; mimeType: string }) {
    this.calls.push({ kind: "image", mimeType });
    return this.imageResponse;
  }
}

export class InMemoryObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, { body: Uint8Array; contentType: string }>();

  async put(key: string, body: Uint8Array, contentType: string) {
    this.objects.set(key, { body, contentType });
  }

  async get(key: string) {
    return this.objects.get(key) ?? null;
  }

  async deletePrefix(prefix: string) {
    for (const key of [...this.objects.keys()]) {
      if (key.startsWith(prefix)) this.objects.delete(key);
    }
  }
}
