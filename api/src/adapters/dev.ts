import type { EmailSender, LlmProvider, ObjectStorage } from "../ports.ts";

/** Development email sender: prints sign-in codes to the API's console instead of emailing them. */
export const consoleEmailSender: EmailSender = {
  async sendOneTimeCode({ to, code, purpose }) {
    console.log(`[email] ${purpose} code for ${to}: ${code}`);
  },
};

function notConfigured(port: string): never {
  throw new Error(`${port} is not configured yet`);
}

/** Placeholder until the Parse ticket picks a provider (ADR 0004). */
export const unconfiguredLlmProvider: LlmProvider = {
  parseCardText: async () => notConfigured("LLM provider"),
  parseCardImage: async () => notConfigured("LLM provider"),
};

/** Placeholder until card images are stored. */
export const unconfiguredObjectStorage: ObjectStorage = {
  put: async () => notConfigured("Object storage"),
  get: async () => notConfigured("Object storage"),
  deletePrefix: async () => notConfigured("Object storage"),
};
