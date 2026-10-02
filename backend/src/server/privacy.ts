/**
 * Who can see what. Every payload that names a person or shows a stamp goes through this file.
 *
 * Accounts are private by default. A viewer sees a person's **full** profile (display name, photo, bio, counts, stamps,
 * places) when any of these hold:
 *  - the viewer is that person, or a moderator/admin (staff always see real people);
 *  - the account is public;
 *  - the viewer is an approved follower (a pending request is not enough).
 * Otherwise the viewer gets the **limited** view: the handle, the verified badge and a generic avatar only, and no
 * stamps or places at all.
 *
 * A stamp is shown only to people who may see its author's full profile, so a stamp always comes with its author.
 * Nothing in Nostos is ever labeled "Anonymous". Deleted accounts are "Deleted user" and their stamps are hidden.
 *
 * Blocks (either direction) override everything except staff: a blocked pair gets the limited view and no stamps.
 * Callers also filter blocked people out (and 404 their profiles); these rules are the backstop so a forgotten caller
 * check can't leak.
 *
 * Suspended accounts are limited to everyone but staff (their profile 404s, so a handle would lead nowhere), and
 * callers' lists and search skip them.
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

/** What a stamp is, for visibility decisions. */
export type StampSubject = {
  authorId: string;
  hidden: boolean;
  removed: boolean;
  /** false = stamped by a geofence-exempt (App Review) account: visible to its author only. */
  countable: boolean;
};

/**
 * Whether the viewer may open this stamp, or see it in any list. Staff see everything (so a flagged stamp an author
 * removed can still be moderated). Hidden and removed stamps are for staff only. The author sees their own. Everyone
 * else needs the full profile of the author, no block in either direction, and a countable (non-exempt) stamp.
 */
export function canSeeStamp(viewer: Viewer, stamp: StampSubject, authorAccess: Access, blocked = false): boolean {
  if (viewer?.staff) return true;
  if (stamp.removed || stamp.hidden) return false;
  if (viewer?.userId === stamp.authorId) return true;
  if (blocked || !stamp.countable) return false;
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
  };
}

/** Prisma select for everything the rules need about a person. */
export const subjectSelect = {
  id: true, handle: true, displayName: true, isPrivate: true, deletedAt: true, suspendedAt: true, verifiedAt: true, avatarKey: true,
} as const;

export type SubjectRow = {
  id: string; handle: string; displayName: string; isPrivate: boolean; deletedAt: Date | null; suspendedAt: Date | null; verifiedAt: Date | null; avatarKey: string | null;
};

export const toSubject = (u: SubjectRow): Subject & { handle: string; verified: boolean } => ({
  id: u.id, handle: u.handle, isPrivate: u.isPrivate, deleted: u.deletedAt !== null, suspended: u.suspendedAt !== null, verified: u.verifiedAt !== null,
});
