import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createSession, getSessionUser, hashToken } from "@/lib/auth/session";
import { login, signup } from "@/server/services/auth";
import { POST as loginRoute } from "@/app/api/auth/login/route";

describe("auth", () => {
  it("signs up as USER only and stores a scrypt hash, never the password", async () => {
    const { user } = await signup(prisma, { email: "A@x.dev", password: "long enough pw", displayName: "A", handle: "aaa", acceptTerms: true, birthdate: "1990-05-05" });
    expect(user.role).toBe("USER");
    expect(user.email).toBe("a@x.dev");
    expect(user.passwordHash).toMatch(/^scrypt\$/);
    expect(user.passwordHash).not.toContain("long enough pw");
    expect(user.reputation).toBe(0.5);
  });

  it("rejects role escalation in the signup payload", async () => {
    await expect(
      signup(prisma, { email: "b@x.dev", password: "long enough pw", displayName: "B", handle: "bbb", role: "MODERATOR" } as never),
    ).rejects.toThrow();
  });

  it("logs in with the right password and rejects the wrong one", async () => {
    await signup(prisma, { email: "c@x.dev", password: "long enough pw", displayName: "C", handle: "ccc", acceptTerms: true, birthdate: "1990-05-05" });
    await expect(login(prisma, { email: "c@x.dev", password: "nope nope nope" })).rejects.toMatchObject({ status: 401 });
    const { session } = await login(prisma, { email: "c@x.dev", password: "long enough pw" });
    expect((await getSessionUser(prisma, session.token))?.email).toBe("c@x.dev");
  });

  it("throttles repeated failures", async () => {
    await signup(prisma, { email: "d@x.dev", password: "long enough pw", displayName: "D", handle: "ddd", acceptTerms: true, birthdate: "1990-05-05" });
    for (let i = 0; i < 10; i++) await login(prisma, { email: "d@x.dev", password: "wrong" }).catch(() => {});
    await expect(login(prisma, { email: "d@x.dev", password: "long enough pw" })).rejects.toMatchObject({ status: 429 });
  });

  it("stores only the token hash and expires sessions", async () => {
    const { user } = await signup(prisma, { email: "e@x.dev", password: "long enough pw", displayName: "E", handle: "eee", acceptTerms: true, birthdate: "1990-05-05" });
    const { token } = await createSession(prisma, user.id);
    const row = await prisma.session.findUnique({ where: { id: hashToken(token) } });
    expect(row).not.toBeNull();
    expect(await prisma.session.findUnique({ where: { id: token } })).toBeNull();
    const later = new Date(Date.now() + 30 * 86_400_000 + 1000);
    expect(await getSessionUser(prisma, token, { now: later })).toBeNull();
  });

  it("login route sets an httpOnly SameSite=Lax cookie", async () => {
    await signup(prisma, { email: "f@x.dev", password: "long enough pw", displayName: "F", handle: "fff", acceptTerms: true, birthdate: "1990-05-05" });
    const res = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "f@x.dev", password: "long enough pw" }),
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
