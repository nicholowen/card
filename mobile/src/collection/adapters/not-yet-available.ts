import type { ApiClient, OcrAdapter, OnDeviceParser } from "../ports";

// Placeholders until scanning lands. Each later ticket replaces one of these
// with the real adapter (Apple Vision / ML Kit, on-device parsing, the HTTP API).

function notYet(what: string): never {
  throw new Error(`${what} isn't available in this build yet`);
}

export const ocrNotYetAvailable: OcrAdapter = {
  recognise: async () => notYet("Card scanning"),
};

export const onDeviceParserNotYetAvailable: OnDeviceParser = {
  parse: async () => notYet("On-device parsing"),
};

export const apiClientNotYetAvailable: ApiClient = {
  parseCardText: async () => notYet("Cloud parsing"),
};
