/**
 * Stamps: one visit to a place, with a photo, a caption, a song, or any mix (at least one). A stamp is a row in the
 * `photo` table (the name is kept to avoid migration churn); the API and the app say "stamp".
 *
 *  - Created only inside the place's geofence, checked here from the submitted coordinates (rule 1). Geofence-exempt
 *    (App Review) accounts may stamp from anywhere, and their stamps are visible only to themselves.
 *  - One stamp per person per place per 15 minutes, and a per-hour limit across places. EXIF is stripped (rule 5).
 *  - Visibility = the author's account privacy (src/server/privacy.ts#canSeeStamp). There is no per-stamp setting.
 *  - The author can edit the caption and the song (frozen while a moderator is looking at it) and "delete from
 *    profile", which sets removed_at for good. Nothing is ever deleted (rule 4).
 *  - Song data is metadata only; no audio. The art URL must come from Apple's artwork CDN.
 */
import { z } from "zod";
import type { Db } from "@/lib/db";
import { distanceMeters, isValidLatLng } from "@/lib/geo";
import { localParts } from "@/lib/time";
import { pageAndSlot } from "@/lib/layout";
import { getStorage, newStorageKey, type BlobStorage } from "@/lib/storage";
import type { Actor } from "@/server/actor";
import { uploadUrl } from "@/server/media";
import { recordProgress } from "@/server/services/neighborhoods";
import { assertCleanText, badRequest, conflict, notFound, ServiceError } from "@/server/errors";
import { assertCanEditOwnContent, isModerator, requireSignedIn } from "@/server/permissions";
import { authorResolver, canSeeStamp, subjectSelect, toSubject, type SubjectRow } from "@/server/privacy";
import { consumeRate } from "@/server/rate-limit";
import { assertInsideGeofence, lockAndCheckCooldown } from "@/server/services/geofence";
import { processImage } from "@/server/services/image";
import { isBlockedEitherWay } from "@/server/services/blocks";
import { likeSummaries, type LikeSummary } from "@/server/services/likes";
import { avatarUrl, profileStampsWhere } from "@/server/services/people";

export const CAPTION_MAX = 280;
export const STAMPS_PAGE = 30;
const SONG_FIELD_MAX = 200;

/** Album art only from Apple's artwork CDN, over https, so a stamp can't embed a tracking pixel from anywhere else. */
const artUrl = z
  .string()
  .trim()
  .max(500)
  .refine((u) => {
    try {
      const url = new URL(u);
      return url.protocol === "https:" && /(^|\.)mzstatic\.com$/.test(url.hostname);
    } catch {
      return false;
    }
  }, "Song art must be an https link from Apple's artwork servers");

/** Empty strings (multipart fields) mean "absent". */
const optional = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => (v === "" || v === null ? undefined : v), schema.optional());

const songShape = {
  songTitle: optional(z.string().trim().min(1).max(SONG_FIELD_MAX)),
  songArtist: optional(z.string().trim().min(1).max(SONG_FIELD_MAX)),
  songArtUrl: optional(artUrl),
  songSourceId: optional(z.string().trim().min(1).max(100)),
};

const checkSong = (m: { songTitle?: string; songArtist?: string; songArtUrl?: string; songSourceId?: string }, ctx: z.RefinementCtx) => {
  const any = m.songTitle !== undefined || m.songArtist !== undefined || m.songArtUrl !== undefined || m.songSourceId !== undefined;
  if (any && (m.songTitle === undefined || m.songArtist === undefined)) {
    ctx.addIssue({ code: "custom", path: ["songTitle"], message: "A song needs a title and an artist" });
  }
};

export const stampMetaSchema = z
  .object({
    caption: z.string().trim().max(CAPTION_MAX, `Caption: ${CAPTION_MAX} characters max`).default(""),
    lat: z.coerce.number().finite(),
    lng: z.coerce.number().finite(),
    /** Optional, stored but not shown in v1. */
    rating: optional(z.coerce.number().int("Rating: a whole number from 1 to 10").min(1, "Rating: 1 to 10").max(10, "Rating: 1 to 10")),
    ...songShape,
  })
  .strict()
  .superRefine(checkSong);

