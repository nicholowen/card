import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startTestApi, type TestApi } from "./harness.ts";

interface Session {
  user: { id: string; email: string; role: string };
}

describe("signing in with an emailed one-time code", () => {
  let api: TestApi;

  beforeEach(async () => {
    api = await startTestApi();
  });

  afterEach(async () => {
    await api.close();
  });

  it("emails a code, and the code signs a new person in as a member", async () => {
    const phone = api.client();

    const sent = await phone.post("/api/auth/email-otp/send-verification-otp", {
      email: "owen@example.com",
      type: "sign-in",
    });
    expect(sent.status).toBe(200);

    const code = api.email.lastCodeFor("owen@example.com");
    const signedIn = await phone.post("/api/auth/sign-in/email-otp", { email: "owen@example.com", otp: code });
    expect(signedIn.status).toBe(200);

    const session = await phone.get<Session | null>("/api/auth/get-session");
    expect(session.body?.user).toMatchObject({ email: "owen@example.com", role: "member" });
  });

  it("rejects a wrong code and leaves the person signed out", async () => {
    const phone = api.client();
    await phone.post("/api/auth/email-otp/send-verification-otp", { email: "owen@example.com", type: "sign-in" });

    const wrongCode = api.email.lastCodeFor("owen@example.com") === "000000" ? "111111" : "000000";
    const attempt = await phone.post("/api/auth/sign-in/email-otp", { email: "owen@example.com", otp: wrongCode });
    expect(attempt.status).toBe(400);

    const session = await phone.get<Session | null>("/api/auth/get-session");
    expect(session.body).toBeNull();
  });

  it("does not let a member make themselves an admin", async () => {
    const phone = api.client();
    await phone.post("/api/auth/email-otp/send-verification-otp", { email: "owen@example.com", type: "sign-in" });
    await phone.post("/api/auth/sign-in/email-otp", {
      email: "owen@example.com",
      otp: api.email.lastCodeFor("owen@example.com"),
    });

    await phone.post("/api/auth/update-user", { role: "admin" });

    const session = await phone.get<Session>("/api/auth/get-session");
    expect(session.body.user.role).toBe("member");
  });

  it("signs a returning person into the same Account", async () => {
    const signIn = async () => {
      const phone = api.client();
      await phone.post("/api/auth/email-otp/send-verification-otp", { email: "owen@example.com", type: "sign-in" });
      await phone.post("/api/auth/sign-in/email-otp", {
        email: "owen@example.com",
        otp: api.email.lastCodeFor("owen@example.com"),
      });
      const session = await phone.get<Session>("/api/auth/get-session");
      return session.body.user.id;
    };

    const firstDevice = await signIn();
    const secondDevice = await signIn();
    expect(secondDevice).toBe(firstDevice);
  });
});
