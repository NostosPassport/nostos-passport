import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { login, signup, pruneLoginAttempts } from "@/server/services/auth";
import { GET as cronGet, POST as cronPost } from "@/app/api/cron/maintenance/route";
import { GET as health } from "@/app/api/health/route";
import { GET as uploads } from "@/app/api/uploads/[...key]/route";
import { installMemoryStorage } from "./mem-storage";
import { getStorage } from "@/lib/storage";

const mem = installMemoryStorage();

describe("login throttle (Postgres, email + IP)", () => {
  it("locks one IP after 10 failures without locking the same account from another IP", async () => {
    await signup(prisma, { email: "t@x.dev", password: "long enough pw", displayName: "T", handle: "ttt", acceptTerms: true, confirm21: true });
    for (let i = 0; i < 10; i++) await login(prisma, { email: "t@x.dev", password: "nope" }, { ip: "203.0.113.9" }).catch(() => {});
    await expect(login(prisma, { email: "t@x.dev", password: "long enough pw" }, { ip: "203.0.113.9" })).rejects.toMatchObject({ status: 429 });
    await expect(login(prisma, { email: "t@x.dev", password: "long enough pw" }, { ip: "198.51.100.1" })).resolves.toBeTruthy();
    expect(await prisma.loginAttempt.count({ where: { ip: "203.0.113.9" } })).toBe(10);
  });

  it("expires after 15 minutes and clears on success", async () => {
    await signup(prisma, { email: "u@x.dev", password: "long enough pw", displayName: "U", handle: "uuu", acceptTerms: true, confirm21: true });
    const t0 = new Date();
    for (let i = 0; i < 10; i++) await login(prisma, { email: "u@x.dev", password: "nope" }, { ip: "1.1.1.1" }, t0).catch(() => {});
    const later = new Date(t0.getTime() + 15 * 60_000 + 1);
    await login(prisma, { email: "u@x.dev", password: "long enough pw" }, { ip: "1.1.1.1" }, later);
    expect(await prisma.loginAttempt.count({ where: { email: "u@x.dev" } })).toBe(0);
  });

  it("can't be raced: parallel wrong guesses stop at the limit", async () => {
    await signup(prisma, { email: "r@x.dev", password: "long enough pw", displayName: "R", handle: "rrr", acceptTerms: true, confirm21: true });
    const results = await Promise.allSettled(Array.from({ length: 25 }, () => login(prisma, { email: "r@x.dev", password: "nope" }, { ip: "9.9.9.9" })));
    expect(results.filter((r) => r.status === "rejected" && (r.reason as { status: number }).status === 401)).toHaveLength(10);
    expect(await prisma.loginAttempt.count({ where: { email: "r@x.dev" } })).toBe(10);
  });

  it("caps failures per IP across many emails", async () => {
    for (let i = 0; i < 50; i++) await prisma.loginAttempt.create({ data: { email: `spray${i}@x.dev`, ip: "6.6.6.6" } });
    await expect(login(prisma, { email: "fresh@x.dev", password: "x" }, { ip: "6.6.6.6" })).rejects.toMatchObject({ status: 429 });
    await expect(login(prisma, { email: "not-an-email", password: "x" }, { ip: "7.7.7.7" })).rejects.toThrow();
    expect(await prisma.loginAttempt.count({ where: { ip: "7.7.7.7" } })).toBe(0);
  });

  it("prunes day-old attempts", async () => {
    await prisma.loginAttempt.create({ data: { email: "a@x", ip: "1", createdAt: new Date(Date.now() - 2 * 86_400_000) } });
    await prisma.loginAttempt.create({ data: { email: "a@x", ip: "1" } });
    expect(await pruneLoginAttempts(prisma)).toBe(1);
  });
});

describe("cron route", () => {
  const withSecret = (h?: string) => new Request("http://x/api/cron/maintenance", { headers: h ? { authorization: h } : {} });
  it("rejects missing or wrong secrets and runs with the right one (GET for Vercel Cron, POST manually)", async () => {
    process.env.CRON_SECRET = "test-cron-secret-123456";
    expect((await cronGet(withSecret())).status).toBe(401);
    expect((await cronGet(withSecret("Bearer wrong"))).status).toBe(401);
    const res = await cronGet(withSecret("Bearer test-cron-secret-123456"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, prunedLoginAttempts: expect.any(Number), prunedRateEvents: expect.any(Number) });
    expect((await cronPost(withSecret("Bearer test-cron-secret-123456"))).status).toBe(200);
  });
});

describe("health", () => {
  it("reports the database as up", async () => {
    const res = await health();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, db: "up" });
  });
});

describe("upload route requires a valid signature", () => {
  it("serves signed URLs only", async () => {
    mem.set("photos/aaaa.png", Buffer.from([0x89, 0x50]));
    const signed = await getStorage().signedUrl("photos/aaaa.png");
    const call = (u: string) => uploads(new Request(`http://x${u}`), { params: Promise.resolve({ key: new URL(u, "http://x").pathname.replace("/api/uploads/", "").split("/") }) });
    expect((await call(signed)).status).toBe(200);
    expect((await call("/api/uploads/photos/aaaa.png")).status).toBe(404);
    expect((await call(signed.replace(/sig=[^&]+/, "sig=forged"))).status).toBe(404);
  });
});