export const stampEditSchema = z
  .object({
    caption: z.string().trim().max(CAPTION_MAX, `Caption: ${CAPTION_MAX} characters max`),
    /** null removes the song. */
    song: z
      .object({
        title: z.string().trim().min(1).max(SONG_FIELD_MAX),
        artist: z.string().trim().min(1).max(SONG_FIELD_MAX),
        artUrl: artUrl.nullish(),
        sourceId: z.string().trim().min(1).max(100).nullish(),
      })
      .strict()
      .nullable(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Nothing to change");

type StampRow = {
  id: string;
  userId: string;
  storageKey: string | null;
  caption: string;
  songTitle: string | null;
  songArtist: string | null;
  songArtUrl: string | null;
  songSourceId: string | null;
  createdAt: Date;
  editedAt: Date | null;
  hiddenAt: Date | null;
  removedAt: Date | null;
  countable: boolean;
  user: SubjectRow;
  venue: { id: string; slug: string; name: string; neighborhood: string; neighborhoodId: string | null };
  photos: { id: string; storageKey: string; position: number; x: number | null; y: number | null; rotation: number | null }[];
};

const stampSelect = {
  id: true, userId: true, storageKey: true, caption: true, songTitle: true, songArtist: true, songArtUrl: true, songSourceId: true,
  createdAt: true, editedAt: true, hiddenAt: true, removedAt: true, countable: true,
  user: { select: subjectSelect },
  venue: { select: { id: true, slug: true, name: true, neighborhood: true, neighborhoodId: true } },
  /** Live photos only, in page order. */
  photos: { where: { removedAt: null }, orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }], select: { id: true, storageKey: true, position: true, x: true, y: true, rotation: true } },
};

export const MAX_STAMP_PHOTOS = 6;

export type StampView = Awaited<ReturnType<typeof toStampViews>>[number];

/** Each stamp's 0-based position among its owner's live stamps, oldest first (the input to the shared layout function). */
async function ordinals(db: Db, rows: readonly StampRow[]) {
  const out = new Map<string, number>();
  const userIds = [...new Set(rows.map((r) => r.userId))];
  if (!userIds.length) return out;
  const all = await db.photo.findMany({
    where: { userId: { in: userIds }, hiddenAt: null, removedAt: null },
    orderBy: [{ userId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: { id: true, userId: true },
  });
  const counter = new Map<string, number>();
  for (const s of all) {
    const n = counter.get(s.userId) ?? 0;
    out.set(s.id, n);
    counter.set(s.userId, n + 1);
  }
  return out;
}

/** Builds the wire shape. Callers have already decided each stamp is visible to `actor`. Never includes coordinates, keys or user ids. */
async function toStampViews(db: Db, actor: Actor | null, rows: readonly StampRow[], now: Date) {
  const places = await ordinals(db, rows);
  const likes = await likeSummaries(db, rows.map((r) => r.id), actor?.userId);
  const none: LikeSummary = { count: 0, viewerLiked: false };
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      photoUrl: r.photos[0] ? await uploadUrl(r.photos[0].storageKey, now) : null,
      /** Up to 6, in page order. x and y are 0..1 of the page and rotation is degrees, null until the owner lays them out. */
      photos: await Promise.all(r.photos.map(async (p) => ({ id: p.id, url: await uploadUrl(p.storageKey, now), position: p.position, x: p.x, y: p.y, rotation: p.rotation }))),
      caption: r.caption,
      song: r.songTitle ? { title: r.songTitle, artist: r.songArtist!, artUrl: r.songArtUrl, sourceId: r.songSourceId } : null,
      /** Page and slot in the owner's passport (oldest first, three to a page); null for a stamp that is hidden or removed. */
      ...(places.has(r.id) ? pageAndSlot(places.get(r.id)!) : { page: null, slot: null }),
      createdAt: r.createdAt,
      editedAt: r.editedAt,
      place: { id: r.venue.id, slug: r.venue.slug, name: r.venue.name, neighborhood: r.venue.neighborhood, neighborhoodId: r.venue.neighborhoodId },
      author: { handle: r.user.handle, displayName: r.user.displayName, avatarUrl: await avatarUrl(r.user.avatarKey, now), verified: r.user.verifiedAt !== null },
      mine: actor?.userId === r.userId,
      likes: likes.get(r.id) ?? none,
      /** Staff see hidden and removed stamps (moderation); everyone else never receives them. */
      hidden: r.hiddenAt !== null,
      removed: r.removedAt !== null,
    })),
  );
}

