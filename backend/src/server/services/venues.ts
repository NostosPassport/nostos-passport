/**
 * Read models for the map and the venue page.
 *
 * Invariant 2 (paid promos never affect user content): nothing in this file that orders, filters or weights
 * reports, photos, comments or the map list reads the promo table. Promos are fetched separately and only
 * attached for display (always labelled). Tests assert identical output with and without a paid promo.
 * Invariant 6: the live photo feed only contains photos with created_at in (now-3h, now].
 */
import type { LineWait, Prisma, Vibe } from "@prisma/client";
import type { Db } from "@/lib/db";
import { computeAccuracy, ACCURACY_LOOKBACK_MS, type AccuracyResult } from "@/lib/accuracy";
import {
  coverConsensus, coverMismatch, lineConsensus, vibeConsensus, MAX_AGE_MS, MIN_DATA_WINDOW_MS,
  type Consensus, type ConsensusReport,
} from "@/lib/consensus";
import { nightKey } from "@/lib/time";
import type { Actor } from "@/server/actor";
import { notFound } from "@/server/errors";
import { getStorage } from "@/lib/storage";
import { OSM_ATTRIBUTION } from "@/lib/osm";
import { blockedIdsFor } from "@/server/services/blocks";
import { authorResolver, subjectSelect, toSubject, type SubjectRow } from "@/server/privacy";
import { regularsAt } from "@/server/services/regulars";
import { likeSummaries, type LikeSummary } from "@/server/services/likes";
import { venueGallery } from "@/server/services/gallery";

export const PRESENCE_TTL_MS = 45 * 60_000;
/** Live photos are those newer than 3 hours; "Earlier" shows the previous 21 hours, collapsed. */
export const LIVE_PHOTO_MS = MAX_AGE_MS;
export const EARLIER_PHOTO_MS = 24 * 60 * 60_000;

export type VibeState = Vibe | "NO_DATA";

type LiveReportRow = {
  venueId: string;
  userId: string;
  type: "VIBE" | "LINE" | "COVER";
  vibe: Vibe | null;
  line: LineWait | null;
  coverCents: number | null;
  createdAt: Date;
  user: { reputation: number };
};

/**
 * Posts by geofence-exempt accounts (App Review / QA) are stored but never counted. Each report, photo,
 * comment, presence and RSVP row carries a `countable` snapshot taken when it was written, and every
 * aggregate (consensus, activity, here/going counts, accuracy, reputation, friends going) filters on it.
 * Snapshotting means later changes to the author's flag, or deleting the account, can't retroactively
 * add or remove data.
 */
export const COUNTABLE_AUTHOR = { countable: true } as const;

async function liveReportsFor(db: Db, now: Date, venueIds?: string[]): Promise<LiveReportRow[]> {
  return db.report.findMany({
    where: {
      ...COUNTABLE_AUTHOR,
      hiddenAt: null,
      createdAt: { gt: new Date(now.getTime() - MAX_AGE_MS), lte: now },
      ...(venueIds ? { venueId: { in: venueIds } } : {}),
    },
    select: {
      venueId: true, userId: true, type: true, vibe: true, line: true, coverCents: true, createdAt: true,
      user: { select: { reputation: true } },
    },
  });
}

export function consensusFromRows(rows: readonly LiveReportRow[], now: Date) {
  const pick = <T,>(type: LiveReportRow["type"], get: (r: LiveReportRow) => T | null): ConsensusReport<T>[] =>
    rows
      .filter((r) => r.type === type && get(r) !== null)
      .map((r) => ({ userId: r.userId, value: get(r) as T, createdAt: r.createdAt, reputation: r.user.reputation }));
  return {
    vibe: vibeConsensus(pick<Vibe>("VIBE", (r) => r.vibe), now),
    line: lineConsensus(pick<LineWait>("LINE", (r) => r.line), now),
    cover: coverConsensus(pick<number>("COVER", (r) => r.coverCents), now),
  };
}

