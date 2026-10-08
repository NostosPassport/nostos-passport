import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createSession, getSessionUser, hashToken } from "@/lib/auth/session";
import { login, signup, startLogin } from "@/server/services/auth";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as signupRoute } from "@/app/api/auth/signup/route";
import { seedEmailChallenge } from "./factories";

function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("auth", () => {
  it("signs up only after a verified email challenge and stores no production password", async () => {
    const challenge = await seedEmailChallenge("A@x.dev", "SIGN_UP");
    const { user, session } = await signup(prisma, {
      ...challenge,
      displayName: "A",
      handle: "aaa",
      acceptTerms: true,
    });

    expect(user.email).toBe("a@x.dev");
    expect(user.handle).toBe("aaa");
    expect(user.passwordHash).toBeNull();
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(user.ageVerifiedAt).toBeInstanceOf(Date);
    expect(await getSessionUser(prisma, session.token)).toMatchObject({ id: user.id });
  });

  it("rejects fields that are not part of the current signup contract", async () => {
    const challenge = await seedEmailChallenge("extra@x.dev", "SIGN_UP");
    await expect(
      signup(prisma, {
        ...challenge,
        displayName: "Extra",
        handle: "extra_user",
        acceptTerms: true,
        role: "ADMIN",
      }),
    ).rejects.toThrow(/Unrecognized key/);
  });

  it("signs in with a one-time email challenge and supports starting by handle", async () => {
    const signupChallenge = await seedEmailChallenge("c@x.dev", "SIGN_UP");
    const { user } = await signup(prisma, {
      ...signupChallenge,
      displayName: "C",
      handle: "alpha.beta_123",
      acceptTerms: true,
    });

    const realKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      const started = await startLogin(prisma, { identifier: user.handle.toUpperCase() }, { ip: "127.0.0.1" });
      expect(started.challengeId).toBeTruthy();
    } finally {
      if (realKey) process.env.RESEND_API_KEY = realKey;
    }

    const loginChallenge = await seedEmailChallenge(user.email, "SIGN_IN", "654321");
    const signedIn = await login(prisma, loginChallenge);
    expect((await getSessionUser(prisma, signedIn.session.token))?.handle).toBe(user.handle);
    await expect(login(prisma, loginChallenge)).rejects.toMatchObject({ status: 400 });
  });

  it("stores only the token hash and expires sessions", async () => {
    const user = await prisma.user.create({ data: { email: "session@x.dev", handle: "session_user", displayName: "Session" } });
    const { token } = await createSession(prisma, user.id);
    expect(await prisma.session.findUnique({ where: { id: hashToken(token) } })).not.toBeNull();
    expect(await prisma.session.findUnique({ where: { id: token } })).toBeNull();
    const later = new Date(Date.now() + 30 * 86_400_000 + 1000);
    expect(await getSessionUser(prisma, token, { now: later })).toBeNull();
  });

  it("returns a bearer token to iOS and an httpOnly SameSite=Lax cookie to web", async () => {
    const signupChallenge = await seedEmailChallenge("route@x.dev", "SIGN_UP");
    const signupRes = await signupRoute(
      jsonRequest("http://localhost/api/auth/signup", { ...signupChallenge, displayName: "Route", handle: "route_user", acceptTerms: true }, { "x-client": "ios" }),
      undefined as never,
    );
    expect(signupRes.status).toBe(201);
    expect(await signupRes.json()).toMatchObject({ token: expect.any(String), user: { handle: "route_user" } });

    const loginChallenge = await seedEmailChallenge("route@x.dev", "SIGN_IN");
    const loginRes = await loginRoute(jsonRequest("http://localhost/api/auth/login", loginChallenge), undefined as never);
    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/lc_session=/);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
  });

  it("rejects cross-origin mutations", async () => {
    const res = await loginRoute(
      jsonRequest(
        "http://localhost/api/auth/login",
        { challengeId: "00000000-0000-0000-0000-000000000000", code: "123456" },
        { origin: "https://evil.example", host: "localhost" },
      ),
      undefined as never,
    );
    expect(res.status).toBe(403);
  });
});

describe("same-origin check", () => {
  const body = { challengeId: "00000000-0000-0000-0000-000000000000", code: "123456" };

  it("allows requests without an Origin header", async () => {
    expect((await loginRoute(jsonRequest("http://localhost/api/auth/login", body, { host: "localhost" }), undefined as never)).status).not.toBe(403);
  });

  it("allows same-origin requests behind the forwarded host", async () => {
    expect(
      (
        await loginRoute(
          jsonRequest("http://localhost/api/auth/login", body, { origin: "https://app.example", host: "internal:3000", "x-forwarded-host": "app.example" }),
          undefined as never,
        )
      ).status,
    ).not.toBe(403);
  });

  it("rejects a malformed Origin", async () => {
    expect((await loginRoute(jsonRequest("http://localhost/api/auth/login", body, { origin: "not a url", host: "localhost" }), undefined as never)).status).toBe(403);
  });
});
