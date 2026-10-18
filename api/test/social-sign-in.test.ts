import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startTestApi, type TestApi, type TestClient } from "./harness.ts";

interface Session {
  user: { id: string; email: string; name: string; role: string };
}

/** What the app sends after native sign-in: the provider's ID token, no cookie. */
function signInWithIdToken(
  phone: TestClient,
  provider: "google" | "apple",
  idToken: { token: string; nonce?: string; user?: { name?: { firstName?: string; lastName?: string } } },
) {
  return phone.post("/api/auth/sign-in/social", { provider, idToken });
}

async function accountIdOf(phone: TestClient) {
  const session = await phone.get<Session | null>("/api/auth/get-session");
  return session.body?.user.id ?? null;
}

async function signInWithEmailCode(api: TestApi, phone: TestClient, email: string) {
  await phone.post("/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
  await phone.post("/api/auth/sign-in/email-otp", { email, otp: api.email.lastCodeFor(email) });
}

describe("signing in with Google or Apple", () => {
  let api: TestApi;

  beforeEach(async () => {
    api = await startTestApi();
  });

  afterEach(async () => {
    await api.close();
  });

  it("creates a member Account the first time someone signs in with Google", async () => {
    const phone = api.appClient("card://");
    const token = api.identity.issue("google", {
      subject: "google-owen",
      email: "owen@example.com",
      emailVerified: true,
      name: "Owen Nicholson",
    });

    const signedIn = await signInWithIdToken(phone, "google", { token });
    expect(signedIn.status).toBe(200);

    const session = await phone.get<Session>("/api/auth/get-session");
    expect(session.body.user).toMatchObject({ email: "owen@example.com", name: "Owen Nicholson", role: "member" });
  });

  it("signs a returning Google user into the same Account on another device", async () => {
    const identity = { subject: "google-owen", email: "owen@example.com", emailVerified: true, name: "Owen" };

    const firstPhone = api.appClient("card://");
    await signInWithIdToken(firstPhone, "google", { token: api.identity.issue("google", identity) });
    const secondPhone = api.appClient("card://");
    await signInWithIdToken(secondPhone, "google", { token: api.identity.issue("google", identity) });

    const first = await accountIdOf(firstPhone);
    expect(first).not.toBeNull();
    expect(await accountIdOf(secondPhone)).toBe(first);
  });

  it("creates an Account from Apple, taking the name Apple only shares on the first sign-in", async () => {
    const identity = { subject: "apple-owen", email: "x7k2@privaterelay.appleid.com", emailVerified: true };

    const firstPhone = api.appClient("card://");
    const first = await signInWithIdToken(firstPhone, "apple", {
      token: api.identity.issue("apple", identity, { nonce: "first-nonce" }),
      nonce: "first-nonce",
      user: { name: { firstName: "Owen", lastName: "Nicholson" } },
    });
    expect(first.status).toBe(200);
    const firstSession = await firstPhone.get<Session>("/api/auth/get-session");
    expect(firstSession.body.user).toMatchObject({
      email: "x7k2@privaterelay.appleid.com",
      name: "Owen Nicholson",
      role: "member",
    });

    // Later sign-ins carry no name, and must land in the same Account without losing it.
    const secondPhone = api.appClient("card://");
    await signInWithIdToken(secondPhone, "apple", {
      token: api.identity.issue("apple", identity, { nonce: "second-nonce" }),
      nonce: "second-nonce",
    });
    const secondSession = await secondPhone.get<Session>("/api/auth/get-session");
    expect(secondSession.body.user.id).toBe(firstSession.body.user.id);
    expect(secondSession.body.user.name).toBe("Owen Nicholson");
  });

  it("rejects a token the provider didn't issue and leaves the person signed out", async () => {
    const phone = api.appClient("card://");

    const attempt = await signInWithIdToken(phone, "google", { token: "forged-token" });
    expect(attempt.status).toBe(401);
    expect(await accountIdOf(phone)).toBeNull();
  });

  it("rejects an Apple token presented with a different nonce", async () => {
    const phone = api.appClient("card://");
    const token = api.identity.issue(
      "apple",
      { subject: "apple-owen", email: "owen@example.com", emailVerified: true },
      { nonce: "issued-nonce" },
    );

    const attempt = await signInWithIdToken(phone, "apple", { token, nonce: "replayed-nonce" });
    expect(attempt.status).toBe(401);
    expect(await accountIdOf(phone)).toBeNull();
  });

  it("signs into the existing email-code Account when Google has verified the same email", async () => {
    const emailPhone = api.client();
    await signInWithEmailCode(api, emailPhone, "owen@example.com");
    const existing = await accountIdOf(emailPhone);

    const googlePhone = api.appClient("card://");
    await signInWithIdToken(googlePhone, "google", {
      token: api.identity.issue("google", { subject: "google-owen", email: "owen@example.com", emailVerified: true }),
    });

    expect(await accountIdOf(googlePhone)).toBe(existing);
  });

  it("doesn't take over an email-code Account when the provider hasn't verified the email", async () => {
    const emailPhone = api.client();
    await signInWithEmailCode(api, emailPhone, "owen@example.com");

    const attacker = api.appClient("card://");
    const attempt = await signInWithIdToken(attacker, "google", {
      token: api.identity.issue("google", { subject: "google-other", email: "owen@example.com", emailVerified: false }),
    });

    expect(attempt.status).toBe(401);
    expect(await accountIdOf(attacker)).toBeNull();
  });

  it("still signs in with an email code after the same person has used Google", async () => {
    const googlePhone = api.appClient("card://");
    await signInWithIdToken(googlePhone, "google", {
      token: api.identity.issue("google", { subject: "google-owen", email: "owen@example.com", emailVerified: true }),
    });

    const emailPhone = api.client();
    await signInWithEmailCode(api, emailPhone, "owen@example.com");

    expect(await accountIdOf(emailPhone)).toBe(await accountIdOf(googlePhone));
  });
});

describe("starting a browser sign-in from the app", () => {
  let api: TestApi;

  beforeEach(async () => {
    api = await startTestApi();
  });

  afterEach(async () => {
    await api.close();
  });

  it.each([
    ["google", "https://accounts.google.com/"],
    ["apple", "https://appleid.apple.com/"],
  ] as const)("sends the browser to %s with this API as the callback", async (provider, authorizeOrigin) => {
    const phone = api.appClient("card://");

    const started = await phone.post<{ url: string; redirect: boolean }>("/api/auth/sign-in/social", {
      provider,
      callbackURL: "card:///",
    });

    expect(started.status).toBe(200);
    expect(started.body.redirect).toBe(true);
    const authorize = new URL(started.body.url);
    expect(authorize.href.startsWith(authorizeOrigin)).toBe(true);
    expect(authorize.searchParams.get("redirect_uri")).toBe(`${api.baseUrl}/api/auth/callback/${provider}`);
  });

  it("refuses to start a sign-in with a provider the server isn't configured for", async () => {
    await api.close();
    api = await startTestApi({ socialProviders: { google: false, apple: false } });
    const phone = api.appClient("card://");

    const started = await phone.post("/api/auth/sign-in/social", { provider: "google", callbackURL: "card:///" });
    expect(started.status).toBe(404);
  });
});