async function countsFor(db: Db, now: Date, venueIds?: string[]) {
  const whereVenue = venueIds ? { venueId: { in: venueIds } } : {};
  const [here, going] = await Promise.all([
    db.presence.groupBy({
      by: ["venueId"],
      where: { ...whereVenue, ...COUNTABLE_AUTHOR, lastSeenAt: { gt: new Date(now.getTime() - PRESENCE_TTL_MS), lte: now } },
      _count: { _all: true },
    }),
    db.rsvp.groupBy({ by: ["venueId"], where: { ...whereVenue, ...COUNTABLE_AUTHOR, night: nightKey(now) }, _count: { _all: true } }),
  ]);
  return {
    here: new Map(here.map((h) => [h.venueId, h._count._all])),
    going: new Map(going.map((g) => [g.venueId, g._count._all])),
  };
}

/** Friends going: mutual follows of the viewer who RSVP'd tonight, grouped by venue (see social.ts on privacy). */
async function friendsGoing(db: Db, viewer: Actor | null, now: Date, venueIds?: string[]) {
  const out = new Map<string, { handle: string; displayName: string }[]>();
  if (!viewer) return out;
  const rows = await db.rsvp.findMany({
    where: {
      night: nightKey(now),
      countable: true,
      ...(venueIds ? { venueId: { in: venueIds } } : {}),
      user: { deletedAt: null, suspendedAt: null, followers: { some: { followerId: viewer.userId } }, following: { some: { followeeId: viewer.userId } } },
    },
    select: { venueId: true, user: { select: { handle: true, displayName: true } } },
    orderBy: { createdAt: "asc" },
  });
  for (const r of rows) out.set(r.venueId, [...(out.get(r.venueId) ?? []), r.user]);
  return out;
}

/**
 * Live activity score used by the "live activity" sort: people here now, plus distinct reporters in the
 * last hour. Pure function of user-generated data; promos are not an input.
 */
export function liveActivityScore(hereNow: number, rows: readonly { userId: string; createdAt: Date }[], now: Date) {
  const recentUsers = new Set(rows.filter((r) => now.getTime() - r.createdAt.getTime() < MIN_DATA_WINDOW_MS).map((r) => r.userId));
  return hereNow * 2 + recentUsers.size;
}

export type MapVenue = {
  id: string;
  slug: string;
  name: string;
  address: string;
  neighborhood: string;
  lat: number;
  lng: number;
  vibe: VibeState;
  vibeReports: number;
  hereNow: number;
  goingTonight: number;
  friendsGoing: number;
  activity: number;
  /** Display-only; never used for ordering. */
  promoted: boolean;
  /** Imported from OpenStreetMap (show "© OpenStreetMap contributors"). */
  fromOsm: boolean;
};

export async function listVenuesForMap(db: Db, viewer: Actor | null, now = new Date()): Promise<MapVenue[]> {
  const [venues, rows, counts, friends, promos] = await Promise.all([
    db.venue.findMany({ orderBy: { name: "asc" }, select: { id: true, slug: true, name: true, address: true, neighborhood: true, lat: true, lng: true, osmId: true } }),
    liveReportsFor(db, now),
    countsFor(db, now),
    friendsGoing(db, viewer, now),
    db.promo.findMany({ where: { isPaid: true, startsAt: { lte: now }, endsAt: { gt: now } }, select: { venueId: true } }),
  ]);
  const byVenue = new Map<string, LiveReportRow[]>();
  for (const r of rows) byVenue.set(r.venueId, [...(byVenue.get(r.venueId) ?? []), r]);
  const promoted = new Set(promos.map((p) => p.venueId));

  return venues.map(({ osmId, ...v }) => {
    const vr = byVenue.get(v.id) ?? [];
    const { vibe } = consensusFromRows(vr, now);
    const hereNow = counts.here.get(v.id) ?? 0;
    return {
      ...v,
      vibe: vibe.status === "ok" ? vibe.value : "NO_DATA",
      vibeReports: vibe.reportCount,
      hereNow,
      goingTonight: counts.going.get(v.id) ?? 0,
      friendsGoing: friends.get(v.id)?.length ?? 0,
      activity: liveActivityScore(hereNow, vr, now),
      promoted: promoted.has(v.id),
      fromOsm: osmId !== null,
    };
  });
}

/** ODbL attribution to show with a venue list, when any venue in it came from OpenStreetMap. */
export function attributionFor(venues: readonly { fromOsm: boolean }[]) {
  return venues.some((v) => v.fromOsm) ? OSM_ATTRIBUTION : null;
}

export { sortVenues, type SortKey } from "@/lib/sort-venues";

