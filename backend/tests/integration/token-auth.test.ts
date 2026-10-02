import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { signup } from "@/server/services/auth";
import { hashToken, SESSION_COOKIE } from "@/lib/auth/session";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as signupRoute } from "@/app/api/auth/signup/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { POST as logoutAllRoute } from "@/app/api/auth/logout-all/route";
import { GET as meRoute } from "@/app/api/me/route";
import { PUT as followRoute } from "@/app/api/users/[handle]/follow/route";
import { makeUser } from "./factories";

const json = (body: unknown, headers: Record<string, string> = {}) =>
  ({ method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }) as RequestInit;
const none = undefined as never;

async function iosLogin(email = "ios@x.dev") {
  await signup(prisma, { email, password: "long enough pw", displayName: "I", handle: email.split("@")[0]!.replace(/\W/g, "_"), acceptTerms: true, birthdate: "1990-05-05" });
  const res = await loginRoute(new Request("http://localhost/api/auth/login", json({ email, password: "long enough pw" }, { "x-client": "ios" })), none);
  return { res, body: (await res.json()) as { token: string; expiresAt: string; user: { handle: string } } };
}

describe("bearer tokens for iOS", () => {
  it("login with X-Client: ios returns { token, user } and sets no cookie; the session is stored hashed as IOS", async () => {
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

  it("signup with X-Client: ios also returns a token; web signup is unchanged (cookie, no token)", async () => {
    const ios = await signupRoute(new Request("http://localhost/api/auth/signup", json({ email: "s1@x.dev", password: "long enough pw", displayName: "S", handle: "s_one", acceptTerms: true, birthdate: "1990-05-05" }, { "x-client": "ios" })), none);
    expect(ios.status).toBe(201);
    expect((await ios.json()).token).toBeTruthy();
    const web = await signupRoute(new Request("http://localhost/api/auth/signup", json({ email: "s2@x.dev", password: "long enough pw", displayName: "S", handle: "s_two", acceptTerms: true, birthdate: "1990-05-05" })), none);
    expect(web.headers.get("set-cookie")).toMatch(/lc_session=/);
    expect((await web.json()).token).toBeUndefined();
  });

  it("GET /api/me works with a bearer token and returns role and settings", async () => {
    const { body } = await iosLogin();
    const res = await meRoute(new Request("http://localhost/api/me", { headers: { authorization: `Bearer ${body.token}` } }), none);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ user: { handle: "ios", role: "USER" }, settings: { geofenceExempt: false } });
    expect((await meRoute(new Request("http://localhost/api/me"), none)).status).toBe(401);
  });

  it("a bad bearer token is unauthenticated even when a valid cookie is also sent", async () => {
    const { body } = await iosLogin();
    const res = await meRoute(new Request("http://localhost/api/me", { headers: { authorization: "Bearer not-a-real-token-000000000", cookie: `${SESSION_COOKIE}=${body.token}` } }), none);
    expect(res.status).toBe(401);
  });
});

describe("CSRF check applies to cookie auth only", () => {
  it("bearer requests from any Origin are accepted; the same cookie request from a foreign Origin is rejected", async () => {
    const target = await makeUser({ isPrivate: false });
    const { body } = await iosLogin();
    const ctx = { params: Promise.resolve({ handle: target.handle }) };
    const url = `http://localhost/api/users/${target.handle}/follow`;
    const put = (headers: Record<string, string>) => new Request(url, { method: "PUT", headers });
    const viaBearer = await followRoute(put({ authorization: `Bearer ${body.token}`, origin: "https://evil.example", host: "localhost" }), ctx);
    expect(viaBearer.status).toBe(200);
    const viaCookie = await followRoute(put({ cookie: `${SESSION_COOKIE}=${body.token}`, origin: "https://evil.example", host: "localhost" }), ctx);
    expect(viaCookie.status).toBe(403);
  });
});

describe("logout", () => {
  it("revokes only the current session; logout-all revokes every session", async () => {
    const { body: a } = await iosLogin();
    const second = await loginRoute(new Request("http://localhost/api/auth/login", json({ email: "ios@x.dev", password: "long enough pw" }, { "x-client": "ios" })), none);
    const b = (await second.json()) as { token: string };
    const auth = (t: string) => ({ authorization: `Bearer ${t}` });

    expect((await logoutRoute(new Request("http://localhost/api/auth/logout", { method: "POST", headers: auth(a.token) }), none)).status).toBe(200);
    expect((await meRoute(new Request("http://localhost/api/me", { headers: auth(a.token) }), none)).status).toBe(401);
    expect((await meRoute(new Request("http://localhost/api/me", { headers: auth(b.token) }), none)).status).toBe(200);

    const third = (await (await loginRoute(new Request("http://localhost/api/auth/login", json({ email: "ios@x.dev", password: "long enough pw" })), none)).json()) as object;
    expect(third).not.toHaveProperty("token");
    const before = await prisma.session.count(); // signup's session + b + the web login
    expect(before).toBe(3);
    const res = await logoutAllRoute(new Request("http://localhost/api/auth/logout-all", { method: "POST", headers: auth(b.token) }), none);
    expect(await res.json()).toMatchObject({ ok: true, revoked: before });
    expect((await meRoute(new Request("http://localhost/api/me", { headers: auth(b.token) }), none)).status).toBe(401);
    expect(await prisma.session.count()).toBe(0);
  });
});

