/** Regular status from the posts table (see src/lib/regulars.ts for the rule). */
import type { Db } from "@/lib/db";
import { regularPairs, regularWindowStart } from "@/lib/regulars";

/** Posts that count toward Regular status. */
const countingPosts = (now: Date) =>
  ({ rating: { not: null }, hiddenAt: null, removedAt: null, countable: true, night: { gte: regularWindowStart(now) } }) as const;

/** Which of `userIds` are Regulars at this venue. */
export async function regularsAt(db: Db, venueId: string, userIds: readonly string[], now = new Date()): Promise<Set<string>> {
  if (!userIds.length) return new Set();
  const rows = await db.photo.findMany({
    where: { ...countingPosts(now), venueId, userId: { in: [...new Set(userIds)] } },
    select: { userId: true, venueId: true, night: true, createdAt: true },
  });
  const pairs = regularPairs(rows, now);
  return new Set(userIds.filter((id) => pairs.has(`${id}:${venueId}`)));
}

/** Venues where this person is a Regular, by name. */
export async function regularVenuesOf(db: Db, userId: string, now = new Date()) {
  const rows = await db.photo.findMany({
    where: { ...countingPosts(now), userId },
    select: { userId: true, venueId: true, night: true, createdAt: true },
  });
  const pairs = regularPairs(rows, now);
  const ids = [...new Set(rows.map((r) => r.venueId))].filter((v) => pairs.has(`${userId}:${v}`));
  if (!ids.length) return [];
  return db.venue.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" }, select: { name: true, slug: true } });
}