// ---------------------------------------------------------------------------------------------
// Venue page
// ---------------------------------------------------------------------------------------------

export type HoursEntry = { day: number; open: string; close: string };

export async function venueAccuracy(db: Db, venueId: string, now = new Date()): Promise<AccuracyResult> {
  const [reports, history] = await Promise.all([
    db.report.findMany({
      where: { venueId, type: "COVER", hiddenAt: null, ...COUNTABLE_AUTHOR, createdAt: { gt: new Date(now.getTime() - ACCURACY_LOOKBACK_MS), lte: now } },
      select: { userId: true, coverCents: true, createdAt: true, user: { select: { reputation: true } } },
    }),
    db.venueCoverHistory.findMany({ where: { venueId }, select: { coverCents: true, effectiveFrom: true } }),
  ]);
  return computeAccuracy({
    reports: reports.map((r) => ({ userId: r.userId, coverCents: r.coverCents!, createdAt: r.createdAt, reputation: r.user.reputation })),
    history,
    now,
  });
}

/**
 * Short-lived signed GET URL for a stored image (15-20 min, see lib/storage). Only ever called for content the
 * viewer may see: visible photos, the official photo, or (for moderators) flagged photos in the queue.
 */
export const uploadUrl = (key: string, now = new Date()) => getStorage().signedUrl(key, now);

// Explicit selects: the venue page never ships photo/report coordinates, raw storage keys or user ids. Authors are
// resolved per viewer by src/server/privacy.ts (private accounts the viewer doesn't follow read "Anonymous").
const photoSelect = {
  id: true, userId: true, storageKey: true, caption: true, createdAt: true, rating: true,
  user: { select: subjectSelect },
} as const;

type PhotoRow = { id: string; userId: string; storageKey: string; caption: string; createdAt: Date; rating: number | null; user: SubjectRow };
type Resolver = Awaited<ReturnType<typeof authorResolver>>;
const toPhotoView = (viewerId: string | null, resolve: Resolver, regulars: Set<string>, likes: Map<string, LikeSummary>, now: Date) => async (p: PhotoRow) => ({
  id: p.id,
  url: await uploadUrl(p.storageKey, now),
  caption: p.caption,
  createdAt: p.createdAt,
  /** null = a live-only photo; 1-10 = a shared post. */
  rating: p.rating,
  author: resolve.author(toSubject(p.user), regulars.has(p.userId)),
  mine: viewerId === p.userId,
  /** Shared posts only (live-only photos can't be liked). */
  likes: p.rating === null ? null : likes.get(p.id)!,
});

/** Photos in a venue feed: live-only photos and shared posts, never hidden or removed ones. */
export const VENUE_FEED_PHOTO: Prisma.PhotoWhereInput = { hiddenAt: null, removedAt: null, OR: [{ rating: null }, { shared: true }] };

