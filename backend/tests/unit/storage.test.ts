import { describe, expect, it } from "vitest";
import { S3Client } from "@aws-sdk/client-s3";
import { LocalDiskStorage, R2Storage, SIGNED_URL_MIN_TTL_S, storageFromEnv, verifyLocalSignature } from "@/lib/storage";

const NOW = new Date("2026-09-26T03:32:10Z");

describe("local signed URLs", () => {
  const s = new LocalDiskStorage("/tmp/none");
  const parse = (u: string) => {
    const url = new URL(u, "http://x");
    return { key: url.pathname.replace("/api/uploads/", ""), exp: url.searchParams.get("exp"), sig: url.searchParams.get("sig") };
  };

  it("are valid for at least 15 minutes and at most 20", async () => {
    const { key, exp, sig } = parse(await s.signedUrl("photos/abc.png", NOW));
    const ttl = Number(exp) - NOW.getTime() / 1000;
    expect(ttl).toBeGreaterThanOrEqual(SIGNED_URL_MIN_TTL_S);
    expect(ttl).toBeLessThanOrEqual(20 * 60);
    expect(verifyLocalSignature(key, exp, sig, NOW)).toBe(true);
    expect(verifyLocalSignature(key, exp, sig, new Date(Number(exp) * 1000))).toBe(false);
  });

  it("are stable within a 5-minute bucket (cacheable) and change across buckets", async () => {
    const a = await s.signedUrl("photos/abc.png", NOW);
    expect(await s.signedUrl("photos/abc.png", new Date(NOW.getTime() + 60_000))).toBe(a);
    expect(await s.signedUrl("photos/abc.png", new Date(NOW.getTime() + 5 * 60_000))).not.toBe(a);
  });

  it("can't be reused for another key or a longer expiry", async () => {
    const { exp, sig } = parse(await s.signedUrl("photos/abc.png", NOW));
    expect(verifyLocalSignature("photos/other.png", exp, sig, NOW)).toBe(false);
    expect(verifyLocalSignature("photos/abc.png", String(Number(exp) + 3600), sig, NOW)).toBe(false);
    expect(verifyLocalSignature("photos/abc.png", exp, null, NOW)).toBe(false);
  });
});

describe("R2 storage", () => {
  const cfg = { accountId: "acct123", accessKeyId: "AKIDTEST", secretAccessKey: "secret", bucket: "nostos-photos" };

  it("presigns private GET URLs against the R2 endpoint with a 20-minute expiry", async () => {
    const url = new URL(await new R2Storage(cfg).signedUrl("photos/abc.jpg", NOW));
    expect(url.host).toBe("nostos-photos.acct123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/photos/abc.jpg");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("1200");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
    expect(url.searchParams.get("X-Amz-Date")).toBe("20260926T033000Z"); // floored to the 5-minute bucket
  });

  it("uploads with the right bucket, key and content type", async () => {
    const sent: { input: Record<string, unknown> }[] = [];
    const fake = { send: async (cmd: { input: Record<string, unknown> }) => void sent.push(cmd) } as unknown as S3Client;
    await new R2Storage(cfg, fake).put("photos/abc.jpg", Buffer.from("x"), "image/jpeg");
    expect(sent[0]!.input).toMatchObject({ Bucket: "nostos-photos", Key: "photos/abc.jpg", ContentType: "image/jpeg" });
  });

  it("rejects invalid keys", async () => {
    await expect(new R2Storage(cfg).signedUrl("../etc/passwd", NOW)).rejects.toThrow();
  });
});

describe("storage driver selection", () => {
  it("defaults to local, picks R2 when configured, and fails loudly when misconfigured", () => {
    expect(storageFromEnv({})).toBeInstanceOf(LocalDiskStorage);
    expect(storageFromEnv({ STORAGE_DRIVER: "r2", R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "b", R2_SECRET_ACCESS_KEY: "c", R2_BUCKET: "d" })).toBeInstanceOf(R2Storage);
    expect(() => storageFromEnv({ STORAGE_DRIVER: "r2", R2_BUCKET: "d" })).toThrow(/R2_ACCOUNT_ID/);
    expect(() => storageFromEnv({ VERCEL: "1" })).toThrow(/Vercel/);
    expect(() => storageFromEnv({ STORAGE_DRIVER: "gcs" })).toThrow();
  });
});
