import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { HOUR_MS, DAY_MS } from "@/lib/time";
import { tooMany } from "@/server/errors";

export const RATE_LIMITS = {
  post: { max: 20, windowMs: HOUR_MS, message: "You've stamped a lot recently. Try again later." },
  song_search: { max: 120, windowMs: HOUR_MS, message: "You've searched for a lot of songs recently. Try again later." },
} as const;

export type RateKind = keyof typeof RATE_LIMITS;

export async function consumeRate(tx: Prisma.TransactionClient, userId: string, kind: RateKind, now: Date) {
  const limit = RATE_LIMITS[kind];
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rate:${kind}:${userId}`}))`;
  const recent = await tx.rateEvent.count({ where: { userId, kind, createdAt: { gt: new Date(now.getTime() - limit.windowMs) } } });
  if (recent >= limit.max) throw tooMany(limit.message);
  await tx.rateEvent.create({ data: { userId, kind, createdAt: now } });
}

export async function pruneRateEvents(db: Db, now = new Date()) {
  const { count } = await db.rateEvent.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - DAY_MS) } } });
  return count;
}