/** Creates a stamp. Photos are optional (up to 6): a stamp may be a caption, a song, or both with no photo. */
export async function createStamp(db: Db, actor: Actor | null, venueId: string, input: { bytes?: Buffer | null; photos?: Buffer[]; meta: unknown }, now = new Date(), storage: BlobStorage = getStorage()) {
  return (await createStampWithProgress(db, actor, venueId, input, now, storage)).stamp;
}

/** The same, plus the neighborhood progress this stamp made (for the landing animation). */
export async function createStampWithProgress(
  db: Db,
  actor: Actor | null,
  venueId: string,
  input: { bytes?: Buffer | null; photos?: Buffer[]; meta: unknown },
  now = new Date(),
  storage: BlobStorage = getStorage(),
) {
  const me = requireSignedIn(actor);
  const meta = stampMetaSchema.parse(input.meta);
  const buffers = [...(input.bytes ? [input.bytes] : []), ...(input.photos ?? [])].filter((b) => b.length > 0);
  if (buffers.length > MAX_STAMP_PHOTOS) throw badRequest(`A stamp holds up to ${MAX_STAMP_PHOTOS} photos`);
  if (buffers.length === 0 && !meta.caption && meta.songTitle === undefined) throw badRequest("A stamp needs a photo, a caption or a song");
  assertCleanText({ caption: meta.caption, "song title": meta.songTitle, "song artist": meta.songArtist });
  const place = await db.venue.findUnique({ where: { id: venueId }, select: { id: true, lat: true, lng: true, geofenceMeters: true } });
  if (!place) throw notFound("Place not found");
  if (me.geofenceExempt) {
    if (!isValidLatLng(meta)) throw badRequest("Invalid coordinates");
  } else assertInsideGeofence(meta, place);
  // Every photo is fully re-encoded: EXIF and GPS never reach storage (rule 5).
  const images = await Promise.all(buffers.map((b) => processImage(b)));
  const keys = images.map((img) => newStorageKey("photos", img.kind.ext));
  const written: string[] = [];
  let progress: Awaited<ReturnType<typeof recordProgress>> = null;
  try {
    const row = await db.$transaction(async (tx) => {
      await lockAndCheckCooldown(tx, { userId: me.userId, venueId }, now);
      await consumeRate(tx, me.userId, "post", now);
      const created = await tx.photo.create({
        data: {
          userId: me.userId, venueId, storageKey: keys[0] ?? null, mimeType: images[0]?.kind.mime ?? null, caption: meta.caption, lat: meta.lat, lng: meta.lng,
          createdAt: now, countable: !me.geofenceExempt, rating: meta.rating ?? null,
          songTitle: meta.songTitle ?? null, songArtist: meta.songArtist ?? null, songArtUrl: meta.songArtUrl ?? null, songSourceId: meta.songSourceId ?? null,
        },
        select: { id: true },
      });
      for (const [i, img] of images.entries()) {
        await tx.stampPhoto.create({ data: { stampId: created.id, storageKey: keys[i]!, mimeType: img.kind.mime, position: i, createdAt: now } });
      }
      // App Review stamps (outside the geofence) never count toward a neighborhood.
      if (!me.geofenceExempt) progress = await recordProgress(tx, me.userId, venueId, created.id, now);
      // Written last inside the transaction: if a write fails the rows roll back, and if the commit fails we clean up below.
      for (const [i, img] of images.entries()) {
        await storage.put(keys[i]!, img.bytes, img.kind.mime);
        written.push(keys[i]!);
      }
      return tx.photo.findUniqueOrThrow({ where: { id: created.id }, select: stampSelect });
    });
    return { stamp: (await toStampViews(db, me, [row], now))[0]!, progress };
  } catch (err) {
    await Promise.all(written.map((k) => storage.delete(k).catch(() => {})));
    throw err;
  }
}

async function ownStamp(db: Db, actor: Actor | null, stampId: string) {
  const me = requireSignedIn(actor);
  const stamp = await db.photo.findUnique({ where: { id: stampId }, select: { id: true, userId: true, hiddenAt: true, removedAt: true, caption: true, songTitle: true } });
  if (!stamp || stamp.removedAt) throw notFound("Stamp not found");
  assertCanEditOwnContent(me, stamp);
  if (stamp.hiddenAt) throw conflict("This stamp was hidden by a moderator and can't be edited");
  return { me, stamp };
}

/** Compatibility endpoint: photographs are fixed at creation, never appended later. */
export async function addStampPhotos(db: Db, actor: Actor | null, stampId: string, buffers: Buffer[], now = new Date(), storage: BlobStorage = getStorage()) {
  await ownStamp(db, actor, stampId);
  // Retain the signature for callers, but reject before decoding images or writing files.
  void buffers;
  void now;
  void storage;
  throw badRequest("Photos can only be attached when creating a stamp");
}

