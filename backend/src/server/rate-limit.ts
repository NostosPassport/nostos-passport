/**
 * Per-user rate limits for social actions (follows and requests, likes, posts). Same pattern as the report cooldown
 * and the flag limit: a transaction-scoped advisory lock on (kind, user) makes the count exact under parallel
 * requests, and works behind PgBouncer in transaction mode. Actions are counted in the `rate_event` ledger rather
 * than from the rows they create, because unfollowing and unliking delete those rows.
 */
import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { HOUR_MS, DAY_MS } from "@/lib/time";
import { tooMany } from "@/server/errors";

export const RATE_LIMITS = {
  /** Follows and follow requests. */
  follow: { max: 60, windowMs: HOUR_MS, message: "You've followed a lot of people recently. Try again later." },
  like: { max: 200, windowMs: HOUR_MS, message: "You've liked a lot of posts recently. Try again later." },
  /** Across all venues (each venue also has the 15-minute photo cooldown). */
  post: { max: 20, windowMs: HOUR_MS, message: "You've posted a lot recently. Try again later." },
} as const;

export type RateKind = keyof typeof RATE_LIMITS;

/** Counts one action against the user's limit, or throws 429. Must run inside a transaction. */
export async function consumeRate(tx: Prisma.TransactionClient, userId: string, kind: RateKind, now: Date) {
  const limit = RATE_LIMITS[kind];
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rate:${kind}:${userId}`}))`;
  const recent = await tx.rateEvent.count({ where: { userId, kind, createdAt: { gt: new Date(now.getTime() - limit.windowMs) } } });
  if (recent >= limit.max) throw tooMany(limit.message);
  await tx.rateEvent.create({ data: { userId, kind, createdAt: now } });
}

/** Deletes ledger rows older than a day (every window is shorter). Run by the cron job. */
export async function pruneRateEvents(db: Db, now = new Date()) {
  const { count } = await db.rateEvent.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - DAY_MS) } } });
  return count;
}
