/**
 * Likes on shared posts. Anyone signed in can like a shared post they can see (on the venue page or the author's
 * profile), once; never their own; unlike is allowed. Counts exclude App Review likes. Likes never touch
 * consensus, counts, accuracy or reputation; only eligible ones (src/lib/likes.ts) count toward featuring, and
 * only in the nightly job.
 */
import type { Db } from "@/lib/db";
import type { Actor } from "@/server/actor";
import { badRequest, notFound } from "@/server/errors";
import { requireSignedIn } from "@/server/permissions";
import { authorResolver, canSeePhoto, subjectSelect, toSubject } from "@/server/privacy";
import { consumeRate } from "@/server/rate-limit";

export type LikeSummary = { count: number; viewerLiked: boolean };

/** Like counts (App Review likes excluded) and whether the viewer liked each photo. */
export async function likeSummaries(db: Db, photoIds: readonly string[], viewerId: string | null | undefined): Promise<Map<string, LikeSummary>> {
  const ids = [...new Set(photoIds)];
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

/** A shared post the viewer can see, or 404 (the same rule as post detail). */
async function likeablePost(db: Db, actor: Actor, photoId: string) {
  const p = await db.photo.findUnique({
    where: { id: photoId },
    select: { id: true, userId: true, rating: true, shared: true, hiddenAt: true, removedAt: true, countable: true, user: { select: subjectSelect } },
  });
  if (!p || p.rating === null || !p.shared || p.user.deletedAt || p.user.suspendedAt) throw notFound("Post not found");
  const resolve = await authorResolver(db, actor, [p.userId]);
  const subject = { authorId: p.userId, rating: p.rating, shared: p.shared, hidden: p.hiddenAt !== null, removed: p.removedAt !== null, countable: p.countable };
  // Staff pass canSeePhoto for hidden posts; nobody likes a hidden or removed post.
  if (subject.hidden || subject.removed || !canSeePhoto(resolve.viewer, subject, resolve.access(toSubject(p.user)), resolve.blocks.has(p.userId))) {
    throw notFound("Post not found");
  }
  return p;
}

export async function likePost(db: Db, actor: Actor | null, photoId: string, now = new Date()) {
  const me = requireSignedIn(actor);
  const post = await likeablePost(db, me, photoId);
  if (post.userId === me.userId) throw badRequest("You can't like your own post");
  await db.$transaction(async (tx) => {
    // Per (user, post) lock: a double tap can't hit the unique key and 500.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`like:${me.userId}:${photoId}`}))`;
    const existing = await tx.photoLike.findUnique({ where: { userId_photoId: { userId: me.userId, photoId } } });
    if (existing) return;
    await consumeRate(tx, me.userId, "like", now);
    await tx.photoLike.create({ data: { userId: me.userId, photoId, createdAt: now, countable: !me.geofenceExempt } });
  });
  return { liked: true, ...(await likeSummaries(db, [photoId], me.userId)).get(photoId)! };
}

export async function unlikePost(db: Db, actor: Actor | null, photoId: string) {
  const me = requireSignedIn(actor);
  // Unliking works even if the post has since become invisible to you (e.g. unshared): it only removes your own row.
  await db.photoLike.deleteMany({ where: { userId: me.userId, photoId } });
  // The count is only reported for a post you can still see.
  const visible = await likeablePost(db, me, photoId).then(() => true, () => false);
  return { liked: false, ...(visible ? (await likeSummaries(db, [photoId], me.userId)).get(photoId)! : { count: 0, viewerLiked: false }) };
}
