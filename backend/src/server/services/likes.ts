/**
 * Likes on stamps: one per person per stamp, not your own, not on hidden or removed stamps, only on stamps you can see.
 * Counts exclude App Review likes. Likes never affect anything else (rule 10): they don't rank, feature or unlock.
 */
import type { Db } from "@/lib/db";
import type { Actor } from "@/server/actor";
import { badRequest, notFound } from "@/server/errors";
import { requireSignedIn } from "@/server/permissions";
import { subjectSelect } from "@/server/privacy";
import { consumeRate } from "@/server/rate-limit";
import { assertVisible } from "@/server/services/stamps";

export type LikeSummary = { count: number; viewerLiked: boolean };

/** Like counts (App Review likes excluded) and whether the viewer liked each stamp. */
export async function likeSummaries(db: Db, stampIds: readonly string[], viewerId: string | null | undefined): Promise<Map<string, LikeSummary>> {
  const ids = [...new Set(stampIds)];
  const out = new Map<string, LikeSummary>(ids.map((id) => [id, { count: 0, viewerLiked: false }]));
  if (!ids.length) return out;
  const [counts, mine] = await Promise.all([
    // Suspended accounts' likes don't show in counts (deleted accounts' likes are gone).
    db.photoLike.groupBy({ by: ["photoId"], where: { photoId: { in: ids }, countable: true, user: { suspendedAt: null } }, _count: { _all: true } }),
    viewerId ? db.photoLike.findMany({ where: { photoId: { in: ids }, userId: viewerId }, select: { photoId: true } }) : Promise.resolve([]),
  ]);
  for (const c of counts) out.get(c.photoId)!.count = c._count._all;
  for (const m of mine) out.get(m.photoId)!.viewerLiked = true;
  return out;
}

/** A stamp the viewer can see (hidden and removed ones 404 even for staff: nobody likes those), or 404. */
async function likeableStamp(db: Db, actor: Actor, stampId: string) {
  const row = await db.photo.findUnique({
    where: { id: stampId },
    select: { id: true, userId: true, hiddenAt: true, removedAt: true, countable: true, user: { select: subjectSelect } },
  });
  if (!row || row.hiddenAt || row.removedAt) throw notFound("Stamp not found");
  await assertVisible(db, actor, row);
  return row;
}

export async function likeStamp(db: Db, actor: Actor | null, stampId: string, now = new Date()) {
  const me = requireSignedIn(actor);
  const stamp = await likeableStamp(db, me, stampId);
  if (stamp.userId === me.userId) throw badRequest("You can't like your own stamp");
  await db.$transaction(async (tx) => {
    // Per (user, stamp) lock: a double tap can't hit the unique key and 500.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`like:${me.userId}:${stampId}`}))`;
    const existing = await tx.photoLike.findUnique({ where: { userId_photoId: { userId: me.userId, photoId: stampId } } });
    if (existing) return;
    await consumeRate(tx, me.userId, "like", now);
    await tx.photoLike.create({ data: { userId: me.userId, photoId: stampId, createdAt: now, countable: !me.geofenceExempt } });
  });
  return { liked: true, ...(await likeSummaries(db, [stampId], me.userId)).get(stampId)! };
}

export async function unlikeStamp(db: Db, actor: Actor | null, stampId: string) {
  const me = requireSignedIn(actor);
  // Unliking works even if the stamp has since become invisible to you: it only removes your own row.
  await db.photoLike.deleteMany({ where: { userId: me.userId, photoId: stampId } });
  // The count is only reported for a stamp you can still see.
  const visible = await likeableStamp(db, me, stampId).then(() => true, () => false);
  return { liked: false, ...(visible ? (await likeSummaries(db, [stampId], me.userId)).get(stampId)! : { count: 0, viewerLiked: false }) };
}
