import { z } from "zod";
import { isValidLatLng } from "@/lib/geo";
import type { Db } from "@/lib/db";
import sharp from "sharp";
import { getStorage, MAX_UPLOAD_BYTES, newStorageKey, sniffImage, type BlobStorage, type ImageKind } from "@/lib/storage";
import type { Actor } from "@/server/actor";
import { assertCanPostUserContent } from "@/server/permissions";
import { assertCleanText, badRequest, notFound, ServiceError } from "@/server/errors";
import { assertInsideGeofence, lockAndCheckCooldown } from "@/server/services/reports";
import { consumeRate } from "@/server/rate-limit";

/** Live-only photo captions (unchanged); posts allow 280. */
export const LIVE_CAPTION_MAX = 140;
export const POST_CAPTION_MAX = 280;

/** Multipart fields arrive as strings: "true"/"false" for shared, "1".."10" for rating. */
const formBool = z.enum(["true", "false"]).transform((v) => v === "true");

export const photoMetaSchema = z
  .object({
    caption: z.string().trim().max(POST_CAPTION_MAX, `Caption: ${POST_CAPTION_MAX} characters max`).default(""),
    lat: z.coerce.number().finite(),
    lng: z.coerce.number().finite(),
    /** 1-10 makes this photo a post (profile, likes, featuring). Absent = a live-only photo, as before. */
    rating: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.coerce.number().int("Rating: a whole number from 1 to 10").min(1, "Rating: 1 to 10").max(10, "Rating: 1 to 10").optional(),
    ),
    /** Posts only. Default: on for public accounts, off for private ones. */
    shared: formBool.optional(),
  })
  .strict()
  .superRefine((m, ctx) => {
    if (m.rating === undefined && m.caption.length > LIVE_CAPTION_MAX) {
      ctx.addIssue({ code: "custom", path: ["caption"], message: `Caption: ${LIVE_CAPTION_MAX} characters max (${POST_CAPTION_MAX} with a rating)` });
    }
    if (m.rating === undefined && m.shared === false) {
      ctx.addIssue({ code: "custom", path: ["shared"], message: "A photo without a rating is a live photo and always appears on the venue page" });
    }
  });

/** Validates an image upload: size limit and magic-byte type check (client Content-Type is ignored). */
export const MAX_IMAGE_DIMENSION = 2048;

/**
 * Validates and re-encodes an upload. Size limit and magic-byte type check first (client Content-Type is
 * ignored), then a full decode + re-encode with sharp. It applies EXIF orientation, caps each side at 2048px
 * and writes a fresh file with **no metadata** (EXIF/GPS/XMP/ICC dropped), so a phone's location never
 * leaks through a photo. Anything sharp can't decode is rejected as unsupported.
 */
export async function processImage(input: Buffer): Promise<{ bytes: Buffer; kind: ImageKind }> {
  if (input.length === 0) throw badRequest("Empty file");
  if (input.length > MAX_UPLOAD_BYTES) throw new ServiceError(413, "too_large", "Photos must be 5 MB or smaller");
  const kind = sniffImage(input);
  if (!kind) throw new ServiceError(415, "unsupported_type", "Only JPEG, PNG or WebP images are allowed");
  try {
    const pipeline = sharp(input, { failOn: "error", limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: "inside", withoutEnlargement: true });
    const out =
      kind.ext === "png" ? pipeline.png({ compressionLevel: 9 }) : kind.ext === "webp" ? pipeline.webp({ quality: 85 }) : pipeline.jpeg({ quality: 85 });
    return { bytes: await out.toBuffer(), kind };
  } catch {
    throw new ServiceError(415, "unsupported_type", "That image couldn't be read. Try a JPEG, PNG or WebP photo.");
  }
}

/**
 * A photo from the venue: a live-only photo, or a post when it carries a rating. Either way the upload's
 * coordinates must be inside the venue's 100 m geofence (the app sends the position taken with the photo, and only
 * offers its in-app camera for posts), the 15-minute per-venue photo cooldown applies, and EXIF is stripped.
 */
export async function submitPhoto(
  db: Db,
  actor: Actor | null,
  venueId: string,
  input: { bytes: Buffer; meta: unknown },
  now = new Date(),
  storage: BlobStorage = getStorage(),
) {
  const me = assertCanPostUserContent(actor, venueId);
  const meta = photoMetaSchema.parse(input.meta);
  assertCleanText({ caption: meta.caption });
  const venue = await db.venue.findUnique({ where: { id: venueId }, select: { id: true, lat: true, lng: true } });
  if (!venue) throw notFound("Venue not found");
  if (me.geofenceExempt) {
    if (!isValidLatLng(meta)) throw badRequest("Invalid coordinates");
  } else assertInsideGeofence(meta, venue);
  const { bytes, kind } = await processImage(input.bytes);
  // A post shares to the venue page by default only for public accounts; live-only photos are always on it.
  const isPost = meta.rating !== undefined;
  const account = await db.user.findUniqueOrThrow({ where: { id: me.userId }, select: { isPrivate: true } });
  const shared = isPost ? (meta.shared ?? !account.isPrivate) : true;

  const key = newStorageKey("photos", kind.ext);
  let wrote = false;
  try {
    return await db.$transaction(async (tx) => {
      await lockAndCheckCooldown(tx, { userId: me.userId, venueId, kind: "PHOTO" }, now);
      await consumeRate(tx, me.userId, "post", now);
      const photo = await tx.photo.create({
        data: {
          userId: me.userId, venueId, storageKey: key, mimeType: kind.mime, caption: meta.caption, lat: meta.lat, lng: meta.lng, createdAt: now,
          countable: !me.geofenceExempt,
          rating: meta.rating ?? null,
          shared,
        },
      });
      // Written last inside the transaction: if the write fails the row rolls back, and if the commit fails we clean up below.
      await storage.put(key, bytes, kind.mime);
      wrote = true;
      return photo;
    });
  } catch (err) {
    if (wrote) await storage.delete(key).catch(() => {});
    throw err;
  }
}
