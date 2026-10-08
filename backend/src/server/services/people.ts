import sharp from "sharp";
import { z } from "zod";
import type { Db } from "@/lib/db";
import { getStorage, MAX_UPLOAD_BYTES, newStorageKey, sniffImage, type BlobStorage } from "@/lib/storage";
import type { Actor } from "@/server/actor";
import { assertCleanText, badRequest, ServiceError } from "@/server/errors";
import { uploadUrl } from "@/server/media";
import { requireSignedIn } from "@/server/permissions";

export const avatarUrl = async (key: string | null, now = new Date()) => (key ? uploadUrl(key, now) : null);
export const BIO_MAX = 150;
export const profileSettingsSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a name").max(60, "Name: 60 characters max"),
  bio: z.string().trim().max(BIO_MAX, `Bio: ${BIO_MAX} characters max`),
}).partial().strict();

async function settingsView(db: Db, userId: string, now: Date) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { handle: true, displayName: true, bio: true, avatarKey: true } });
  return { profile: { handle: u.handle, displayName: u.displayName, bio: u.bio, avatarUrl: await avatarUrl(u.avatarKey, now) } };
}

export async function updateProfile(db: Db, actor: Actor | null, raw: unknown, now = new Date()) {
  const me = requireSignedIn(actor);
  const input = profileSettingsSchema.parse(raw);
  assertCleanText({ name: input.displayName, bio: input.bio });
  await db.user.update({ where: { id: me.userId }, data: input });
  return settingsView(db, me.userId, now);
}

export async function getProfileSettings(db: Db, actor: Actor | null, now = new Date()) {
  return settingsView(db, requireSignedIn(actor).userId, now);
}

export const AVATAR_SIZE = 512;
export async function processAvatar(input: Buffer) {
  if (input.length === 0) throw badRequest("Empty file");
  if (input.length > MAX_UPLOAD_BYTES) throw new ServiceError(413, "too_large", "Photos must be 5 MB or smaller");
  if (!sniffImage(input)) throw new ServiceError(415, "unsupported_type", "Only JPEG, PNG or WebP images are allowed");
  try {
    return await sharp(input, { failOn: "error", limitInputPixels: 50_000_000 }).rotate().resize({ width: AVATAR_SIZE, height: AVATAR_SIZE, fit: "cover" }).jpeg({ quality: 85 }).toBuffer();
  } catch {
    throw new ServiceError(415, "unsupported_type", "That image couldn't be read. Try a JPEG, PNG or WebP photo.");
  }
}

export async function setAvatar(db: Db, actor: Actor | null, bytes: Buffer, now = new Date(), storage: BlobStorage = getStorage()) {
  const me = requireSignedIn(actor);
  const clean = await processAvatar(bytes);
  const before = await db.user.findUniqueOrThrow({ where: { id: me.userId }, select: { avatarKey: true } });
  const key = newStorageKey("avatars", "jpg");
  await storage.put(key, clean, "image/jpeg");
  try {
    await db.user.update({ where: { id: me.userId }, data: { avatarKey: key } });
  } catch (err) {
    await storage.delete(key).catch(() => {});
    throw err;
  }
  if (before.avatarKey) await storage.delete(before.avatarKey).catch(() => {});
  return { avatarUrl: await avatarUrl(key, now) };
}

export async function removeAvatar(db: Db, actor: Actor | null, storage: BlobStorage = getStorage()) {
  const me = requireSignedIn(actor);
  const before = await db.user.findUniqueOrThrow({ where: { id: me.userId }, select: { avatarKey: true } });
  if (before.avatarKey) {
    await db.user.update({ where: { id: me.userId }, data: { avatarKey: null } });
    await storage.delete(before.avatarKey).catch(() => {});
  }
  return { avatarUrl: null };
}
