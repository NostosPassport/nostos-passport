import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { distanceMeters, isValidLatLng } from "@/lib/geo";
import { localParts } from "@/lib/time";
import { pageAndSlot } from "@/lib/layout";
import { getStorage, newStorageKey, type BlobStorage } from "@/lib/storage";
import type { Actor } from "@/server/actor";
import { livePhotoCoverSelect, uploadUrl } from "@/server/media";
import { recordProgress } from "@/server/services/neighborhoods";
import { assertCleanText, badRequest, conflict, notFound } from "@/server/errors";
import { assertCanEditOwnContent, requireSignedIn } from "@/server/permissions";
import { consumeRate } from "@/server/rate-limit";
import { assertInsideGeofence, lockAndCheckCooldown } from "@/server/services/geofence";
import { processImage } from "@/server/services/image";
import { avatarUrl } from "@/server/services/people";

export const CAPTION_MAX = 280;
export const STAMPS_PAGE = 30;
const SONG_FIELD_MAX = 200;

const artUrl = z.string().trim().max(500).refine((u) => {
  try {
    const url = new URL(u);
    return url.protocol === "https:" && /(^|\.)mzstatic\.com$/.test(url.hostname);
  } catch {
    return false;
  }
}, "Song art must be an https link from Apple's artwork servers");

const optional = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => (v === "" || v === null ? undefined : v), schema.optional());
const songShape = {
  songTitle: optional(z.string().trim().min(1).max(SONG_FIELD_MAX)),
  songArtist: optional(z.string().trim().min(1).max(SONG_FIELD_MAX)),
  songArtUrl: optional(artUrl),
  songSourceId: optional(z.string().trim().min(1).max(100)),
};
const checkSong = (m: { songTitle?: string; songArtist?: string; songArtUrl?: string; songSourceId?: string }, ctx: z.RefinementCtx) => {
  const any = m.songTitle !== undefined || m.songArtist !== undefined || m.songArtUrl !== undefined || m.songSourceId !== undefined;
  if (any && (m.songTitle === undefined || m.songArtist === undefined)) ctx.addIssue({ code: "custom", path: ["songTitle"], message: "A song needs a title and an artist" });
};

export const stampMetaSchema = z.object({
  caption: z.string().trim().max(CAPTION_MAX, `Caption: ${CAPTION_MAX} characters max`).default(""),
  lat: z.coerce.number().finite(),
  lng: z.coerce.number().finite(),
  rating: optional(z.coerce.number().int("Rating: a whole number from 1 to 10").min(1, "Rating: 1 to 10").max(10, "Rating: 1 to 10")),
  ...songShape,
}).strict().superRefine(checkSong);

export const stampEditSchema = z.object({
  caption: z.string().trim().max(CAPTION_MAX, `Caption: ${CAPTION_MAX} characters max`),
  song: z.object({
    title: z.string().trim().min(1).max(SONG_FIELD_MAX),
    artist: z.string().trim().min(1).max(SONG_FIELD_MAX),
    artUrl: artUrl.nullish(),
    sourceId: z.string().trim().min(1).max(100).nullish(),
  }).strict().nullable(),
}).partial().strict().refine((v) => Object.keys(v).length > 0, "Nothing to change");

type UserRow = { handle: string; displayName: string; avatarKey: string | null; deletedAt: Date | null };
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
  user: UserRow;
  venue: { id: string; slug: string; name: string; neighborhood: string; neighborhoodId: string | null };
  photos: { id: string; storageKey: string; position: number; x: number | null; y: number | null; rotation: number | null }[];
};

const stampSelect = {
  id: true, userId: true, storageKey: true, caption: true, songTitle: true, songArtist: true, songArtUrl: true, songSourceId: true,
  createdAt: true, editedAt: true, hiddenAt: true, removedAt: true, countable: true,
  user: { select: { handle: true, displayName: true, avatarKey: true, deletedAt: true } },
  venue: { select: { id: true, slug: true, name: true, neighborhood: true, neighborhoodId: true } },
  photos: { where: { removedAt: null }, orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }], select: { id: true, storageKey: true, position: true, x: true, y: true, rotation: true } },
};

export const MAX_STAMP_PHOTOS = 6;
export type StampView = Awaited<ReturnType<typeof toStampViews>>[number];

