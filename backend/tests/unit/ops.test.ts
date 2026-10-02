import { describe, expect, it } from "vitest";
import { isAuthorizedCron } from "@/server/cron";
import { clientIp } from "@/server/http";
import { assertSeedAllowed } from "../../prisma/seed-guard";

describe("cron auth", () => {
  const req = (h?: string) => new Request("http://x/api/cron/reputation", { headers: h ? { authorization: h } : {} });
  const secret = "s3cret-s3cret-s3cret";
  it("requires the exact bearer secret", () => {
    expect(isAuthorizedCron(req(`Bearer ${secret}`), secret)).toBe(true);
    expect(isAuthorizedCron(req(`Bearer ${secret}x`), secret)).toBe(false);
    expect(isAuthorizedCron(req(secret), secret)).toBe(false);
    expect(isAuthorizedCron(req(), secret)).toBe(false);
  });
  it("is closed when no (or a weak) secret is configured", () => {
    expect(isAuthorizedCron(req("Bearer "), "")).toBe(false);
    expect(isAuthorizedCron(req("Bearer short"), "short")).toBe(false);
  });
});

describe("client IP", () => {
  it("uses the first X-Forwarded-For hop, then X-Real-IP", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } }))).toBe("203.0.113.7");
    expect(clientIp(new Request("http://x", { headers: { "x-real-ip": "198.51.100.2" } }))).toBe("198.51.100.2");
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});

describe("production seed guard", () => {
  const local = "postgresql://u:p@localhost:5435/nostos";
  const neon = "postgresql://u:p@ep-cool-123.us-east-2.aws.neon.tech/neondb";
  it("refuses production however it is signalled", () => {
    expect(() => assertSeedAllowed({ APP_ENV: "production", DATABASE_URL: local })).toThrow(/production/);
    expect(() => assertSeedAllowed({ APP_ENV: "Production", DATABASE_URL: local })).toThrow();
    expect(() => assertSeedAllowed({ APP_ENV: "preview", VERCEL_ENV: "production", DATABASE_URL: neon })).toThrow(/VERCEL_ENV/);
  });
  it("fails safe when APP_ENV is missing and the database is remote", () => {
    expect(() => assertSeedAllowed({ DATABASE_URL: neon })).toThrow(/not local/);
    expect(() => assertSeedAllowed({ DATABASE_URL: local, DIRECT_URL: neon })).toThrow(/not local/);
    expect(() => assertSeedAllowed({ APP_ENV: "staging", DATABASE_URL: local })).toThrow(/unknown/);
  });
  it("allows local development and explicit preview", () => {
    expect(() => assertSeedAllowed({ DATABASE_URL: local })).not.toThrow();
    expect(() => assertSeedAllowed({ APP_ENV: "development", DATABASE_URL: local })).not.toThrow();
    const strong = { DEV_SEED_PASSWORD: "a-long-preview-password", APP_REVIEW_PASSWORD: "review-pass-123" };
    expect(() => assertSeedAllowed({ APP_ENV: "preview", VERCEL_ENV: "preview", DATABASE_URL: neon, ...strong })).not.toThrow();
  });
  it("refuses a preview seed with the public dev password or no App Review password", () => {
    const neonUrl = "postgresql://u:p@ep-cool-123.neon.tech/neondb";
    expect(() => assertSeedAllowed({ APP_ENV: "preview", DATABASE_URL: neonUrl })).toThrow(/DEV_SEED_PASSWORD/);
    expect(() => assertSeedAllowed({ APP_ENV: "preview", DATABASE_URL: neonUrl, DEV_SEED_PASSWORD: "lastcall-dev" })).toThrow(/DEV_SEED_PASSWORD/);
    expect(() => assertSeedAllowed({ APP_ENV: "preview", DATABASE_URL: neonUrl, DEV_SEED_PASSWORD: "a-long-preview-password" })).toThrow(/APP_REVIEW_PASSWORD/);
  });
});
