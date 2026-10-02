import { z } from "zod";
import type { Db } from "@/lib/db";
import type { Actor } from "@/server/actor";
import { assertCanEditOwnContent, assertCanPostUserContent, assertOwnsVenue, requireSignedIn } from "@/server/permissions";
import { assertCleanText, badRequest, conflict, notFound, tooMany } from "@/server/errors";

export const commentBodySchema = z.object({ body: z.string().trim().min(1, "Say something").max(500, "500 characters max") }).strict();

const COMMENT_BURST = 5;
const COMMENT_BURST_WINDOW_MS = 10 * 60_000;

export async function addComment(db: Db, actor: Actor | null, venueId: string, raw: unknown, now = new Date()) {
  const me = assertCanPostUserContent(actor, venueId);
  const { body } = commentBodySchema.parse(raw);
  assertCleanText({ comment: body });
  if (!(await db.venue.findUnique({ where: { id: venueId }, select: { id: true } }))) throw notFound("Venue not found");
  return db.$transaction(async (tx) => {
    // Per user+venue lock so parallel posts can't all pass the burst check.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`comment:${me.userId}:${venueId}`}))`;
    const recent = await tx.comment.count({
      where: { userId: me.userId, venueId, createdAt: { gt: new Date(now.getTime() - COMMENT_BURST_WINDOW_MS) } },
    });
    if (recent >= COMMENT_BURST) throw tooMany("Slow down: at most 5 comments per venue every 10 minutes");
    return tx.comment.create({ data: { venueId, userId: me.userId, body, createdAt: now, countable: !me.geofenceExempt } });
  });
}

/** Authors may edit their own comment text. Venue owners, moderators and everyone else get 403. */
export async function editComment(db: Db, actor: Actor | null, commentId: string, raw: unknown, now = new Date()) {
  requireSignedIn(actor);
  const { body } = commentBodySchema.parse(raw);
  assertCleanText({ comment: body });
  const comment = await db.comment.findUnique({ where: { id: commentId } });
  if (!comment) throw notFound("Comment not found");
  assertCanEditOwnContent(actor, comment);
  if (comment.hiddenAt) throw conflict("This comment was hidden by a moderator and can't be edited");
  // Freeze once others have acted on it, so a reply or a flag can't be made to look wrong after the fact.
  const [replies, openFlags] = await Promise.all([
    db.comment.count({ where: { parentId: commentId } }),
    db.flag.count({ where: { targetType: "COMMENT", targetId: commentId, status: "OPEN" } }),
  ]);
  if (replies > 0) throw conflict("The venue has replied to this comment, so it can't be edited anymore");
  if (openFlags > 0) throw conflict("This comment is under moderator review, so it can't be edited right now");
  return db.comment.update({ where: { id: commentId }, data: { body, editedAt: now } });
}

/** Venue replies: only an approved owner of the comment's venue, only to a visible top-level user comment. */
export async function replyAsVenue(db: Db, actor: Actor | null, commentId: string, raw: unknown, now = new Date()) {
  requireSignedIn(actor);
  const { body } = commentBodySchema.parse(raw);
  assertCleanText({ reply: body });
  const parent = await db.comment.findUnique({ where: { id: commentId } });
  if (!parent || parent.hiddenAt) throw notFound("Comment not found");
  const me = assertOwnsVenue(actor, parent.venueId);
  if (parent.parentId || parent.isVenueReply) throw badRequest("Replies are one level deep: reply to the original comment");
  return db.comment.create({
    data: { venueId: parent.venueId, userId: me.userId, parentId: parent.id, isVenueReply: true, body, createdAt: now },
  });
}
