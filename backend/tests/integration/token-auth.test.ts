import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createSession, hashToken, SESSION_COOKIE } from "@/lib/auth/session";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as signupRoute } from "@/app/api/auth/signup/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { POST as logoutAllRoute } from "@/app/api/auth/logout-all/route";
import { GET as meRoute } from "@/app/api/me/route";
import { PATCH as profileRoute } from "@/app/api/me/profile/route";
import { seedEmailChallenge } from "./factories";

const none = undefined as never;
const json = (body: unknown, headers: Record<string, string> = {}) =>
  ({ method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }) as RequestInit;

async function ensureUser(email: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const handle = email.split("@")[0]!.replace(/\W/g, "_");
  return prisma.user.create({ data: { email, handle, displayName: handle } });
}

async function iosLogin(email = "ios@x.dev") {
  const user = await ensureUser(email);
  const challenge = await seedEmailChallenge(email, "SIGN_IN");
  const res = await loginRoute(new Request("http://localhost/api/auth/login", json(challenge, { "x-client": "ios" })), none);
  return { user, res, body: (await res.json()) as { token: string; expiresAt: string; user: { handle: string } } };
}

describe("bearer tokens for iOS", () => {
  it("returns a bearer token with no cookie and stores only its hash as an IOS session", async () => {
    const { res, body } = await iosLogin();
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(body.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(body.user.handle).toBe("ios");
    const row = await prisma.session.findUniqueOrThrow({ where: { id: hashToken(body.token) } });
    expect(row.client).toBe("IOS");
    expect(await prisma.session.findUnique({ where: { id: body.token } })).toBeNull();
    expect(row.expiresAt.getTime() - Date.now()).toBeGreaterThan(80 * 86_400_000);
  });

  it("signup returns a token to iOS and a cookie to web", async () => {
    const iosChallenge = await seedEmailChallenge("s1@x.dev", "SIGN_UP");
    const ios = await signupRoute(
      new Request("http://localhost/api/auth/signup", json({ ...iosChallenge, displayName: "S1", handle: "s_one", acceptTerms: true }, { "x-client": "ios" })),
      none,
    );
    expect(ios.status).toBe(201);
    expect((await ios.json()).token).toBeTruthy();
    expect(ios.headers.get("set-cookie")).toBeNull();

    const webChallenge = await seedEmailChallenge("s2@x.dev", "SIGN_UP");
    const web = await signupRoute(
      new Request("http://localhost/api/auth/signup", json({ ...webChallenge, displayName: "S2", handle: "s_two", acceptTerms: true })),
      none,
    );
    expect(web.status).toBe(201);
    expect(web.headers.get("set-cookie")).toMatch(/lc_session=/);
    expect((await web.json()).token).toBeUndefined();
  });

  it("GET /api/me works with a bearer token and returns current settings", async () => {
    const { body } = await iosLogin();
    const res = await meRoute(new Request("http://localhost/api/me", { headers: { authorization: `Bearer ${body.token}` } }), none);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ user: { handle: "ios" }, settings: { geofenceExempt: false } });
    expect((await meRoute(new Request("http://localhost/api/me"), none)).status).toBe(401);
  });

  it("a bad bearer token is unauthenticated even when a cookie is also present", async () => {
    const { body } = await iosLogin();
    const res = await meRoute(
      new Request("http://localhost/api/me", {
        headers: { authorization: "Bearer not-a-real-token-000000000", cookie: `${SESSION_COOKIE}=${body.token}` },
      }),
      none,
    );
    expect(res.status).toBe(401);
  });
});

describe("CSRF check applies to cookie auth only", () => {
  it("accepts a bearer mutation from any Origin but rejects a foreign-Origin cookie mutation", async () => {
    const { user, body } = await iosLogin();
    const url = "http://localhost/api/me/profile";
    const bearer = await profileRoute(
      new Request(url, {
        method: "PATCH",
        headers: { authorization: `Bearer ${body.token}`, origin: "https://evil.example", host: "localhost", "content-type": "application/json" },
        body: JSON.stringify({ bio: "bearer update" }),
      }),
      none,
    );
    expect(bearer.status).toBe(200);

    const web = await createSession(prisma, user.id, { client: "WEB" });
    const cookie = await profileRoute(
      new Request(url, {
        method: "PATCH",
        headers: { cookie: `${SESSION_COOKIE}=${web.token}`, origin: "https://evil.example", host: "localhost", "content-type": "application/json" },
        body: JSON.stringify({ bio: "cookie update" }),
      }),
      none,
    );
    expect(cookie.status).toBe(403);
  });
});

