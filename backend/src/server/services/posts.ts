/**
 * Posts: a photo with a 1-10 rating, taken at the venue (see photos.ts#submitPhoto). The permanent, profile-level
 * version of being somewhere. Live reports are separate and unchanged, and posts never feed consensus, counts,
 * accuracy or reputation.
 *
 *  - Rating and caption can be added or changed until the end of the photo's night (5am America/New_York). Then the
 *    rating locks; the caption stays editable unless a moderator is looking at it (an open flag) or it's hidden.
 *    Adding a rating to a live-only photo that night turns it into a post.
 *  - "Share to venue page": shared posts appear in the venue feed and can be liked and featured. Unshared posts
 *    appear only on the author's profile.
 *  - "Delete from profile" hides the post everywhere (`removed_at`, final). Nothing is deleted (invariant 5).
 *  - Who can see a post is decided by src/server/privacy.ts.
 */
import { z } from "zod";
import type { Db } from "@/lib/db";
import { nightBounds } from "@/lib/time";
import type { Actor } from "@/server/actor";
import { assertCleanText, badRequest, conflict, forbidden, notFound, ServiceError } from "@/server/errors";
import { assertCanEditOwnContent, isModerator, ownsVenue, requireSignedIn } from "@/server/permissions";
import { authorResolver, canSeePhoto, subjectSelect, toSubject } from "@/server/privacy";
import { POST_CAPTION_MAX } from "@/server/services/photos";
import { profilePostsWhere } from "@/server/services/people";
import { isBlockedEitherWay } from "@/server/services/blocks";
import { uploadUrl } from "@/server/services/venues";
import { regularsAt } from "@/server/services/regulars";
import { likeSummaries } from "@/server/services/likes";

/** When the rating (and the chance to add one) locks: the end of the photo's night. */
export const ratingLocksAt = (night: string) => nightBounds(night).end;

