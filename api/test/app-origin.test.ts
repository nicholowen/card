import { afterEach, describe, expect, it } from "vitest";
import { startTestApi, type TestApi, type TestClient } from "./harness.ts";

interface Session {
  user: { email: string };
}

async function signIn(api: TestApi, phone: TestClient, email: string) {
  const sent = await phone.post("/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
  if (sent.status !== 200) return sent;
  return phone.post("/api/auth/sign-in/email-otp", { email, otp: api.email.lastCodeFor(email) });
}

describe("signing in from the mobile app", () => {
  let api: TestApi;

  afterEach(async () => {
    await api.close();
  });

  it("accepts the dev build's card:// origin, before and after it holds a session", async () => {
    api = await startTestApi();
    const phone = api.appClient("card://192.168.1.20:8081");

    expect((await signIn(api, phone, "owen@example.com")).status).toBe(200);
    // A second sign-in sends the stored session cookie, which makes Better Auth check the origin.
    expect((await signIn(api, phone, "owen@example.com")).status).toBe(200);

    const session = await phone.get<Session>("/api/auth/get-session");
    expect(session.body.user.email).toBe("owen@example.com");
  });

  it("accepts Expo Go's exp:// origin in development", async () => {
    api = await startTestApi({ development: true });
    const phone = api.appClient("exp://192.168.1.20:8081");

    expect((await signIn(api, phone, "owen@example.com")).status).toBe(200);
    expect((await signIn(api, phone, "owen@example.com")).status).toBe(200);
  });

  it("rejects Expo Go's exp:// origin outside development", async () => {
    api = await startTestApi({ development: false });
    const phone = api.appClient("exp://192.168.1.20:8081");

    await signIn(api, phone, "owen@example.com");
    const withCookie = await signIn(api, phone, "owen@example.com");
    expect(withCookie.status).toBe(403);
  });
});
