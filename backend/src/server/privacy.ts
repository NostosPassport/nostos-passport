/**
 * Who can see what (the social layer's privacy rules). Every payload that names a person goes through this file.
 *
 * Accounts are private by default. A viewer sees a person's **full** profile (display name, photo, bio, counts,
 * posts, Regular badges, featured history) when any of these hold:
 *  - the viewer is that person, or a moderator/admin (staff always see real people);
 *  - the account is public;
 *  - the viewer is an approved follower (a pending request is not enough).
 * Otherwise the viewer gets the **limited** view: the handle, the verified badge and a generic avatar only.
 *
 * Authors on venue pages (photos, comments, replies, featured photos) are resolved per viewer: the handle (with
 * the verified badge and the Regular badge) only when the viewer may see the full profile, otherwise
 * "Anonymous" with no handle and no link. A private author's handle never reaches a viewer who can't see it.
 * Deleted accounts are "Deleted user" for everyone.
 *
 * Blocks (either direction) override everything except staff: a blocked pair gets the limited view, "Anonymous",
 * and no photos. Callers also filter blocked people out (and 404 their profiles); these rules are the backstop
 * so a forgotten caller check can't leak.
 *
 * Suspended accounts are limited/"Anonymous" to everyone but staff (their profile 404s, so a handle would lead
 * nowhere), and callers' lists and search skip them.
 *
 * The functions here are pure; `followedAmong` and `blockedAmong` load the relations they need.
 */
import type { Db } from "@/lib/db";
import type { Actor } from "@/server/actor";

/** The viewer as the rules need it. null = signed out. */
export type Viewer = { userId: string; staff: boolean } | null;

/** The person being shown. */
export type Subject = { id: string; isPrivate: boolean; deleted: boolean; suspended?: boolean };

export type Access = "full" | "limited";

export function viewerOf(actor: Actor | null): Viewer {
  return actor ? { userId: actor.userId, staff: actor.role === "MODERATOR" || actor.role === "ADMIN" } : null;
}

/**
 * Full or limited view of a person. `viewerFollows` is an APPROVED follow from the viewer to the subject; `blocked`
 * is a block in either direction. Deleted accounts are always limited (callers 404 them or show "Deleted user").
 */
export function profileAccess(viewer: Viewer, subject: Subject, viewerFollows: boolean, blocked = false): Access {
  if (subject.deleted) return "limited";
  if (viewer && (viewer.userId === subject.id || viewer.staff)) return "full";
  if (blocked || subject.suspended) return "limited";
  if (!subject.isPrivate) return "full";
  return viewer && viewerFollows ? "full" : "limited";
}

export type AuthorView =
  | { kind: "user"; handle: string; verified: boolean; regular: boolean }
  | { kind: "anonymous" }
  | { kind: "deleted" };

export type AuthorSubject = Subject & { handle: string; verified: boolean };

/**
 * Author of a photo, comment or reply as this viewer may see it. `regular` is the author's Regular status at the
 * venue being shown (false outside a venue context); it's only ever attached to a visible handle.
 */
export function resolveAuthor(viewer: Viewer, author: AuthorSubject, viewerFollows: boolean, regular = false, blocked = false): AuthorView {
  if (author.deleted) return { kind: "deleted" };
  if (profileAccess(viewer, author, viewerFollows, blocked) === "limited") return { kind: "anonymous" };
  return { kind: "user", handle: author.handle, verified: author.verified, regular };
}

/** A person in a list (search, followers, requests, activity). The handle and badge always; the rest when allowed. */
export type PersonView = { handle: string; displayName: string | null; avatarUrl: string | null; verified: boolean };

export function personView(
  access: Access,
  person: { handle: string; displayName: string; verified: boolean },
  avatarUrl: string | null,
): PersonView {
  return access === "full"
    ? { handle: person.handle, displayName: person.displayName, avatarUrl, verified: person.verified }
    : { handle: person.handle, displayName: null, avatarUrl: null, verified: person.verified };
}