async function ordinals(db: Db, rows: readonly StampRow[]) {
  const out = new Map<string, number>();
  const userIds = [...new Set(rows.map((r) => r.userId))];
  if (!userIds.length) return out;
  const all = await db.photo.findMany({ where: { userId: { in: userIds }, hiddenAt: null, removedAt: null }, orderBy: [{ userId: "asc" }, { createdAt: "asc" }, { id: "asc" }], select: { id: true, userId: true } });
  const counter = new Map<string, number>();
  for (const s of all) {
    const n = counter.get(s.userId) ?? 0;
    out.set(s.id, n);
    counter.set(s.userId, n + 1);
  }
  return out;
}

async function toStampViews(db: Db, actor: Actor | null, rows: readonly StampRow[], now: Date) {
  const places = await ordinals(db, rows);
  return Promise.all(rows.map(async (r) => ({
    id: r.id,
    photoUrl: r.photos[0] ? await uploadUrl(r.photos[0].storageKey, now) : null,
    photos: await Promise.all(r.photos.map(async (p) => ({ id: p.id, url: await uploadUrl(p.storageKey, now), position: p.position, x: p.x, y: p.y, rotation: p.rotation }))),
    caption: r.caption,
    song: r.songTitle ? { title: r.songTitle, artist: r.songArtist!, artUrl: r.songArtUrl, sourceId: r.songSourceId } : null,
    ...(places.has(r.id) ? pageAndSlot(places.get(r.id)!) : { page: null, slot: null }),
    createdAt: r.createdAt,
    editedAt: r.editedAt,
    place: { id: r.venue.id, slug: r.venue.slug, name: r.venue.name, neighborhood: r.venue.neighborhood, neighborhoodId: r.venue.neighborhoodId },
    author: { handle: r.user.handle, displayName: r.user.displayName, avatarUrl: await avatarUrl(r.user.avatarKey, now), verified: false },
    mine: actor?.userId === r.userId,
    likes: { count: 0, viewerLiked: false },
    hidden: false,
    removed: false,
  })));
}

export async function createStamp(db: Db, actor: Actor | null, venueId: string, input: { bytes?: Buffer | null; photos?: Buffer[]; meta: unknown }, now = new Date(), storage: BlobStorage = getStorage()) {
  return (await createStampWithProgress(db, actor, venueId, input, now, storage)).stamp;
}

