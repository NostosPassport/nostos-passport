import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createSession, getSessionUser, hashToken } from "@/lib/auth/session";
import { login, signup } from "@/server/services/auth";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as signupRoute } from "@/app/api/auth/signup/route";

const VALID_PASSWORD = "long enough pw1";

function signupRequest(body: Record<string, unknown>) {
  return signupRoute(
    new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json", "x-client": "ios" },
      body: JSON.stringify(body),
    }),
    undefined as never,
  );
}

describe("auth", () => {
  it("signs up as USER only and stores a scrypt hash, never the password", async () => {
    const { user } = await signup(prisma, { email: "A@x.dev", password: VALID_PASSWORD, displayName: "A", handle: "aaa", acceptTerms: true, birthdate: "1990-05-05" });
    expect(user.role).toBe("USER");
    expect(user.email).toBe("a@x.dev");
    expect(user.passwordHash).toMatch(/^scrypt\$/);
    expect(user.passwordHash).not.toContain(VALID_PASSWORD);
    expect(user.reputation).toBe(0.5);
  });

  it("rejects role escalation in the signup payload", async () => {
    await expect(
      signup(prisma, { email: "b@x.dev", password: VALID_PASSWORD, displayName: "B", handle: "bbb", role: "MODERATOR" } as never),
    ).rejects.toThrow();
  });

  it("enforces signup restrictions at the HTTP boundary", async () => {
    const base = { email: "rules@x.dev", password: VALID_PASSWORD, displayName: "Rules", handle: "rules.ok", acceptTerms: true, birthdate: "1990-05-05" };
    const invalid = [
      { ...base, email: "not-an-email" },
      { ...base, password: "abcdefghij" },
      { ...base, password: "1234567890" },
      { ...base, handle: "ab" },
      { ...base, handle: "a".repeat(31) },
      { ...base, handle: "bad-handle" },
      { ...base, displayName: "" },
      { ...base, acceptTerms: false },
      { ...base, birthdate: "not-a-date" },
      { ...base, role: "ADMIN" },
    ];

    for (const body of invalid) {
      const res = await signupRequest(body);
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({ error: "invalid_input" });
    }
  });

  it("accepts the current handle rules and logs in by email or username", async () => {
    const handle = "alpha.beta_123";
    await signup(prisma, { email: "c@x.dev", password: VALID_PASSWORD, displayName: "C", handle, acceptTerms: true, birthdate: "1990-05-05" });
    await expect(login(prisma, { email: "c@x.dev", password: "nope nope nope" })).rejects.toMatchObject({ status: 401 });

    const byEmail = await login(prisma, { email: "c@x.dev", password: VALID_PASSWORD });
    expect((await getSessionUser(prisma, byEmail.session.token))?.email).toBe("c@x.dev");

    const byHandle = await login(prisma, { email: handle.toUpperCase(), password: VALID_PASSWORD });
    expect((await getSessionUser(prisma, byHandle.session.token))?.handle).toBe(handle);

    const routeRes = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-client": "ios" },
        body: JSON.stringify({ email: handle, password: VALID_PASSWORD }),
      }),
      undefined as never,
    );
    expect(routeRes.status).toBe(200);
  });

  it("throttles repeated failures", async () => {
    await signup(prisma, { email: "d@x.dev", password: VALID_PASSWORD, displayName: "D", handle: "ddd", acceptTerms: true, birthdate: "1990-05-05" });
    for (let i = 0; i < 10; i++) await login(prisma, { email: "d@x.dev", password: "wrong" }).catch(() => {});
    await expect(login(prisma, { email: "d@x.dev", password: VALID_PASSWORD })).rejects.toMatchObject({ status: 429 });
  });

  it("stores only the token hash and expires sessions", async () => {
    const { user } = await signup(prisma, { email: "e@x.dev", password: VALID_PASSWORD, displayName: "E", handle: "eee", acceptTerms: true, birthdate: "1990-05-05" });
    const { token } = await createSession(prisma, user.id);
    const row = await prisma.session.findUnique({ where: { id: hashToken(token) } });
    expect(row).not.toBeNull();
    expect(await prisma.session.findUnique({ where: { id: token } })).toBeNull();
    const later = new Date(Date.now() + 30 * 86_400_000 + 1000);
    expect(await getSessionUser(prisma, token, { now: later })).toBeNull();
  });

  it("login route sets an httpOnly SameSite=Lax cookie", async () => {
    await signup(prisma, { email: "f@x.dev", password: VALID_PASSWORD, displayName: "F", handle: "fff", acceptTerms: true, birthdate: "1990-05-05" });
    const res = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "f@x.dev", password: VALID_PASSWORD }),
      }),
      undefined as never,
    );
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/lc_session=/);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
  });

  it("rejects cross-origin mutations", async () => {
    const res = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://evil.example", host: "localhost" },
        body: JSON.stringify({ email: "x@x.dev", password: "whatever" }),
      }),
      undefined as never,
    );
    expect(res.status).toBe(403);
  });
});

describe("same-origin check", () => {
  const call = (headers: Record<string, string>) =>
    loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({ email: "nobody@x.dev", password: "whatever" }),
      }),
      undefined as never,
    );

  it("allows requests without an Origin header (non-browser clients)", async () => {
    expect((await call({ host: "localhost" })).status).toBe(401);
  });
  it("allows same-origin requests, including behind a proxy host header", async () => {
    expect((await call({ origin: "http://localhost:3000", host: "localhost:3000" })).status).toBe(401);
    expect((await call({ origin: "https://app.example", host: "internal:3000", "x-forwarded-host": "app.example" })).status).toBe(401);
  });
  it("rejects a malformed Origin", async () => {
    expect((await call({ origin: "not a url", host: "localhost" })).status).toBe(403);
  });
});
