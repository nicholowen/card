import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { createAdaptorServer } from "@hono/node-server";
import pg from "pg";
import { createApp } from "../src/app.ts";
import { migrate } from "../src/migrate.ts";
import { FakeEmailSender, FakeLlmProvider, InMemoryObjectStorage } from "./fakes.ts";

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

  // The auth base URL must be the real listening address, which is only known
  // once the server is bound, so the app is created after listen().
  let handle: (request: Request) => Response | Promise<Response> = () => new Response(null, { status: 503 });
  const server = createAdaptorServer({ fetch: (request) => handle(request) });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const app = createApp({
    pool,
    ports: { email, llm, storage },
    authSecret: randomBytes(32).toString("base64"),
    baseURL: baseUrl,
    trustedOrigins: [baseUrl],
    development: options.development ?? false,
  });
  handle = (request) => app.fetch(request);

  return {
    baseUrl,
    email,
    llm,
    storage,
    client: () => new TestClient(baseUrl, { origin: baseUrl }),
    appClient: (appOrigin) => new TestClient(baseUrl, { "expo-origin": appOrigin }),
    async close() {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await dropSchema();
    },
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

  private async request<T>(method: string, path: string, body?: unknown): Promise<TestResponse<T>> {
    const headers: Record<string, string> = { ...this.originHeaders };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (this.cookies.size > 0) {
      headers.cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
    }

    const response = await fetch(this.baseUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    for (const setCookie of response.headers.getSetCookie()) {
      const [pair] = setCookie.split(";");
      const separator = pair!.indexOf("=");
      const name = pair!.slice(0, separator);
      const value = pair!.slice(separator + 1);
      if (value === "") this.cookies.delete(name);
      else this.cookies.set(name, value);
    }

    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
  }
}
