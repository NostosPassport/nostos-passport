/**
 * Nightly featuring. Runs just after each night ends (5:05am America/New_York, POST /api/cron/featured).
 *
 * For every completed night in the last 7 that hasn't been processed, and every venue: rank that night's shared,
 * visible posts by eligible likes (src/lib/likes.ts) and store the top 20 with at least 3 eligible likes, with their
 * rank. The night is marked in `featured_run` in the same transaction.
 *
 * Deterministic whenever it runs: likes and account age are judged at the night's cutoff (5:05am, the scheduled
 * time), so a late or catch-up run features exactly what an on-time run would have (reputation, ownership and
 * suspension are read at run time). Idempotent and safe twice: each night is processed in one transaction that
 * first takes that night's advisory lock and skips a night already in `featured_run`; both tables are append-only
 * with database guards. One night failing (e.g. a moderator hides a photo mid-run) doesn't stop the others; the next
 * run retries it. Featuring never touches the live feed's order, consensus, counts or reputation, and venues can't
 * influence it.
 */
import type { Db } from "@/lib/db";
import { FEATURE_CUTOFF_AFTER_NIGHT_MS, isEligibleLike, rankNight, type Liker } from "@/lib/likes";
import { addNights, nightBounds, nightKey } from "@/lib/time";

/** How far back a late or missed run catches up. */
export const FEATURING_CATCHUP_NIGHTS = 7;

/** Likes count until then: the night's end plus 5 minutes. */
export const featuringCutoff = (night: string) => new Date(nightBounds(night).end.getTime() + FEATURE_CUTOFF_AFTER_NIGHT_MS);

/**
 * Completed nights (ended by `now`) within the catch-up window, oldest first. Walks night keys by calendar day, so
 * daylight saving time can't skip a night (subtracting 24 hours across spring-forward would).
 */
export function completedNights(now: Date): string[] {
  const today = nightKey(now);
  const out: string[] = [];
  for (let d = FEATURING_CATCHUP_NIGHTS; d >= 1; d--) {
    const key = addNights(today, -d);
    if (nightBounds(key).end <= now) out.push(key);
  }
  return out;
}

type NightResult = { status: "done"; featured: number } | { status: "already" } | { status: "busy" };

async function featureNight(db: Db, night: string, now: Date): Promise<NightResult> {
  const cutoff = featuringCutoff(night);
  return db.$transaction(
    async (tx) => {
      // The lock and the work share this transaction's connection (safe behind PgBouncer in transaction mode).
      const got = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext(${`featuring:${night}`})) AS locked`;
      if (!got[0]?.locked) return { status: "busy" as const };
      if (await tx.featuredRun.findUnique({ where: { night } })) return { status: "already" as const };
      const posts = await tx.photo.findMany({
        where: { night, rating: { not: null }, shared: true, hiddenAt: null, removedAt: null, countable: true, user: { deletedAt: null, suspendedAt: null } },
        select: {
          id: true, userId: true, venueId: true, createdAt: true,
          likes: {
            where: { createdAt: { lte: cutoff } },
            select: {
              countable: true, createdAt: true,
              user: {
                select: {
                  id: true, role: true, createdAt: true, reputation: true, deletedAt: true, suspendedAt: true, geofenceExempt: true,
                  claims: { where: { status: "APPROVED" }, select: { venueId: true } },
                },
              },
            },
          },
        },
      });
      const byVenue = new Map<string, { id: string; createdAt: Date; eligibleLikes: number }[]>();
      for (const p of posts) {
        const eligibleLikes = p.likes.filter((l) => {
          const liker: Liker = {
            id: l.user.id, role: l.user.role, createdAt: l.user.createdAt, reputation: l.user.reputation, geofenceExempt: l.user.geofenceExempt,
            deleted: l.user.deletedAt !== null, suspended: l.user.suspendedAt !== null, ownedVenueIds: l.user.claims.map((c) => c.venueId),
          };
          return isEligibleLike(l, liker, { authorId: p.userId, venueId: p.venueId }, cutoff);
        }).length;
        byVenue.set(p.venueId, [...(byVenue.get(p.venueId) ?? []), { id: p.id, createdAt: p.createdAt, eligibleLikes }]);
      }
      const rows = [...byVenue].flatMap(([venueId, candidates]) =>
        rankNight(candidates).map((r) => ({ venueId, night, photoId: r.id, rank: r.rank, eligibleLikes: r.eligibleLikes, createdAt: now })),
      );
      await tx.featuredRun.create({ data: { night, ranAt: now, featured: rows.length } });
      if (rows.length) await tx.featuredPhoto.createMany({ data: rows });
      return { status: "done" as const, featured: rows.length };
    },
    { timeout: 60_000 },
  );
}

/**
 * Processes every completed, unprocessed night in the catch-up window. `nights` = nights this run featured;
 * `skipped` = another run was processing a night at the same time; `failed` = nights that errored (retried next run).
 */
export async function runFeaturing(db: Db, now = new Date()) {
  const done = new Set((await db.featuredRun.findMany({ where: { night: { in: completedNights(now) } }, select: { night: true } })).map((r) => r.night));
  const nights: string[] = [];
  const failed: string[] = [];
  let featured = 0;
  let skipped = false;
  for (const night of completedNights(now).filter((n) => !done.has(n))) {
    try {
      const r = await featureNight(db, night, now);
      if (r.status === "busy") skipped = true;
      if (r.status === "done") {
        nights.push(night);
        featured += r.featured;
      }
    } catch (err) {
      console.error(`[featuring] night ${night} failed; the next run retries it`, err);
      failed.push(night);
    }
  }
  return { nights, featured, skipped, failed };
}