describe("token hardening", () => {
  const me = (headers: Record<string, string>) => meRoute(new Request("http://localhost/api/me", { headers }), none);

  it("an expired bearer token gets 401 invalid_token with WWW-Authenticate, and the row is deleted", async () => {
    const u = await prisma.user.create({ data: { email: "e@x.dev", handle: "eee", displayName: "e", passwordHash: "x" } });
    const { createSession } = await import("@/lib/auth/session");
    const { token } = await createSession(prisma, u.id, { client: "IOS", now: new Date(Date.now() - 91 * 86_400_000) });
    const res = await me({ authorization: `Bearer ${token}` });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "invalid_token" });
    expect(res.headers.get("www-authenticate")).toMatch(/invalid_token/);
    expect(await prisma.session.count({ where: { userId: u.id } })).toBe(0);
  });

  it("a dead bearer token is rejected on public routes too (no silent anonymous fallback)", async () => {
    const { GET: places } = await import("@/app/api/places/route");
    expect((await places(new Request("http://localhost/api/places"), none)).status).toBe(200);
    expect((await places(new Request("http://localhost/api/places", { headers: { authorization: "Bearer revoked-token-revoked-token-000" } }), none)).status).toBe(401);
  });

  it("accepts the auth scheme case-insensitively", async () => {
    const { body } = await iosLogin();
    expect((await me({ authorization: `bearer ${body.token}` })).status).toBe(200);
    expect((await me({ authorization: `BEARER   ${body.token}` })).status).toBe(200);
  });

  it("binds tokens to their channel: iOS tokens aren't cookies and web tokens aren't bearer tokens", async () => {
    const { body } = await iosLogin();
    expect((await me({ cookie: `${SESSION_COOKIE}=${body.token}` })).status).toBe(401);
    const web = await loginRoute(new Request("http://localhost/api/auth/login", json({ email: "ios@x.dev", password: "long enough pw" })), none);
    const cookieToken = /lc_session=([^;]+)/.exec(web.headers.get("set-cookie") ?? "")![1]!;
    const row = await prisma.session.findUniqueOrThrow({ where: { id: hashToken(cookieToken) } });
    expect(row.client).toBe("WEB");
    const ttlDays = (row.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(ttlDays).toBeGreaterThan(29);
    expect(ttlDays).toBeLessThanOrEqual(30);
    expect((await me({ authorization: `Bearer ${cookieToken}` })).status).toBe(401);
    expect((await me({ cookie: `${SESSION_COOKIE}=${cookieToken}` })).status).toBe(200);
  });

  it("X-Client matching tolerates case and whitespace", async () => {
    await signup(prisma, { email: "w@x.dev", password: "long enough pw", displayName: "W", handle: "www", acceptTerms: true, birthdate: "1990-05-05" });
    const res = await loginRoute(new Request("http://localhost/api/auth/login", json({ email: "w@x.dev", password: "long enough pw" }, { "x-client": " IOS " })), none);
    expect((await res.json()).token).toBeTruthy();
  });

  it("an invalid bearer with a foreign Origin gets 401, not a CSRF pass", async () => {
    const target = await makeUser({ isPrivate: false });
    const res = await followRoute(
      new Request(`http://localhost/api/users/${target.handle}/follow`, { method: "PUT", headers: { authorization: "Bearer forged-token-forged-token-000", origin: "https://evil.example", host: "localhost" } }),
      { params: Promise.resolve({ handle: target.handle }) },
    );
    expect(res.status).toBe(401);
    expect(await prisma.follow.count()).toBe(0);
  });

  it("logout: 401 for a dead bearer; cookie logout revokes the cookie session", async () => {
    const dead = await logoutRoute(new Request("http://localhost/api/auth/logout", { method: "POST", headers: { authorization: "Bearer dead-token-dead-token-dead-00" } }), none);
    expect(dead.status).toBe(401);
    await signup(prisma, { email: "c@x.dev", password: "long enough pw", displayName: "C", handle: "ccc", acceptTerms: true, birthdate: "1990-05-05" });
    const web = await loginRoute(new Request("http://localhost/api/auth/login", json({ email: "c@x.dev", password: "long enough pw" })), none);
    const cookieToken = /lc_session=([^;]+)/.exec(web.headers.get("set-cookie") ?? "")![1]!;
    const out = await logoutRoute(new Request("http://localhost/api/auth/logout", { method: "POST", headers: { cookie: `${SESSION_COOKIE}=${cookieToken}` } }), none);
    expect(out.status).toBe(200);
    expect(await prisma.session.findUnique({ where: { id: hashToken(cookieToken) } })).toBeNull();
  });
});