export const postEditSchema = z
  .object({
    rating: z.number().int().min(1, "Rating: 1 to 10").max(10, "Rating: 1 to 10"),
    caption: z.string().trim().max(POST_CAPTION_MAX, `Caption: ${POST_CAPTION_MAX} characters max`),
    shared: z.boolean(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Nothing to change");

/** Author edits: rating (until the night ends), caption (unless under review), shared. */
export async function editPost(db: Db, actor: Actor | null, photoId: string, raw: unknown, now = new Date()) {
  requireSignedIn(actor);
  const input = postEditSchema.parse(raw);
  assertCleanText({ caption: input.caption });
  const photo = await db.photo.findUnique({ where: { id: photoId } });
  if (!photo || photo.removedAt) throw notFound("Post not found");
  assertCanEditOwnContent(actor, photo);
  if (photo.hiddenAt) throw conflict("This post was hidden by a moderator and can't be edited");

  const ratingChanges = input.rating !== undefined && input.rating !== photo.rating;
  if (ratingChanges && now >= ratingLocksAt(photo.night)) {
    throw conflict(photo.rating === null ? "You can only rate a photo on the night you took it" : "Ratings lock when the night ends (5am)");
  }
  // Owners can't post for their own venue, and rating a live photo would make it a post there.
  if (ratingChanges && actor && ownsVenue(actor, photo.venueId)) throw forbidden("Venue accounts can't post for their own venue");
  const rating = input.rating ?? photo.rating;
  if (input.shared !== undefined && rating === null) throw badRequest("Rate it first: a photo without a rating is a live photo and always appears on the venue page");
  const captionChanges = input.caption !== undefined && input.caption !== photo.caption;
  // Live photos work as before: their caption is fixed once posted, unless this edit rates them (making a post).
  if (captionChanges && rating === null) throw badRequest("A live photo's caption can't be changed. Rate it to make it a post first.");
  if (captionChanges && photo.rating === null && input.caption!.length > POST_CAPTION_MAX) throw badRequest(`Caption: ${POST_CAPTION_MAX} characters max`);
  const sharedChanges = input.shared !== undefined && input.shared !== photo.shared;
  if (captionChanges || sharedChanges) {
    // Freeze while a moderator is looking at it, so the post can't be rewritten or moved out of view mid-review.
    const openFlags = await db.flag.count({ where: { targetType: "PHOTO", targetId: photo.id, status: "OPEN" } });
    if (openFlags > 0) throw conflict("This post is under moderator review, so it can't be edited right now");
  }
  // Turning a live photo into a post keeps it on the venue page (it's already there); the author can unshare after.
  return db.photo.update({
    where: { id: photo.id },
    data: {
      ...(ratingChanges ? { rating: input.rating } : {}),
      ...(captionChanges ? { caption: input.caption, editedAt: now } : {}),
      ...(sharedChanges ? { shared: input.shared } : {}),
    },
  });
}

/** "Delete from profile": hides the post everywhere for good. Only posts; live-only photos expire on their own. */
export async function removePost(db: Db, actor: Actor | null, photoId: string, now = new Date()) {
  requireSignedIn(actor);
  const photo = await db.photo.findUnique({ where: { id: photoId } });
  if (!photo || photo.removedAt) throw notFound("Post not found");
  assertCanEditOwnContent(actor, photo);
  if (photo.rating === null) throw badRequest("Only posts can be removed");
  await db.photo.update({ where: { id: photo.id }, data: { removedAt: now } });
  return { removed: true as const };
}

const postSelect = {
  id: true, userId: true, venueId: true, storageKey: true, caption: true, rating: true, shared: true, night: true, createdAt: true, editedAt: true,
  hiddenAt: true, removedAt: true, countable: true,
  user: { select: subjectSelect },
  venue: { select: { name: true, slug: true } },
} as const;

/** Post detail. 404 when the viewer may not see it (privacy.ts#canSeePhoto), so existence isn't revealed. */
export async function getPost(db: Db, actor: Actor | null, photoId: string, now = new Date()) {
  const p = await db.photo.findUnique({ where: { id: photoId }, select: postSelect });
  if (!p || p.rating === null) throw notFound("Post not found");
  const resolve = await authorResolver(db, actor, [p.userId]);
  const subject = { authorId: p.userId, rating: p.rating, shared: p.shared, hidden: p.hiddenAt !== null, removed: p.removedAt !== null, countable: p.countable };
  if ((p.user.deletedAt || p.user.suspendedAt) && !resolve.viewer?.staff) throw notFound("Post not found");
  if (!canSeePhoto(resolve.viewer, subject, resolve.access(toSubject(p.user)), resolve.blocks.has(p.userId))) throw notFound("Post not found");
  const mine = actor?.userId === p.userId;
  return {
    post: {
      id: p.id,
      url: await uploadUrl(p.storageKey, now),
      rating: p.rating,
      caption: p.caption,
      shared: p.shared,
      createdAt: p.createdAt,
      editedAt: p.editedAt,
      author: resolve.author(toSubject(p.user), (await regularsAt(db, p.venueId, [p.userId], now)).has(p.userId)),
      venue: p.venue,
      mine,
      /** Your own post: until when the rating can change (the end of its night). null for everyone else. */
      ratingEditableUntil: mine ? ratingLocksAt(p.night) : null,
      /** Unshared posts can't be liked (null). */
      likes: p.shared ? (await likeSummaries(db, [p.id], actor?.userId)).get(p.id)! : null,
    },
  };
}

/** Access to a person's posts and places: the full profile (403 `private_account` otherwise), and no block. */
async function assertProfileVisible(db: Db, actor: Actor | null, handle: string) {
  const user = await db.user.findUnique({ where: { handle: handle.toLowerCase() }, select: subjectSelect });
  if (!user || user.deletedAt || (user.suspendedAt && !isModerator(actor))) throw notFound("User not found");
  const isSelf = actor?.userId === user.id;
  if (actor && !isSelf && (await isBlockedEitherWay(db, actor.userId, user.id))) throw notFound("User not found");
  const resolve = await authorResolver(db, actor, [user.id]);
  if (resolve.access(toSubject(user)) === "limited") {
    throw new ServiceError(403, "private_account", "This account is private. Follow it to see their posts.");
  }
  return { user, isSelf };
}

export const POSTS_PAGE = 30;

/** Page cursor: the last post's time and id, so posts sharing a millisecond are never skipped. */
const cursorOf = (p: { createdAt: Date; id: string }) => `${p.createdAt.toISOString()}_${p.id}`;
function parseCursor(before: string) {
  const m = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)_([A-Za-z0-9_-]{1,64})$/.exec(before);
  const at = m ? new Date(m[1]!) : null;
  if (!m || !at || Number.isNaN(at.getTime())) throw badRequest("before: use the previous page's nextBefore");
  return { at, id: m[2]! };
}

/** A profile's posts grid, newest first, 30 at a time (`before` = the previous page's `nextBefore`). */
export async function listUserPosts(db: Db, actor: Actor | null, handle: string, before?: string | null, now = new Date()) {
  const { user, isSelf } = await assertProfileVisible(db, actor, handle);
  const c = before ? parseCursor(before) : null;
  const rows = await db.photo.findMany({
    where: {
      ...profilePostsWhere(user.id, isSelf),
      ...(c ? { OR: [{ createdAt: { lt: c.at } }, { createdAt: c.at, id: { lt: c.id } }] } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: POSTS_PAGE + 1,
    select: { id: true, storageKey: true, rating: true, shared: true, createdAt: true, venue: { select: { name: true, slug: true } } },
  });
  const page = rows.slice(0, POSTS_PAGE);
  return {
    posts: await Promise.all(
      page.map(async (p) => ({ id: p.id, url: await uploadUrl(p.storageKey, now), rating: p.rating!, shared: p.shared, createdAt: p.createdAt, venue: p.venue })),
    ),
    nextBefore: rows.length > POSTS_PAGE ? cursorOf(page[page.length - 1]!) : null,
  };
}

/** Every venue a person has posted at (the Places tab), with their latest rating there. Newest first. */
export async function listUserPlaces(db: Db, actor: Actor | null, handle: string) {
  const { user, isSelf } = await assertProfileVisible(db, actor, handle);
  const rows = await db.photo.findMany({
    where: profilePostsWhere(user.id, isSelf),
    orderBy: { createdAt: "desc" },
    select: { rating: true, createdAt: true, venueId: true, venue: { select: { name: true, slug: true, lat: true, lng: true, neighborhood: true } } },
  });
  const places = new Map<string, { venue: (typeof rows)[number]["venue"]; posts: number; lastRating: number; lastPostedAt: Date }>();
  for (const r of rows) {
    const p = places.get(r.venueId);
    if (p) p.posts++;
    else places.set(r.venueId, { venue: r.venue, posts: 1, lastRating: r.rating!, lastPostedAt: r.createdAt });
  }
  return { places: [...places.values()] };
}

