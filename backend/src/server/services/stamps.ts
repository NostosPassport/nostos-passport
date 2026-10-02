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
import { isValidLatLng } from "@/lib/geo";
import { getStorage, newStorageKey, type BlobStorage } from "@/lib/storage";
import type { Actor } from "@/server/actor";
import { uploadUrl } from "@/server/media";
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
  venue: { id: string; slug: string; name: string; neighborhood: string };
};

const stampSelect = {
  id: true, userId: true, storageKey: true, caption: true, songTitle: true, songArtist: true, songArtUrl: true, songSourceId: true,
  createdAt: true, editedAt: true, hiddenAt: true, removedAt: true, countable: true,
  user: { select: subjectSelect },
  venue: { select: { id: true, slug: true, name: true, neighborhood: true } },
} as const;

export type StampView = Awaited<ReturnType<typeof toStampViews>>[number];

/** Builds the wire shape. Callers have already decided each stamp is visible to `actor`. Never includes coordinates, keys or user ids. */
async function toStampViews(db: Db, actor: Actor | null, rows: readonly StampRow[], now: Date) {
  const likes = await likeSummaries(db, rows.map((r) => r.id), actor?.userId);
  const none: LikeSummary = { count: 0, viewerLiked: false };
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      photoUrl: r.storageKey ? await uploadUrl(r.storageKey, now) : null,
      caption: r.caption,
      song: r.songTitle ? { title: r.songTitle, artist: r.songArtist!, artUrl: r.songArtUrl, sourceId: r.songSourceId } : null,
      createdAt: r.createdAt,
      editedAt: r.editedAt,
      place: { id: r.venue.id, slug: r.venue.slug, name: r.venue.name, neighborhood: r.venue.neighborhood },
      author: { handle: r.user.handle, displayName: r.user.displayName, avatarUrl: await avatarUrl(r.user.avatarKey, now), verified: r.user.verifiedAt !== null },
      mine: actor?.userId === r.userId,
      likes: likes.get(r.id) ?? none,
      /** Staff see hidden and removed stamps (moderation); everyone else never receives them. */
      hidden: r.hiddenAt !== null,
      removed: r.removedAt !== null,
    })),
  );
}

/** Creates a stamp. `bytes` is optional: a stamp may be a caption, a song, or both with no photo. */
export async function createStamp(
  db: Db,
  actor: Actor | null,
  venueId: string,
  input: { bytes?: Buffer | null; meta: unknown },
  now = new Date(),
  storage: BlobStorage = getStorage(),
) {
  const me = requireSignedIn(actor);
  const meta = stampMetaSchema.parse(input.meta);
  const hasPhoto = Boolean(input.bytes && input.bytes.length > 0);
  if (!hasPhoto && !meta.caption && meta.songTitle === undefined) throw badRequest("A stamp needs a photo, a caption or a song");
  assertCleanText({ caption: meta.caption, "song title": meta.songTitle, "song artist": meta.songArtist });
  const place = await db.venue.findUnique({ where: { id: venueId }, select: { id: true, lat: true, lng: true, geofenceMeters: true } });
  if (!place) throw notFound("Place not found");
  if (me.geofenceExempt) {
    if (!isValidLatLng(meta)) throw badRequest("Invalid coordinates");
  } else assertInsideGeofence(meta, place);
  const image = hasPhoto ? await processImage(input.bytes!) : null;

  const key = image ? newStorageKey("photos", image.kind.ext) : null;
  let wrote = false;
  try {
    const row = await db.$transaction(async (tx) => {
      await lockAndCheckCooldown(tx, { userId: me.userId, venueId }, now);
      await consumeRate(tx, me.userId, "post", now);
      const created = await tx.photo.create({
        data: {
          userId: me.userId, venueId, storageKey: key, mimeType: image?.kind.mime ?? null, caption: meta.caption, lat: meta.lat, lng: meta.lng,
          createdAt: now, countable: !me.geofenceExempt, rating: meta.rating ?? null,
          songTitle: meta.songTitle ?? null, songArtist: meta.songArtist ?? null, songArtUrl: meta.songArtUrl ?? null, songSourceId: meta.songSourceId ?? null,
        },
        select: stampSelect,
      });
      // Written last inside the transaction: if the write fails the row rolls back, and if the commit fails we clean up below.
      if (key && image) {
        await storage.put(key, image.bytes, image.kind.mime);
        wrote = true;
      }
      return created;
    });
    return (await toStampViews(db, me, [row], now))[0]!;
  } catch (err) {
    if (wrote && key) await storage.delete(key).catch(() => {});
    throw err;
  }
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

/** A passport's stamps grid, newest first, 30 at a time (`before` = the previous page's `nextBefore`). */
export async function listUserStamps(db: Db, actor: Actor | null, handle: string, before?: string | null, now = new Date()) {
  const { user, isSelf } = await assertProfileVisible(db, actor, handle);
  const c = before ? parseCursor(before) : null;
  const rows = await db.photo.findMany({
    where: { ...profileStampsWhere(user.id, isSelf), ...(c ? beforeCursor(c) : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: STAMPS_PAGE + 1,
    select: stampSelect,
  });
  const page = rows.slice(0, STAMPS_PAGE);
  return { stamps: await toStampViews(db, actor, page, now), nextBefore: rows.length > STAMPS_PAGE ? cursorOf(page[page.length - 1]!) : null };
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
