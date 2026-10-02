import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Storage for uploaded images. Photos are never public: clients only ever get short-lived signed GET URLs,
 * issued by the service layer for content the viewer is allowed to see.
 *
 * - LocalDiskStorage (development/tests): files under UPLOAD_DIR, served by /api/uploads/<key>?exp=&sig=
 *   with an HMAC signature (UPLOAD_URL_SECRET).
 * - R2Storage (preview/production): Cloudflare R2 via its S3-compatible API, presigned GET URLs.
 * Selected by STORAGE_DRIVER=local|r2.
 */
export interface BlobStorage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  /** A GET URL valid for at least `minValidSeconds`. */
  signedUrl(key: string, now?: Date): Promise<string>;
}

/** Signed URLs are valid for at least 15 minutes. */
export const SIGNED_URL_MIN_TTL_S = 15 * 60;
/**
 * Signing time is floored to 5-minute buckets and the TTL is 20 minutes, so every URL is valid for 15 to 20
 * minutes. A photo keeps the same URL within a bucket, which lets browsers and the iOS image cache reuse it
 * across the 60-second refreshes.
 */
const BUCKET_MS = 5 * 60_000;
export const SIGNED_URL_TTL_S = SIGNED_URL_MIN_TTL_S + BUCKET_MS / 1000;
export function signingInstant(now: Date): Date {
  return new Date(Math.floor(now.getTime() / BUCKET_MS) * BUCKET_MS);
}

const KEY_RE = /^[a-z0-9/_-]+\.(jpg|png|webp)$/;
export function isValidKey(key: string) {
  return KEY_RE.test(key) && !key.includes("..");
}

function uploadSecret(): string {
  const s = process.env.UPLOAD_URL_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("UPLOAD_URL_SECRET (>= 32 chars) is required in production");
  return "dev-only-upload-url-secret-not-for-production-use";
}

function localSignature(key: string, exp: number) {
  return createHmac("sha256", uploadSecret()).update(`${key}\n${exp}`).digest("base64url");
}

/** Verifies a local signed URL's exp/sig. */
export function verifyLocalSignature(key: string, exp: string | null, sig: string | null, now = new Date()): boolean {
  if (!exp || !sig || !/^\d{10}$/.test(exp)) return false;
  if (Number(exp) * 1000 <= now.getTime()) return false;
  const expected = Buffer.from(localSignature(key, Number(exp)));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export class LocalDiskStorage implements BlobStorage {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    if (!isValidKey(key)) throw new Error("Invalid storage key");
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch {
      return null;
    }
  }

  async signedUrl(key: string, now = new Date()): Promise<string> {
    if (!isValidKey(key)) throw new Error("Invalid storage key");
    const exp = Math.floor(signingInstant(now).getTime() / 1000) + SIGNED_URL_TTL_S;
    return `/api/uploads/${key}?exp=${exp}&sig=${localSignature(key, exp)}`;
  }
}

export type R2Config = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string };

export class R2Storage implements BlobStorage {
  readonly client: S3Client;
  constructor(private readonly cfg: R2Config, client?: S3Client) {
    this.client =
      client ??
      new S3Client({
        region: "auto",
        endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
      });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    if (!isValidKey(key)) throw new Error("Invalid storage key");
    await this.client.send(
      new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, Body: data, ContentType: contentType, CacheControl: "private, max-age=900" }),
    );
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
      return res.Body ? Buffer.from(await res.Body.transformToByteArray()) : null;
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
  }

  async signedUrl(key: string, now = new Date()): Promise<string> {
    if (!isValidKey(key)) throw new Error("Invalid storage key");
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }), {
      expiresIn: SIGNED_URL_TTL_S,
      signingDate: signingInstant(now),
    });
  }
}

export function storageFromEnv(env: Record<string, string | undefined> = process.env): BlobStorage {
  const driver = (env.STORAGE_DRIVER ?? "local").toLowerCase();
  if (driver === "r2") {
    const cfg = {
      accountId: env.R2_ACCOUNT_ID ?? "",
      accessKeyId: env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? "",
      bucket: env.R2_BUCKET ?? "",
    };
    const names: Record<keyof R2Config, string> = { accountId: "R2_ACCOUNT_ID", accessKeyId: "R2_ACCESS_KEY_ID", secretAccessKey: "R2_SECRET_ACCESS_KEY", bucket: "R2_BUCKET" };
    const missing = (Object.keys(cfg) as (keyof R2Config)[]).filter((k) => !cfg[k]).map((k) => names[k]);
    if (missing.length) throw new Error(`STORAGE_DRIVER=r2 but missing: ${missing.join(", ")}`);
    return new R2Storage(cfg);
  }
  if (driver !== "local") throw new Error(`Unknown STORAGE_DRIVER: ${driver}`);
  if (env.VERCEL === "1") throw new Error("STORAGE_DRIVER=local can't work on Vercel (read-only, ephemeral disk). Use r2.");
  return new LocalDiskStorage(path.resolve(process.cwd(), env.UPLOAD_DIR ?? "uploads"));
}

let storage: BlobStorage | null = null;
export function getStorage(): BlobStorage {
  storage ??= storageFromEnv();
  return storage;
}
export function setStorageForTests(s: BlobStorage) {
  storage = s;
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export type ImageKind = { mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" };

/** Detect image type from magic bytes. The client-declared Content-Type is never trusted. */
export function sniffImage(buf: Buffer): ImageKind | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mime: "image/png", ext: "png" };
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return { mime: "image/webp", ext: "webp" };
  return null;
}

export function newStorageKey(prefix: "photos" | "official" | "avatars", ext: ImageKind["ext"]): string {
  return `${prefix}/${randomBytes(16).toString("hex")}.${ext}`;
}

export function mimeForKey(key: string): string {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}
