import type { ApiClient, CloudParse } from "../ports";

/**
 * How long a cloud Parse may take before the Collection gives up and parses on
 * the device. Venue signal is often weak (ADR 0006), and a Holder at an event
 * shouldn't watch a spinner for long.
 */
const PARSE_TIMEOUT_MS = 8000;

/** Thrown when an API request doesn't succeed, with the HTTP status (0 when it never got an answer). */
export class ApiRequestFailed extends Error {
  constructor(
    readonly path: string,
    readonly status: number,
    cause?: unknown,
  ) {
    super(status ? `${path} answered ${status}` : `${path} didn't answer`, { cause });
    this.name = "ApiRequestFailed";
  }
}

/**
 * The API over HTTP, as the signed-in Account. Requests carry the session
 * cookie Better Auth's Expo client keeps in secure storage; `credentials:
 * "omit"` stops React Native's own cookie jar from sending a stale one too.
 */
export function httpApiClient({ baseUrl, cookie }: { baseUrl: string; cookie: () => Promise<string> }): ApiClient {
  async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(baseUrl + path, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: await cookie() },
        body: JSON.stringify(body),
        credentials: "omit",
        signal: controller.signal,
      });
      if (!response.ok) throw new ApiRequestFailed(path, response.status);
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ApiRequestFailed) throw error;
      throw new ApiRequestFailed(path, 0, error);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    parseCardText: (text) => post<CloudParse>("/api/parse", { text }, PARSE_TIMEOUT_MS),
  };
}
