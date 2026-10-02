/**
 * The featured gallery on a bar's page: "This month's best" (every featured photo from nights in the current
 * calendar month, New York time, newest night first) and an archive of past months ("September's best").
 * Each night shows its top 10 still-visible featured photos: if a moderator hides one (or its author removes or
 * unshares it), the next-ranked one takes its place. Venues can't pick, hide or reorder any of it; every photo keeps
 * Report. Authors are resolved per viewer, and a viewer never sees photos by someone they blocked (or who blocked them).
 */
import { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { visibleTop } from "@/lib/likes";
import { localParts } from "@/lib/time";
import type { Actor } from "@/server/actor";
import { badRequest, notFound } from "@/server/errors";
import { authorResolver, subjectSelect, toSubject, type SubjectRow } from "@/server/privacy";
import { likeSummaries } from "@/server/services/likes";
import { regularsAt } from "@/server/services/regulars";
import { uploadUrl } from "@/server/services/venues";

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM" of the current New York calendar month. */
export const currentMonth = (now: Date) => {
  const p = localParts(now);
  return `${p.year}-${pad(p.month)}`;
};

/** Photos on this month's preview on the venue page; the rest is on the month screen. */
export const MONTH_PREVIEW = 30;

const featuredSelect = {
  night: true, rank: true,
  photo: {
    select: {
      id: true, userId: true, storageKey: true, caption: true, createdAt: true, rating: true, shared: true, hiddenAt: true, removedAt: true, countable: true,
      user: { select: subjectSelect },
    },
  },
} as const;

type FeaturedRow = {
  night: string;
  rank: number;
  photo: {
    id: string; userId: string; storageKey: string; caption: string; createdAt: Date; rating: number | null; shared: boolean;
    hiddenAt: Date | null; removedAt: Date | null; countable: boolean; user: SubjectRow;
  };
};

/** Still visible to everyone: shared, not hidden or removed, not App Review, author not deleted or suspended. */
const stillVisible = (r: FeaturedRow) =>
  r.photo.shared && !r.photo.hiddenAt && !r.photo.removedAt && r.photo.countable && !r.photo.user.deletedAt && !r.photo.user.suspendedAt;

/** Group by night (newest first) and keep each night's top 10 visible to this viewer. */
function topPerNight(rows: FeaturedRow[], blocked: Set<string>) {
  const nights = new Map<string, FeaturedRow[]>();
  for (const r of rows) nights.set(r.night, [...(nights.get(r.night) ?? []), r]);
  return [...nights]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([night, list]) => ({ night, rows: visibleTop(list, (r) => stillVisible(r) && !blocked.has(r.photo.userId)) }));
}

type Resolver = Awaited<ReturnType<typeof authorResolver>>;

async function views(db: Db, actor: Actor | null, resolve: Resolver, venueId: string, nights: { night: string; rows: FeaturedRow[] }[], now: Date) {
  const all = nights.flatMap((n) => n.rows);
  const authorIds = all.map((r) => r.photo.userId);
  const [regulars, likes] = await Promise.all([regularsAt(db, venueId, authorIds, now), likeSummaries(db, all.map((r) => r.photo.id), actor?.userId)]);
  return Promise.all(
    nights.map(async (n) => ({
      night: n.night,
      photos: await Promise.all(
        n.rows.map(async (r, i) => ({
          id: r.photo.id,
          url: await uploadUrl(r.photo.storageKey, now),
          caption: r.photo.caption,
          createdAt: r.photo.createdAt,
          rating: r.photo.rating,
          author: resolve.author(toSubject(r.photo.user), regulars.has(r.photo.userId)),
          mine: actor?.userId === r.photo.userId,
          likes: likes.get(r.photo.id)!,
          night: r.night,
          /** Position in this night's gallery (1-10), after any hidden photos were skipped. */
          rank: i + 1,
        })),
      ),
    })),
  );
}

/**
 * One month's gallery, newest night first. `limit` caps the photos built (signed URLs, likes, Regular status), for
 * the venue page's preview; `total` is the full count for the viewer.
 */