export async function createStampWithProgress(db: Db, actor: Actor | null, venueId: string, input: { bytes?: Buffer | null; photos?: Buffer[]; meta: unknown }, now = new Date(), storage: BlobStorage = getStorage()) {
  const me = requireSignedIn(actor);
  const meta = stampMetaSchema.parse(input.meta);
  const buffers = [...(input.bytes ? [input.bytes] : []), ...(input.photos ?? [])].filter((b) => b.length > 0);
  if (buffers.length > MAX_STAMP_PHOTOS) throw badRequest(`A stamp holds up to ${MAX_STAMP_PHOTOS} photos`);
  if (buffers.length === 0 && !meta.caption && meta.songTitle === undefined) throw badRequest("A stamp needs a photo, a caption or a song");
  assertCleanText({ caption: meta.caption, "song title": meta.songTitle, "song artist": meta.songArtist });
  const place = await db.venue.findUnique({ where: { id: venueId }, select: { id: true, lat: true, lng: true, geofenceMeters: true } });
  if (!place) throw notFound("Place not found");
  if (me.geofenceExempt) { if (!isValidLatLng(meta)) throw badRequest("Invalid coordinates"); } else assertInsideGeofence(meta, place);
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
      for (const [i, img] of images.entries()) await tx.stampPhoto.create({ data: { stampId: created.id, storageKey: keys[i]!, mimeType: img.kind.mime, position: i, createdAt: now } });
      if (!me.geofenceExempt) progress = await recordProgress(tx, me.userId, venueId, created.id, now);
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

async function ownStamp(db: Db | Prisma.TransactionClient, actor: Actor | null, stampId: string) {
  const me = requireSignedIn(actor);
  const stamp = await db.photo.findUnique({ where: { id: stampId }, select: { id: true, userId: true, hiddenAt: true, removedAt: true, caption: true, songTitle: true } });
  if (!stamp || stamp.removedAt) throw notFound("Stamp not found");
  assertCanEditOwnContent(me, stamp);
  if (stamp.hiddenAt) throw conflict("This stamp isn't available");
  return { me, stamp };
}

export async function addStampPhotos(db: Db, actor: Actor | null, stampId: string, buffers: Buffer[], now = new Date(), storage: BlobStorage = getStorage()) {
  await ownStamp(db, actor, stampId);
  void buffers; void now; void storage;
  throw badRequest("Photos can only be attached when creating a stamp");
}

async function lockStamp(tx: Prisma.TransactionClient, stampId: string) { await tx.$queryRaw`SELECT id FROM photo WHERE id = ${stampId} FOR UPDATE`; }

export async function removeStampPhoto(db: Db, actor: Actor | null, stampId: string, photoId: string, now = new Date()) {
  const me = requireSignedIn(actor);
  await db.$transaction(async (tx) => {
    await lockStamp(tx, stampId);
    const { stamp } = await ownStamp(tx, me, stampId);
    const live = await tx.stampPhoto.findMany({ where: { stampId, removedAt: null }, select: { id: true } });
    if (!live.some((p) => p.id === photoId)) throw notFound("Photo not found");
    if (live.length === 1 && !stamp.caption.trim() && !stamp.songTitle) throw badRequest("A stamp needs a photo, a caption or a song");
    await tx.stampPhoto.update({ where: { id: photoId }, data: { removedAt: now } });
    await tx.photo.update({ where: { id: stampId }, data: { editedAt: now } });
  });
  return getStamp(db, me, stampId, now);
}

export const photoLayoutSchema = z.object({ photos: z.array(z.object({
  id: z.string().min(1).max(64),
  position: z.number().int().min(0).max(MAX_STAMP_PHOTOS - 1).optional(),
  x: z.number().min(0).max(1).nullable().optional(),
  y: z.number().min(0).max(1).nullable().optional(),
  rotation: z.number().min(-45).max(45).nullable().optional(),
}).strict()).min(1).max(MAX_STAMP_PHOTOS) }).strict();

export async function setPhotoLayout(db: Db, actor: Actor | null, stampId: string, raw: unknown, now = new Date()) {
  const { me } = await ownStamp(db, actor, stampId);
  const input = photoLayoutSchema.parse(raw);
  const live = await db.stampPhoto.findMany({ where: { stampId, removedAt: null }, select: { id: true, position: true } });
  const ids = new Set(live.map((p) => p.id));
  if (new Set(input.photos.map((p) => p.id)).size !== input.photos.length || input.photos.some((p) => !ids.has(p.id))) throw badRequest("Those photos aren't on this stamp");
  const after = new Map(live.map((p) => [p.id, p.position]));
  for (const p of input.photos) if (p.position !== undefined) after.set(p.id, p.position);
  if (new Set(after.values()).size !== after.size) throw badRequest("Each photo needs its own position");
  await db.$transaction(input.photos.map((p) => db.stampPhoto.update({ where: { id: p.id }, data: {
    ...(p.position !== undefined ? { position: p.position } : {}), ...(p.x !== undefined ? { x: p.x } : {}), ...(p.y !== undefined ? { y: p.y } : {}), ...(p.rotation !== undefined ? { rotation: p.rotation } : {}),
  } })));
  return getStamp(db, me, stampId, now);
}

export async function getStamp(db: Db, actor: Actor | null, stampId: string, now = new Date()) {
  const row = await db.photo.findUnique({ where: { id: stampId }, select: stampSelect });
  if (!row) throw notFound("Stamp not found");
  await assertVisible(db, actor, row);
  return { stamp: (await toStampViews(db, actor, [row], now))[0]! };
}

export async function assertVisible(_db: Db, actor: Actor | null, row: Pick<StampRow, "userId" | "hiddenAt" | "removedAt" | "user">) {
  const me = requireSignedIn(actor);
  if (row.userId !== me.userId || row.hiddenAt || row.removedAt || row.user.deletedAt) throw notFound("Stamp not found");
}

export async function editStamp(db: Db, actor: Actor | null, stampId: string, raw: unknown, now = new Date()) {
  const me = requireSignedIn(actor);
  const input = stampEditSchema.parse(raw);
  assertCleanText({ caption: input.caption, "song title": input.song?.title, "song artist": input.song?.artist });
  await db.$transaction(async (tx) => {
    await lockStamp(tx, stampId);
    const stamp = await tx.photo.findUnique({ where: { id: stampId } });
    if (!stamp || stamp.removedAt) throw notFound("Stamp not found");
    assertCanEditOwnContent(me, stamp);
    if (stamp.hiddenAt) throw conflict("This stamp isn't available");
    const caption = input.caption ?? stamp.caption;
    const song = input.song === undefined ? (stamp.songTitle ? { title: stamp.songTitle, artist: stamp.songArtist!, artUrl: stamp.songArtUrl, sourceId: stamp.songSourceId } : null)
      : input.song && { title: input.song.title, artist: input.song.artist, artUrl: input.song.artUrl ?? null, sourceId: input.song.sourceId ?? null };
    const livePhotos = await tx.stampPhoto.count({ where: { stampId, removedAt: null } });
    if (livePhotos === 0 && !caption.trim() && !song) throw badRequest("A stamp needs a photo, a caption or a song");
    await tx.photo.update({ where: { id: stamp.id }, data: {
      caption, songTitle: song?.title ?? null, songArtist: song?.artist ?? null, songArtUrl: song?.artUrl ?? null, songSourceId: song?.sourceId ?? null, editedAt: now,
    } });
  });
  return getStamp(db, me, stampId, now);
}

export async function removeStamp(db: Db, actor: Actor | null, stampId: string, now = new Date()) {
  const me = requireSignedIn(actor);
  const stamp = await db.photo.findUnique({ where: { id: stampId } });
  if (!stamp || stamp.removedAt) throw notFound("Stamp not found");
  assertCanEditOwnContent(me, stamp);
  await db.photo.update({ where: { id: stamp.id }, data: { removedAt: now } });
  return { removed: true as const };
}

async function ownProfile(db: Db, actor: Actor | null, handle: string) {
  const me = requireSignedIn(actor);
  const user = await db.user.findUnique({ where: { handle: handle.toLowerCase() }, select: { id: true, deletedAt: true } });
  if (!user || user.deletedAt || user.id !== me.userId) throw notFound("User not found");
  return user;
}

const cursorOf = (p: { createdAt: Date; id: string }) => `${p.createdAt.toISOString()}_${p.id}`;
export function parseCursor(before: string) {
  const m = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)_([A-Za-z0-9_-]{1,64})$/.exec(before);
  const at = m ? new Date(m[1]!) : null;
  if (!m || !at || Number.isNaN(at.getTime())) throw badRequest("before: use the previous page's nextBefore");
  return { at, id: m[2]! };
}
export const beforeCursor = (c: { at: Date; id: string }) => ({ OR: [{ createdAt: { lt: c.at } }, { createdAt: c.at, id: { lt: c.id } }] });