/** Remove one photo from your stamp (final: it is hidden, never deleted). A stamp can't be left with nothing in it. */
export async function removeStampPhoto(db: Db, actor: Actor | null, stampId: string, photoId: string, now = new Date()) {
  const { me, stamp } = await ownStamp(db, actor, stampId);
  const live = await db.stampPhoto.findMany({ where: { stampId, removedAt: null }, select: { id: true } });
  if (!live.some((p) => p.id === photoId)) throw notFound("Photo not found");
  if (live.length === 1 && !stamp.caption.trim() && !stamp.songTitle) throw badRequest("A stamp needs a photo, a caption or a song");
  await db.$transaction([
    db.stampPhoto.update({ where: { id: photoId }, data: { removedAt: now } }),
    db.photo.update({ where: { id: stampId }, data: { editedAt: now } }),
  ]);
  return getStamp(db, me, stampId, now);
}

export const photoLayoutSchema = z
  .object({
    photos: z
      .array(
        z
          .object({
            id: z.string().min(1).max(64),
            position: z.number().int().min(0).max(MAX_STAMP_PHOTOS - 1).optional(),
            x: z.number().min(0).max(1).nullable().optional(),
            y: z.number().min(0).max(1).nullable().optional(),
            rotation: z.number().min(-45).max(45).nullable().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_STAMP_PHOTOS),
  })
  .strict();

/**
 * The scrapbook layout: where each photo sits on the page (x, y as 0..1, rotation in degrees) and their order. Positions
 * given for the live photos must stay unique. Only the owner may do this, and the files never change.
 */
export async function setPhotoLayout(db: Db, actor: Actor | null, stampId: string, raw: unknown, now = new Date()) {
  const { me } = await ownStamp(db, actor, stampId);
  const input = photoLayoutSchema.parse(raw);
  const live = await db.stampPhoto.findMany({ where: { stampId, removedAt: null }, select: { id: true, position: true } });
  const ids = new Set(live.map((p) => p.id));
  if (new Set(input.photos.map((p) => p.id)).size !== input.photos.length || input.photos.some((p) => !ids.has(p.id))) throw badRequest("Those photos aren't on this stamp");
  const after = new Map(live.map((p) => [p.id, p.position]));
  for (const p of input.photos) if (p.position !== undefined) after.set(p.id, p.position);
  if (new Set(after.values()).size !== after.size) throw badRequest("Each photo needs its own position");
  await db.$transaction(
    input.photos.map((p) =>
      db.stampPhoto.update({ where: { id: p.id }, data: { ...(p.position !== undefined ? { position: p.position } : {}), ...(p.x !== undefined ? { x: p.x } : {}), ...(p.y !== undefined ? { y: p.y } : {}), ...(p.rotation !== undefined ? { rotation: p.rotation } : {}) } }),
    ),
  );
  return getStamp(db, me, stampId, now);
}

/** Stamp detail. 404 when the viewer may not see it (privacy.ts#canSeeStamp), so existence isn't revealed. */
export async function getStamp(db: Db, actor: Actor | null, stampId: string, now = new Date()) {
  const row = await db.photo.findUnique({ where: { id: stampId }, select: stampSelect });
  if (!row) throw notFound("Stamp not found");
  await assertVisible(db, actor, row);
  return { stamp: (await toStampViews(db, actor, [row], now))[0]! };
}

/** Throws 404 unless the viewer may see `row`; shared by detail, likes and flags. */
export async function assertVisible(db: Db, actor: Actor | null, row: Pick<StampRow, "userId" | "hiddenAt" | "removedAt" | "countable" | "user">) {
  const resolve = await authorResolver(db, actor, [row.userId]);
  if ((row.user.deletedAt || row.user.suspendedAt) && !resolve.viewer?.staff) throw notFound("Stamp not found");
  const subject = { authorId: row.userId, hidden: row.hiddenAt !== null, removed: row.removedAt !== null, countable: row.countable };
  if (!canSeeStamp(resolve.viewer, subject, resolve.access(toSubject(row.user)), resolve.blocks.has(row.userId))) throw notFound("Stamp not found");
}

/** Author edits: caption and song. Send only changed fields; `song: null` removes the song. */
export async function editStamp(db: Db, actor: Actor | null, stampId: string, raw: unknown, now = new Date()) {
  const me = requireSignedIn(actor);
  const input = stampEditSchema.parse(raw);
  assertCleanText({ caption: input.caption, "song title": input.song?.title, "song artist": input.song?.artist });
  const stamp = await db.photo.findUnique({ where: { id: stampId } });
  if (!stamp || stamp.removedAt) throw notFound("Stamp not found");
  assertCanEditOwnContent(me, stamp);
  if (stamp.hiddenAt) throw conflict("This stamp was hidden by a moderator and can't be edited");
  // Freeze while a moderator is looking at it, so it can't be rewritten mid-review.
  if ((await db.flag.count({ where: { targetType: "PHOTO", targetId: stamp.id, status: "OPEN" } })) > 0) {
    throw conflict("This stamp is under moderator review, so it can't be edited right now");
  }
  const caption = input.caption ?? stamp.caption;
  const song =
    input.song === undefined
      ? stamp.songTitle ? { title: stamp.songTitle, artist: stamp.songArtist!, artUrl: stamp.songArtUrl, sourceId: stamp.songSourceId } : null
      : input.song && { title: input.song.title, artist: input.song.artist, artUrl: input.song.artUrl ?? null, sourceId: input.song.sourceId ?? null };
  if (!stamp.storageKey && !caption.trim() && !song) throw badRequest("A stamp needs a photo, a caption or a song");
  await db.photo.update({
    where: { id: stamp.id },
    data: {
      caption,
      songTitle: song?.title ?? null, songArtist: song?.artist ?? null, songArtUrl: song?.artUrl ?? null, songSourceId: song?.sourceId ?? null,
      editedAt: now,
    },
  });
  return getStamp(db, me, stamp.id, now);
}

/** "Delete from profile": hides the stamp everywhere for good (removed_at, final). Nothing is deleted. */
export async function removeStamp(db: Db, actor: Actor | null, stampId: string, now = new Date()) {
  const me = requireSignedIn(actor);
  const stamp = await db.photo.findUnique({ where: { id: stampId } });
  if (!stamp || stamp.removedAt) throw notFound("Stamp not found");
  assertCanEditOwnContent(me, stamp);
  await db.photo.update({ where: { id: stamp.id }, data: { removedAt: now } });
  return { removed: true as const };
}

/** Access to a person's stamps and places: the full profile (403 `private_account` otherwise), and no block. */
async function assertProfileVisible(db: Db, actor: Actor | null, handle: string) {
  const user = await db.user.findUnique({ where: { handle: handle.toLowerCase() }, select: subjectSelect });
  if (!user || user.deletedAt || (user.suspendedAt && !isModerator(actor))) throw notFound("User not found");
  const isSelf = actor?.userId === user.id;
  if (actor && !isSelf && (await isBlockedEitherWay(db, actor.userId, user.id))) throw notFound("User not found");
  const resolve = await authorResolver(db, actor, [user.id]);
  if (resolve.access(toSubject(user)) === "limited") {
    throw new ServiceError(403, "private_account", "This account is private. Follow it to see their stamps.");
  }
  return { user, isSelf };
}

/** Page cursor: the last stamp's time and id, so stamps sharing a millisecond are never skipped. */
const cursorOf = (p: { createdAt: Date; id: string }) => `${p.createdAt.toISOString()}_${p.id}`;
export function parseCursor(before: string) {
  const m = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)_([A-Za-z0-9_-]{1,64})$/.exec(before);
  const at = m ? new Date(m[1]!) : null;
  if (!m || !at || Number.isNaN(at.getTime())) throw badRequest("before: use the previous page's nextBefore");
  return { at, id: m[2]! };
}
export const beforeCursor = (c: { at: Date; id: string }) => ({ OR: [{ createdAt: { lt: c.at } }, { createdAt: c.at, id: { lt: c.id } }] });

/** The passport's stamps, OLDEST first (so page 1 stays page 1), 30 at a time. `after` = the previous page's `nextAfter`. */
export async function listUserStamps(db: Db, actor: Actor | null, handle: string, after?: string | null, now = new Date()) {
  const { user, isSelf } = await assertProfileVisible(db, actor, handle);
  const c = after ? parseCursor(after) : null;
  const rows = await db.photo.findMany({
    where: { ...profileStampsWhere(user.id, isSelf), ...(c ? { OR: [{ createdAt: { gt: c.at } }, { createdAt: c.at, id: { gt: c.id } }] } : {}) },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: STAMPS_PAGE + 1,
    select: stampSelect,
  });
  const page = rows.slice(0, STAMPS_PAGE);
  return { stamps: await toStampViews(db, actor, page, now), nextAfter: rows.length > STAMPS_PAGE ? cursorOf(page[page.length - 1]!) : null };
}

/** Every place a person has stamped (the Places view), with their stamp count there and the latest stamp. Newest first. */
export async function listUserPlaces(db: Db, actor: Actor | null, handle: string, now = new Date()) {
  const { user, isSelf } = await assertProfileVisible(db, actor, handle);
  const rows = await db.photo.findMany({
    where: profileStampsWhere(user.id, isSelf),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, createdAt: true, storageKey: true, caption: true, venue: { select: { id: true, slug: true, name: true, neighborhood: true, lat: true, lng: true } } },
  });
  const places = new Map<string, { place: (typeof rows)[number]["venue"]; stamps: number; latest: (typeof rows)[number] }>();
  for (const r of rows) {
    const p = places.get(r.venue.id);
    if (p) p.stamps++;
    else places.set(r.venue.id, { place: r.venue, stamps: 1, latest: r });
  }
  return {
    places: await Promise.all(
      [...places.values()].map(async ({ place, stamps, latest }) => ({
        place,
        stamps,
        latestStamp: { id: latest.id, createdAt: latest.createdAt, photoUrl: latest.storageKey ? await uploadUrl(latest.storageKey, now) : null, caption: latest.caption },
      })),
    ),
  };
}

