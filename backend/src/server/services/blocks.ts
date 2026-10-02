/**
 * Blocking (App Store Guideline 1.2). If A blocks B:
 *  - follows and pending follow requests between A and B are removed in both directions and can't be re-created
 *    by either side;
 *  - neither sees the other's stamps or profile, and they don't find each other in search, lists, feed, activity or likes.
 */
import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import type { Actor } from "@/server/actor";
import { badRequest, notFound } from "@/server/errors";
import { requireSignedIn } from "@/server/permissions";

/** Ids of everyone the user has blocked or been blocked by. */
export async function blockedIdsFor(db: Db, userId: string | null | undefined): Promise<string[]> {
  if (!userId) return [];
  const rows = await db.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return [...new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)))];
}

export async function isBlockedEitherWay(db: Db, a: string, b: string) {
  return (await db.block.count({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } })) > 0;
}

async function target(db: Db, handle: string) {
  // Suspended accounts can still be blocked (so a later unsuspension doesn't surprise anyone).
  const user = await db.user.findUnique({ where: { handle: handle.toLowerCase() }, select: { id: true, handle: true, deletedAt: true } });
  if (!user || user.deletedAt) throw notFound("User not found");
  return user;
}

/**
 * Takes the follow locks for both directions of a pair (fixed order, so two blocks can't deadlock). follow(),
 * unfollow(), decideFollowRequest() and approveAllFollowRequests() take the same locks, so a follow or an approval
 * can't slip in between a block's check and its commit.
 */
export async function lockPair(tx: Prisma.TransactionClient, a: string, b: string) {
  for (const key of [`follow:${a}:${b}`, `follow:${b}:${a}`].sort()) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}

async function block(db: Db, blockerId: string, blockedId: string, now: Date) {
  if (blockerId === blockedId) throw badRequest("You can't block yourself");
  await db.$transaction(async (tx) => {
    await lockPair(tx, blockerId, blockedId);
    await tx.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId, createdAt: now },
      update: {},
    });
    await tx.follow.deleteMany({ where: { OR: [{ followerId: blockerId, followeeId: blockedId }, { followerId: blockedId, followeeId: blockerId }] } });
    await tx.followRequest.deleteMany({ where: { OR: [{ requesterId: blockerId, targetId: blockedId }, { requesterId: blockedId, targetId: blockerId }] } });
  });
  return { blocked: true };
}

export async function blockUser(db: Db, actor: Actor | null, handle: string, now = new Date()) {
  const me = requireSignedIn(actor);
  const other = await target(db, handle);
  return block(db, me.userId, other.id, now);
}

export async function unblockUser(db: Db, actor: Actor | null, handle: string) {
  const me = requireSignedIn(actor);
  const other = await target(db, handle);
  await db.block.deleteMany({ where: { blockerId: me.userId, blockedId: other.id } });
  return { blocked: false };
}

/** Your blocks, newest first. Handles only: a blocked pair always gets the limited view. */
export async function listBlocks(db: Db, actor: Actor | null) {
  const me = requireSignedIn(actor);
  const rows = await db.block.findMany({
    where: { blockerId: me.userId, blocked: { deletedAt: null } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, blocked: { select: { handle: true } } },
  });
  return rows.map((r) => ({ handle: r.blocked.handle, blockedAt: r.createdAt }));
}