export async function listUserStamps(db: Db, actor: Actor | null, handle: string, after?: string | null, now = new Date()) {
  const user = await ownProfile(db, actor, handle);
  const c = after ? parseCursor(after) : null;
  const rows = await db.photo.findMany({ where: {
    userId: user.id, hiddenAt: null, removedAt: null,
    ...(c ? { OR: [{ createdAt: { gt: c.at } }, { createdAt: c.at, id: { gt: c.id } }] } : {}),
  }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: STAMPS_PAGE + 1, select: stampSelect });
  const page = rows.slice(0, STAMPS_PAGE);
  return { stamps: await toStampViews(db, actor, page, now), nextAfter: rows.length > STAMPS_PAGE ? cursorOf(page[page.length - 1]!) : null };
}

export async function listUserPlaces(db: Db, actor: Actor | null, handle: string, now = new Date()) {
  const user = await ownProfile(db, actor, handle);
  const rows = await db.photo.findMany({ where: { userId: user.id, hiddenAt: null, removedAt: null }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: {
    id: true, createdAt: true, ...livePhotoCoverSelect, caption: true,
    venue: { select: { id: true, slug: true, name: true, neighborhood: true, lat: true, lng: true } },
  } });
  const places = new Map<string, { place: (typeof rows)[number]["venue"]; stamps: number; latest: (typeof rows)[number] }>();
  for (const r of rows) {
    const p = places.get(r.venue.id);
    if (p) p.stamps++;
    else places.set(r.venue.id, { place: r.venue, stamps: 1, latest: r });
  }
  return { places: await Promise.all([...places.values()].map(async ({ place, stamps, latest }) => ({
    place, stamps,
    latestStamp: { id: latest.id, createdAt: latest.createdAt, photoUrl: latest.photos[0] ? await uploadUrl(latest.photos[0].storageKey, now) : null, caption: latest.caption },
  }))) };
}

export const stampDay = (d: Date) => {
  const p = localParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};

export async function getMyPlacePage(db: Db, actor: Actor | null, idOrSlug: string, pos?: { lat: number; lng: number } | null, now = new Date()) {
  const me = requireSignedIn(actor);
  const place = await db.venue.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }, select: {
    id: true, slug: true, name: true, address: true, neighborhood: true, neighborhoodId: true, lat: true, lng: true, geofenceMeters: true, osmId: true,
  } });
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
  return { place: { ...rest, fromOsm: osmId !== null }, stamps, visits, inside: here === null ? null : here <= place.geofenceMeters, distanceM: here };
}