/** What a photo is, for visibility decisions. */
export type PhotoSubject = {
  authorId: string;
  /** null = live-only photo (always shown on the venue page, never on the profile). */
  rating: number | null;
  shared: boolean;
  hidden: boolean;
  removed: boolean;
  /** false = posted by a geofence-exempt (App Review) account: visible to its author only. */
  countable: boolean;
};

/** Whether the photo appears in its venue's feed (live, earlier and featured) for this viewer, before blocks. */
export function inVenueFeed(viewer: Viewer, photo: PhotoSubject): boolean {
  if (photo.hidden || photo.removed) return false;
  if (!photo.countable && viewer?.userId !== photo.authorId) return false;
  return photo.rating === null || photo.shared;
}

/**
 * Whether the viewer may open this post (post detail). Posts only: a live-only photo is reachable through the
 * venue feed's time window, never by id. Shared posts are public, with the author resolved per viewer; unshared
 * posts need the full profile. Hidden and removed posts are for staff only (so a flagged post an author removes
 * can still be moderated). A block in either direction hides it from the other side.
 */
export function canSeePhoto(viewer: Viewer, photo: PhotoSubject, authorAccess: Access, blocked = false): boolean {
  if (viewer?.staff) return true;
  if (photo.rating === null || photo.removed || photo.hidden) return false;
  if (viewer?.userId === photo.authorId) return true;
  if (blocked || !photo.countable) return false;
  if (photo.shared) return true;
  return authorAccess === "full";
}

/** Ids among `ids` that the viewer follows (approved follows only). */
export async function followedAmong(db: Db, viewerId: string | null | undefined, ids: readonly string[]): Promise<Set<string>> {
  if (!viewerId || ids.length === 0) return new Set();
  const rows = await db.follow.findMany({
    where: { followerId: viewerId, followeeId: { in: [...new Set(ids)] } },
    select: { followeeId: true },
  });
  return new Set(rows.map((r) => r.followeeId));
}

/** Ids among `ids` that have a block with the viewer, in either direction. */
export async function blockedAmong(db: Db, viewerId: string | null | undefined, ids: readonly string[]): Promise<Set<string>> {
  if (!viewerId || ids.length === 0) return new Set();
  const unique = [...new Set(ids)];
  const rows = await db.block.findMany({
    where: { OR: [{ blockerId: viewerId, blockedId: { in: unique } }, { blockedId: viewerId, blockerId: { in: unique } }] },
    select: { blockerId: true, blockedId: true },
  });
  return new Set(rows.map((r) => (r.blockerId === viewerId ? r.blockedId : r.blockerId)));
}

/** Resolves many people at once: loads follows and blocks once, then applies the rules to each. */
export async function authorResolver(db: Db, actor: Actor | null, authorIds: readonly string[]) {
  const viewer = viewerOf(actor);
  const [follows, blocks] = await Promise.all([followedAmong(db, viewer?.userId, authorIds), blockedAmong(db, viewer?.userId, authorIds)]);
  return {
    viewer,
    follows,
    blocks,
    access: (s: Subject) => profileAccess(viewer, s, follows.has(s.id), blocks.has(s.id)),
    author: (s: AuthorSubject, regular = false) => resolveAuthor(viewer, s, follows.has(s.id), regular, blocks.has(s.id)),
  };
}

/** Prisma select for everything the rules need about a person. */
export const subjectSelect = {
  id: true, handle: true, displayName: true, isPrivate: true, deletedAt: true, suspendedAt: true, verifiedAt: true, avatarKey: true,
} as const;

export type SubjectRow = {
  id: string; handle: string; displayName: string; isPrivate: boolean; deletedAt: Date | null; suspendedAt: Date | null; verifiedAt: Date | null; avatarKey: string | null;
};

export const toSubject = (u: SubjectRow): AuthorSubject => ({
  id: u.id, handle: u.handle, isPrivate: u.isPrivate, deleted: u.deletedAt !== null, suspended: u.suspendedAt !== null, verified: u.verifiedAt !== null,
});
