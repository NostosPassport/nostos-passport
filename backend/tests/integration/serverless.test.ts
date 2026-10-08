import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { pruneLoginAttempts } from "@/server/services/auth";
import { GET as cronGet, POST as cronPost } from "@/app/api/cron/maintenance/route";
import { GET as health } from "@/app/api/health/route";
import { GET as uploads } from "@/app/api/uploads/[...key]/route";
import { installMemoryStorage } from "./mem-storage";
import { getStorage } from "@/lib/storage";

const mem = installMemoryStorage();

describe("maintenance", () => {
  it("prunes day-old legacy login-attempt rows", async () => {
    await prisma.loginAttempt.create({ data: { email: "a@x", ip: "1", createdAt: new Date(Date.now() - 2 * 86_400_000) } });
    await prisma.loginAttempt.create({ data: { email: "a@x", ip: "1" } });
    expect(await pruneLoginAttempts(prisma)).toBe(1);
  });
});

describe("cron route", () => {
  const withSecret = (h?: string) => new Request("http://x/api/cron/maintenance", { headers: h ? { authorization: h } : {} });

  it("rejects missing or wrong secrets and runs with the right one", async () => {
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
    const call = (u: string) =>
      uploads(new Request(`http://x${u}`), {
        params: Promise.resolve({ key: new URL(u, "http://x").pathname.replace("/api/uploads/", "").split("/") }),
      });
    expect((await call(signed)).status).toBe(200);
    expect((await call("/api/uploads/photos/aaaa.png")).status).toBe(404);
    expect((await call(signed.replace(/sig=[^&]+/, "sig=forged"))).status).toBe(404);
  });
});