describe("logout", () => {
  it("revokes only the current session; logout-all revokes every session", async () => {
    const { user, body: a } = await iosLogin();
    const b = await createSession(prisma, user.id, { client: "IOS" });
    const web = await createSession(prisma, user.id, { client: "WEB" });
    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    expect((await logoutRoute(new Request("http://localhost/api/auth/logout", { method: "POST", headers: auth(a.token) }), none)).status).toBe(200);
    expect((await meRoute(new Request("http://localhost/api/me", { headers: auth(a.token) }), none)).status).toBe(401);
    expect((await meRoute(new Request("http://localhost/api/me", { headers: auth(b.token) }), none)).status).toBe(200);

    const before = await prisma.session.count({ where: { userId: user.id } });
    expect(before).toBe(2);
    expect(web.token).toBeTruthy();
    const res = await logoutAllRoute(new Request("http://localhost/api/auth/logout-all", { method: "POST", headers: auth(b.token) }), none);
    expect(await res.json()).toMatchObject({ ok: true, revoked: before });
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("token hardening", () => {
  const me = (headers: Record<string, string>) => meRoute(new Request("http://localhost/api/me", { headers }), none);

  it("an expired bearer token gets invalid_token and its row is deleted", async () => {
    const user = await ensureUser("expired@x.dev");
    const { token } = await createSession(prisma, user.id, { client: "IOS", now: new Date(Date.now() - 91 * 86_400_000) });
    const res = await me({ authorization: `Bearer ${token}` });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "invalid_token" });
    expect(res.headers.get("www-authenticate")).toMatch(/invalid_token/);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("rejects a dead bearer token on otherwise public routes", async () => {
    const { GET: places } = await import("@/app/api/places/route");
    expect((await places(new Request("http://localhost/api/places"), none)).status).toBe(200);
    expect((await places(new Request("http://localhost/api/places", { headers: { authorization: "Bearer revoked-token-revoked-token-000" } }), none)).status).toBe(401);
  });

  it("accepts the bearer scheme case-insensitively", async () => {
    const { body } = await iosLogin();
    expect((await me({ authorization: `bearer ${body.token}` })).status).toBe(200);
    expect((await me({ authorization: `BEARER   ${body.token}` })).status).toBe(200);
  });

  it("binds tokens to their session channel", async () => {
    const { user, body } = await iosLogin();
    expect((await me({ cookie: `${SESSION_COOKIE}=${body.token}` })).status).toBe(401);

    const web = await createSession(prisma, user.id, { client: "WEB" });
    const row = await prisma.session.findUniqueOrThrow({ where: { id: hashToken(web.token) } });
    expect(row.client).toBe("WEB");
    expect((await me({ authorization: `Bearer ${web.token}` })).status).toBe(401);
    expect((await me({ cookie: `${SESSION_COOKIE}=${web.token}` })).status).toBe(200);
  });

  it("X-Client matching tolerates case and whitespace", async () => {
    await ensureUser("whitespace@x.dev");
    const challenge = await seedEmailChallenge("whitespace@x.dev", "SIGN_IN");
    const res = await loginRoute(new Request("http://localhost/api/auth/login", json(challenge, { "x-client": " IOS " })), none);
    expect((await res.json()).token).toBeTruthy();
  });

  it("an invalid bearer on a mutation gets 401 before CSRF handling", async () => {
    const res = await profileRoute(
      new Request("http://localhost/api/me/profile", {
        method: "PATCH",
        headers: { authorization: "Bearer forged-token-forged-token-000", origin: "https://evil.example", host: "localhost", "content-type": "application/json" },
        body: JSON.stringify({ bio: "x" }),
      }),
      none,
    );
    expect(res.status).toBe(401);
  });

  it("logout returns 401 for a dead bearer and revokes a cookie session", async () => {
    const dead = await logoutRoute(
      new Request("http://localhost/api/auth/logout", { method: "POST", headers: { authorization: "Bearer dead-token-dead-token-dead-00" } }),
      none,
    );
    expect(dead.status).toBe(401);

    const user = await ensureUser("cookie@x.dev");
    const web = await createSession(prisma, user.id, { client: "WEB" });
    const out = await logoutRoute(
      new Request("http://localhost/api/auth/logout", { method: "POST", headers: { cookie: `${SESSION_COOKIE}=${web.token}` } }),
      none,
    );
    expect(out.status).toBe(200);
    expect(await prisma.session.findUnique({ where: { id: hashToken(web.token) } })).toBeNull();
  });
});