export async function featuredMonth(db: Db, actor: Actor | null, venueId: string, month: string, now = new Date(), limit = Infinity) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw badRequest("month: YYYY-MM");
  const rows = (await db.featuredPhoto.findMany({ where: { venueId, night: { startsWith: `${month}-` } }, select: featuredSelect })) as FeaturedRow[];
  const resolve = await authorResolver(db, actor, rows.map((r) => r.photo.userId));
  const nights = topPerNight(rows, resolve.blocks);
  const total = nights.reduce((n, x) => n + x.rows.length, 0);
  // Keep the first `limit` photos (newest nights first), dropping emptied nights.
  let left = limit;
  const kept = nights.map((n) => {
    const take = n.rows.slice(0, Math.max(0, left));
    left -= take.length;
    return { night: n.night, rows: take };
  }).filter((n) => n.rows.length > 0);
  return { month, nights: await views(db, actor, resolve, venueId, kept, now), total };
}

/** Past months with featured photos, newest first, and how many each shows (before the viewer's blocks). */
export async function featuredArchive(db: Db, venueId: string, now = new Date()) {
  const before = `${currentMonth(now)}-01`;
  const rows = await db.$queryRaw<{ month: string; count: bigint }[]>(Prisma.sql`
    SELECT month, count(*) AS count FROM (
      SELECT substr(f.night, 1, 7) AS month, row_number() OVER (PARTITION BY f.night ORDER BY f.rank) AS n
      FROM featured_photo f
      JOIN photo p ON p.id = f.photo_id
      JOIN app_user u ON u.id = p.user_id
      WHERE f.venue_id = ${venueId} AND f.night < ${before}
        AND p.shared AND p.hidden_at IS NULL AND p.removed_at IS NULL AND p.countable
        AND u.deleted_at IS NULL AND u.suspended_at IS NULL
    ) visible
    WHERE n <= 10
    GROUP BY month
    ORDER BY month DESC`);
  return rows.map((r) => ({ month: r.month, count: Number(r.count) }));
}

/** The venue page's gallery section: this month's preview plus the archive list. */
export async function venueGallery(db: Db, actor: Actor | null, venueId: string, now = new Date()) {
  const month = currentMonth(now);
  const [thisMonth, archive] = await Promise.all([featuredMonth(db, actor, venueId, month, now, MONTH_PREVIEW), featuredArchive(db, venueId, now)]);
  return { thisMonth: { month, photos: thisMonth.nights.flatMap((n) => n.photos), total: thisMonth.total }, archive };
}

/**
 * "Featured at Lantern & Lark, October" for a profile: the person's photos currently shown in a gallery (top 10
 * visible for their night), grouped by venue and month, newest first. Needs full profile access (the caller checks).
 */
export async function featuredHistory(db: Db, userId: string) {
  const mine = await db.featuredPhoto.findMany({ where: { photo: { userId } }, select: { venueId: true, night: true } });
  if (!mine.length) return [];
  const keys = [...new Set(mine.map((m) => `${m.venueId}|${m.night}`))];
  const rows = (await db.featuredPhoto.findMany({
    where: { OR: keys.map((k) => ({ venueId: k.split("|")[0]!, night: k.split("|")[1]! })) },
    select: { ...featuredSelect, venueId: true, venue: { select: { name: true, slug: true } } },
  })) as (FeaturedRow & { venueId: string; venue: { name: string; slug: string } })[];
  const out = new Map<string, { venue: { name: string; slug: string }; month: string; count: number }>();
  for (const key of keys) {
    const [venueId, night] = key.split("|") as [string, string];
    const shown = visibleTop(rows.filter((r) => r.venueId === venueId && r.night === night), stillVisible);
    const count = shown.filter((r) => r.photo.userId === userId).length;
    if (!count) continue;
    const month = night.slice(0, 7);
    const k = `${venueId}|${month}`;
    const entry = out.get(k) ?? { venue: shown[0]!.venue, month, count: 0 };
    entry.count += count;
    out.set(k, entry);
  }
  return [...out.values()].sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : a.venue.name.localeCompare(b.venue.name)));
}

export async function assertVenue(db: Db, idOrSlug: string) {
  const v = await db.venue.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }, select: { id: true } });
  if (!v) throw notFound("Venue not found");
  return v;
}
