import type { ApiClient } from "../ports";

// A placeholder until cloud Parse lands and replaces it with the HTTP API client.

function notYet(what: string): never {
  throw new Error(`${what} isn't available in this build yet`);
}

export const apiClientNotYetAvailable: ApiClient = {
  parseCardText: async () => notYet("Cloud parsing"),
};
