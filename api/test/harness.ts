import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { createAdaptorServer } from "@hono/node-server";
import pg from "pg";
import { createApp } from "../src/app.ts";
import { migrate } from "../src/migrate.ts";
import type { SocialProvidersConfig } from "../src/auth.ts";
import type { VisionFallbackThresholds } from "../src/parse.ts";
import { FakeEmailSender, FakeIdentityProviders, FakeLlmProvider, InMemoryObjectStorage } from "./fakes.ts";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5432/card_test";

/**
 * A running API backed by its own fresh Postgres schema, with every outside
 * service replaced by an in-process fake. Each test gets its own instance.
 */
export interface TestApi {
  baseUrl: string;
  email: FakeEmailSender;
  llm: FakeLlmProvider;
  storage: InMemoryObjectStorage;
  /** Stands in for Google and Apple: issues the ID tokens the app would get from native sign-in. */
  identity: FakeIdentityProviders;
  /** A new HTTP client with its own cookie jar, like a separate device. */
  client(): TestClient;
  /**
   * A client that talks like the mobile app: Better Auth's Expo client sends
   * no Origin header, only `expo-origin` with the app's deep-link URL
   * (e.g. `card://192.168.1.20:8081` in a dev build, `exp://…` in Expo Go).
   */
  appClient(appOrigin: string): TestClient;
  close(): Promise<void>;
}

export interface TestApiOptions {
  /** Run with development settings (trusts Expo Go). Defaults to production-like. */
  development?: boolean;
  /** Which social providers the server is configured for. Both are on by default. */
  socialProviders?: { google?: boolean; apple?: boolean };
  /** When a text Parse asks for the card's image. Defaults to the API's own defaults. */
  visionFallback?: VisionFallbackThresholds;
}

/** Placeholder credentials: real ones are only needed to talk to Google and Apple, which tests never do. */
function testSocialProviders(enabled: TestApiOptions["socialProviders"] = {}): SocialProvidersConfig {
  return {
    ...(enabled.google !== false && {
      google: { clientId: "test-google-client-id", clientSecret: "test-google-client-secret" },
    }),
    ...(enabled.apple !== false && {
      apple: {
        serviceId: "test.apple.service-id",
        clientSecret: "test-apple-client-secret",
        appBundleIdentifier: "com.owennicholson.card",
      },
    }),
  };
}

export async function startTestApi(options: TestApiOptions = {}): Promise<TestApi> {
  const schema = `test_${randomBytes(6).toString("hex")}`;

  const admin = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.end();

  const pool = new pg.Pool({
    connectionString: TEST_DATABASE_URL,
    options: `-c search_path=${schema}`,
  });
  const dropSchema = async () => {
    await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await pool.end();
  };
  try {
    await migrate(pool);
  } catch (error) {
    await dropSchema();
    throw error;
  }

  const email = new FakeEmailSender();
  const llm = new FakeLlmProvider();
  const storage = new InMemoryObjectStorage();
  const identity = new FakeIdentityProviders();
  const restoreFetch = routeProviderTokenRequestsTo(identity);

  // The auth base URL must be the real listening address, which is only known
  // once the server is bound, so the app is created after listen().
  let handle: (request: Request) => Response | Promise<Response> = () => new Response(null, { status: 503 });
  const server = createAdaptorServer({ fetch: (request) => handle(request) });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const app = createApp({
    pool,
    ports: { email, llm, storage, identityTokens: identity },
    authSecret: randomBytes(32).toString("base64"),
    baseURL: baseUrl,
    trustedOrigins: [baseUrl],
    development: options.development ?? false,
    socialProviders: testSocialProviders(options.socialProviders),
    visionFallback: options.visionFallback,
  });
  handle = (request) => app.fetch(request);

  return {
    baseUrl,
    email,
    llm,
    storage,
    identity,
    client: () => new TestClient(baseUrl, { origin: baseUrl }),
    appClient: (appOrigin) => new TestClient(baseUrl, { "expo-origin": appOrigin }),
    async close() {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      restoreFetch();
      await dropSchema();
    },
  };
}

/**
 * The API exchanges browser sign-in codes with Google and Apple over HTTPS.
 * Tests run the API in-process, so those requests are answered by the fake
 * instead of leaving the machine. Every other request goes through untouched.
 */
function routeProviderTokenRequestsTo(identity: FakeIdentityProviders): () => void {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const answered = await identity.answerTokenRequest(request.url, await request.clone().text());
    return answered ?? realFetch(input, init);
  };
  return () => {
    globalThis.fetch = realFetch;
  };
}

export interface TestResponse<T = unknown> {
  status: number;
  body: T;
}

/** A minimal HTTP client that keeps cookies between requests, as the app would. */
export class TestClient {
  private readonly cookies = new Map<string, string>();

  constructor(
    private readonly baseUrl: string,
    private readonly originHeaders: Record<string, string>,
  ) {}

  get<T = unknown>(path: string) {
    return this.request<T>("GET", path);
  }

  post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("POST", path, body);
  }

  /** A multipart upload, as the app sends a card's photo. */
  async postForm<T = unknown>(path: string, form: FormData): Promise<TestResponse<T>> {
    return this.read<T>(await this.send("POST", path, form, "follow"));
  }

  /** A GET that reports a redirect instead of following it, as a browser handing back to the app would. */
  async getWithoutFollowing(path: string): Promise<{ status: number; location: string | null }> {
    const response = await this.send("GET", path, undefined, "manual");
    await response.body?.cancel();
    return { status: response.status, location: response.headers.get("location") };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<TestResponse<T>> {
    return this.read<T>(await this.send(method, path, body, "follow"));
  }

  private async read<T>(response: Response): Promise<TestResponse<T>> {
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
  }

  private async send(method: string, path: string, body: unknown, redirect: RequestRedirect): Promise<Response> {
    const headers: Record<string, string> = { ...this.originHeaders };
    const form = body instanceof FormData;
    // fetch sets a multipart body's content type itself, with its boundary.
    if (body !== undefined && !form) headers["content-type"] = "application/json";
    if (this.cookies.size > 0) {
      headers.cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
    }

    const response = await fetch(this.baseUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : form ? body : JSON.stringify(body),
      redirect,
    });

    for (const setCookie of response.headers.getSetCookie()) {
      const [pair] = setCookie.split(";");
      const separator = pair!.indexOf("=");
      const name = pair!.slice(0, separator);
      const value = pair!.slice(separator + 1);
      if (value === "") this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return response;
  }
}