/**
 * Home feed: stamps from the people you follow, newest first, 30 at a time. Strictly chronological: no ranking, no
 * personalization, no suggestions (rule 9). Only approved follows, never blocked, suspended or deleted people.
 */
export async function listFeed(db: Db, actor: Actor | null, before?: string | null, now = new Date()) {
  const me = requireSignedIn(actor);
  const c = before ? parseCursor(before) : null;
  const rows = await db.photo.findMany({
    where: {
      hiddenAt: null, removedAt: null, countable: true,
      user: {
        deletedAt: null, suspendedAt: null,
        followers: { some: { followerId: me.userId } },
        blocking: { none: { blockedId: me.userId } },
        blockedBy: { none: { blockerId: me.userId } },
      },
      ...(c ? beforeCursor(c) : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: STAMPS_PAGE + 1,
    select: stampSelect,
  });
  const page = rows.slice(0, STAMPS_PAGE);
  return { stamps: await toStampViews(db, me, page, now), nextBefore: rows.length > STAMPS_PAGE ? cursorOf(page[page.length - 1]!) : null };
}

/** The local calendar day (America/New_York) a stamp was made on: YYYY-MM-DD. Stamps at one place on one day stack together. */
export const stampDay = (d: Date) => {
  const p = localParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};

/**
 * Your own page for one place: every stamp you made there, oldest first, grouped by the day (so the same place on different
 * nights stacks as separate visits), plus whether you are inside its geofence right now. The position is only used for this
 * answer (never stored). Owner only: it is built from your own stamps and nobody else's.
 */
export async function getMyPlacePage(db: Db, actor: Actor | null, idOrSlug: string, pos?: { lat: number; lng: number } | null, now = new Date()) {
  const me = requireSignedIn(actor);
  const place = await db.venue.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }, select: { id: true, slug: true, name: true, address: true, neighborhood: true, neighborhoodId: true, lat: true, lng: true, geofenceMeters: true, osmId: true } });
  if (!place) throw notFound("Place not found");
  const rows = await db.photo.findMany({ where: { userId: me.userId, venueId: place.id, hiddenAt: null, removedAt: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: stampSelect });
  const stamps = await toStampViews(db, me, rows, now);
  const visits: { day: string; stamps: typeof stamps }[] = [];
  for (const st of stamps) {
    const day = stampDay(st.createdAt);
    const last = visits[visits.length - 1];
    if (last && last.day === day) last.stamps.push(st);
    else visits.push({ day, stamps: [st] });
  }
  const here = pos && isValidLatLng(pos) ? Math.round(distanceMeters(pos, place)) : null;
  const { osmId, ...rest } = place;
  return {
    place: { ...rest, fromOsm: osmId !== null },
    stamps,
    visits,
    /** true or false when a position was sent, null when it wasn't. */
    inside: here === null ? null : here <= place.geofenceMeters,
    distanceM: here,
  };
}