export async function getVenuePage(db: Db, slug: string, viewer: Actor | null, now = new Date()) {
  const venue = await db.venue.findUnique({ where: { slug } });
  if (!venue) throw notFound("Venue not found");
  const viewerId = viewer?.userId ?? null;
  // Blocking hides each side's photos and comments from the other (aggregates are unaffected).
  const blocked = await blockedIdsFor(db, viewerId);
  const visibleAuthor = {
    userId: { notIn: blocked },
    // Exempt (App Review) photos and comments are visible only to their author, so they never pollute a real venue.
    AND: [{ OR: [{ countable: true }, ...(viewerId ? [{ userId: viewerId }] : [])] }],
  };

  const liveSince = new Date(now.getTime() - LIVE_PHOTO_MS);
  const [rows, counts, friends, promos, livePhotos, earlierPhotos, comments, accuracy, myRsvp, myPresence] = await Promise.all([
    liveReportsFor(db, now, [venue.id]),
    countsFor(db, now, [venue.id]),
    friendsGoing(db, viewer, now, [venue.id]),
    db.promo.findMany({
      where: { venueId: venue.id, startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { startsAt: "desc" },
      select: { id: true, title: true, body: true, isPaid: true, endsAt: true },
    }),
    db.photo.findMany({
      where: { venueId: venue.id, ...VENUE_FEED_PHOTO, createdAt: { gt: liveSince, lte: now }, ...visibleAuthor },
      orderBy: { createdAt: "desc" },
      select: photoSelect,
    }),
    db.photo.findMany({
      where: { venueId: venue.id, ...VENUE_FEED_PHOTO, createdAt: { gt: new Date(now.getTime() - EARLIER_PHOTO_MS), lte: liveSince }, ...visibleAuthor },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: photoSelect,
    }),
    db.comment.findMany({
      where: { venueId: venue.id, parentId: null, hiddenAt: null, ...visibleAuthor },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, userId: true, body: true, createdAt: true, editedAt: true,
        user: { select: subjectSelect },
        replies: {
          where: { hiddenAt: null, userId: { notIn: blocked }, OR: [{ countable: true }, ...(viewerId ? [{ userId: viewerId }] : [])] },
          orderBy: { createdAt: "asc" },
          select: { id: true, userId: true, body: true, createdAt: true, user: { select: subjectSelect } },
        },
      },
    }),
    venueAccuracy(db, venue.id, now),
    viewer ? db.rsvp.findUnique({ where: { userId_venueId_night: { userId: viewer.userId, venueId: venue.id, night: nightKey(now) } } }) : null,
    viewer ? db.presence.findUnique({ where: { userId: viewer.userId } }) : null,
  ]);

  const consensus = consensusFromRows(rows, now);
  const authorIds = [
    ...livePhotos.map((p) => p.userId), ...earlierPhotos.map((p) => p.userId),
    ...comments.flatMap((c) => [c.userId, ...c.replies.map((r) => r.userId)]),
  ];
  // The Regular badge rides on the resolved author, so it only ever appears next to a handle the viewer may see.
  const posts = [...livePhotos, ...earlierPhotos].filter((p) => p.rating !== null).map((p) => p.id);
  const [resolve, regulars, likes, gallery] = await Promise.all([
    authorResolver(db, viewer, authorIds),
    regularsAt(db, venue.id, authorIds, now),
    likeSummaries(db, posts, viewerId),
    venueGallery(db, viewer, venue.id, now),
  ]);
  return {
    official: {
      id: venue.id,
      slug: venue.slug,
      name: venue.name,
      address: venue.address,
      neighborhood: venue.neighborhood,
      // The venue's own public coordinates (map pin + geofence hint). The only coordinates in this payload.
      lat: venue.lat,
      lng: venue.lng,
      hours: (venue.hours as HoursEntry[]) ?? [],
      officialCoverCents: venue.officialCoverCents,
      dressCode: venue.dressCode,
      officialPhotoUrl: venue.officialPhotoKey ? await uploadUrl(venue.officialPhotoKey, now) : null,
      /** Non-null for venues imported from OpenStreetMap (ODbL requires attribution wherever the data is shown). */
      attribution: venue.osmId ? OSM_ATTRIBUTION : null,
      promos,
      accuracy,
    },
    live: {
      hereNow: counts.here.get(venue.id) ?? 0,
      goingTonight: counts.going.get(venue.id) ?? 0,
      friendsGoing: friends.get(venue.id) ?? [],
      consensus,
      coverMismatch: coverMismatch(venue.officialCoverCents, consensus.cover),
      livePhotos: await Promise.all(livePhotos.map(toPhotoView(viewerId, resolve, regulars, likes, now))),
      earlierPhotos: await Promise.all(earlierPhotos.map(toPhotoView(viewerId, resolve, regulars, likes, now))),
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        editedAt: c.editedAt,
        // Deleted accounts keep their comments, shown as "Deleted user".
        author: resolve.author(toSubject(c.user), regulars.has(c.userId)),
        mine: viewerId === c.userId,
        replies: c.replies.map((r) => ({
          id: r.id, body: r.body, createdAt: r.createdAt, author: resolve.author(toSubject(r.user), regulars.has(r.userId)), mine: viewerId === r.userId,
        })),
      })),
    },
    /** "This month's best" and the archive of past months (the venue can't influence either). */
    featured: gallery,
    viewer: {
      going: Boolean(myRsvp),
      hereNow: Boolean(myPresence && myPresence.venueId === venue.id && now.getTime() - myPresence.lastSeenAt.getTime() < PRESENCE_TTL_MS),
      ownsVenue: Boolean(viewer?.ownedVenueIds.includes(venue.id)),
    },
    now,
  };
}

export type VenuePage = Awaited<ReturnType<typeof getVenuePage>>;
export type ConsensusView<T> = Consensus<T>;
