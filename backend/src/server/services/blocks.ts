/**
 * Blocking (App Store Guideline 1.2). If A blocks B:
 *  - follows and pending follow requests between A and B are removed in both directions and can't be re-created
 *    by either side;
 *  - neither sees the other's photos, comments/replies or profile, and they don't find each other in search;
 *  - aggregates are untouched: consensus, here/going counts and reputation don't depend on who blocked whom.
 */
import type { Prisma } from "@prisma/client";
import { z } from "zod";
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

async function block(db: Db, blockerId: string, blockedId: string, source: "profile" | "photo" | "comment", now: Date) {
  if (blockerId === blockedId) throw badRequest("You can't block yourself");
  await db.$transaction(async (tx) => {
    await lockPair(tx, blockerId, blockedId);
    await tx.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId, createdAt: now, source },
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
  return block(db, me.userId, other.id, "profile", now);
}

export const blockAuthorSchema = z.object({ targetType: z.enum(["PHOTO", "COMMENT"]), targetId: z.string().min(1).max(64) }).strict();

/**
 * Block the author of a photo or comment without knowing who it is (Guideline 1.2: every author can be blocked,
 * including the ones who read "Anonymous"). The handle is never returned, and the block list shows these blocks
 * without one.
 */
export async function blockAuthorOf(db: Db, actor: Actor | null, raw: unknown, now = new Date()) {
  const me = requireSignedIn(actor);
  const { targetType, targetId } = blockAuthorSchema.parse(raw);
  const row =
    targetType === "PHOTO"
      ? await db.photo.findUnique({ where: { id: targetId }, select: { userId: true, user: { select: { deletedAt: true } } } })
      : await db.comment.findUnique({ where: { id: targetId }, select: { userId: true, user: { select: { deletedAt: true } } } });
  if (!row || row.user.deletedAt) throw notFound("Content not found");
  if (row.userId === me.userId) throw badRequest("That's yours");
  return block(db, me.userId, row.userId, targetType === "PHOTO" ? "photo" : "comment", now);
}

export async function unblockUser(db: Db, actor: Actor | null, handle: string) {
  const me = requireSignedIn(actor);
  const other = await target(db, handle);
  await db.block.deleteMany({ where: { blockerId: me.userId, blockedId: other.id } });
  return { blocked: false };
}

/** Undo a block from the block list by its opaque ref (works for blocks made from Anonymous content). */
export async function unblockByRef(db: Db, actor: Actor | null, ref: string) {
  const me = requireSignedIn(actor);
  const { count } = await db.block.deleteMany({ where: { ref, blockerId: me.userId } });
  if (count === 0) throw notFound("Block not found");
  return { blocked: false };
}

/**
 * Your blocks, newest first. No display names (a blocked pair always gets the limited view), and no handle for
 * blocks made from content, whose author may have been Anonymous to you.
 */
export async function listBlocks(db: Db, actor: Actor | null) {
  const me = requireSignedIn(actor);
  const rows = await db.block.findMany({
    where: { blockerId: me.userId, blocked: { deletedAt: null } },
    orderBy: { createdAt: "desc" },
    select: { ref: true, source: true, createdAt: true, blocked: { select: { handle: true } } },
  });
  return rows.map((r) => ({
    ref: r.ref,
    source: r.source as "profile" | "photo" | "comment",
    handle: r.source === "profile" ? r.blocked.handle : null,
    blockedAt: r.createdAt,
  }));
}
