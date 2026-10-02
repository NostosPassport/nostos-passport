/**
 * People: profiles, follows and follow requests, followers and following lists, search, profile settings.
 *
 * Privacy (src/server/privacy.ts): accounts are private by default. Following a public account is instant;
 * following a private one creates a request its owner approves or declines. Only approved follows exist in the
 * `follow` table.
 * A viewer without full access to a private profile gets the handle, the verified badge and a Request button only.
 *
 * Blocking removes follows and pending requests in both directions and prevents new ones (blocks.ts).
 */
import sharp from "sharp";
import { z } from "zod";
import type { Db } from "@/lib/db";
import { getStorage, MAX_UPLOAD_BYTES, newStorageKey, sniffImage, type BlobStorage } from "@/lib/storage";
import type { Actor } from "@/server/actor";
import { assertCleanText, badRequest, forbidden, notFound, ServiceError } from "@/server/errors";
import { isModerator, requireSignedIn } from "@/server/permissions";
import { followedAmong, personView, profileAccess, subjectSelect, toSubject, viewerOf, type PersonView, type SubjectRow } from "@/server/privacy";
import { consumeRate } from "@/server/rate-limit";
import { blockedIdsFor, isBlockedEitherWay, lockPair } from "@/server/services/blocks";
import { uploadUrl } from "@/server/media";

export type FollowState = "none" | "requested" | "following";

/** Signed URL for a profile photo, or null. */
export const avatarUrl = async (key: string | null, now = new Date()) => (key ? uploadUrl(key, now) : null);

async function activeUser(db: Db, handle: string, opts: { allowSuspended?: boolean } = {}) {
  const user = await db.user.findUnique({ where: { handle: handle.toLowerCase() }, select: subjectSelect });
  if (!user || user.deletedAt || (user.suspendedAt && !opts.allowSuspended)) throw notFound("User not found");
  return user;
}

/** The viewer's follow state toward each of `ids` (approved follows and pending requests). */
async function followStates(db: Db, viewerId: string | null | undefined, ids: readonly string[]) {
  const out = new Map<string, FollowState>();
  if (!viewerId || !ids.length) return out;
  const [follows, requests] = await Promise.all([
    followedAmong(db, viewerId, ids),
    db.followRequest.findMany({ where: { requesterId: viewerId, targetId: { in: [...ids] } }, select: { targetId: true } }),
  ]);
  for (const r of requests) out.set(r.targetId, "requested");
  for (const id of follows) out.set(id, "following");
  return out;
}

// ------------------------------------------------------------------------------------------------
// Following and requests
// ------------------------------------------------------------------------------------------------

/** Follow a public account (instant) or request to follow a private one. Idempotent. */
export async function follow(db: Db, actor: Actor | null, handle: string, now = new Date()): Promise<{ state: FollowState }> {
  const me = requireSignedIn(actor);
  const target = await activeUser(db, handle);
  if (target.id === me.userId) throw badRequest("You can't follow yourself");
  return db.$transaction(async (tx) => {
    // Locks both directions of the pair (the same locks a block takes): a double tap can't create both a follow
    // and a request, and a block can't commit between the check below and the insert.
    await lockPair(tx, me.userId, target.id);
    if (await isBlockedEitherWay(tx as Db, me.userId, target.id)) throw forbidden("You can't follow this account");
    const [existing, pending, fresh] = await Promise.all([
      tx.follow.findUnique({ where: { followerId_followeeId: { followerId: me.userId, followeeId: target.id } } }),
      tx.followRequest.findUnique({ where: { requesterId_targetId: { requesterId: me.userId, targetId: target.id } } }),
      tx.user.findUniqueOrThrow({ where: { id: target.id }, select: { isPrivate: true } }),
    ]);
    if (existing) return { state: "following" as const };
    if (pending && fresh.isPrivate) return { state: "requested" as const };
    await consumeRate(tx, me.userId, "follow", now);
    if (!fresh.isPrivate) {
      await tx.follow.create({ data: { followerId: me.userId, followeeId: target.id, createdAt: now } });
      await tx.followRequest.deleteMany({ where: { requesterId: me.userId, targetId: target.id } });
      return { state: "following" as const };
    }
    await tx.followRequest.create({ data: { requesterId: me.userId, targetId: target.id, createdAt: now } });
    return { state: "requested" as const };
  });
}

/** Unfollow, or cancel a pending request. Idempotent. */
export async function unfollow(db: Db, actor: Actor | null, handle: string): Promise<{ state: FollowState }> {
  const me = requireSignedIn(actor);
  const target = await activeUser(db, handle, { allowSuspended: true });
  // Same pair lock as follow and approve: a cancel can't lose a race against its own approval.
  await db.$transaction(async (tx) => {
    await lockPair(tx, me.userId, target.id);
    await tx.follow.deleteMany({ where: { followerId: me.userId, followeeId: target.id } });
    await tx.followRequest.deleteMany({ where: { requesterId: me.userId, targetId: target.id } });
  });
  return { state: "none" };
}

/** Requests waiting for the signed-in user's decision, newest first. */
export async function listFollowRequests(db: Db, actor: Actor | null, now = new Date()) {
  const me = requireSignedIn(actor);
  const rows = await db.followRequest.findMany({
    where: { targetId: me.userId, requester: { deletedAt: null, suspendedAt: null } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { createdAt: true, requester: { select: subjectSelect } },
  });
  const follows = await followedAmong(db, me.userId, rows.map((r) => r.requester.id));
  const viewer = viewerOf(me);
  return Promise.all(
    rows.map(async (r) => {
      const access = profileAccess(viewer, toSubject(r.requester), follows.has(r.requester.id));
      return {
        person: personView(access, { ...r.requester, verified: r.requester.verifiedAt !== null }, await avatarUrl(r.requester.avatarKey, now)),
        requestedAt: r.createdAt,
      };
    }),
  );
}

export const requestDecisionSchema = z.object({ approve: z.boolean() }).strict();

/** Approve or decline one request. Only requests addressed to the signed-in user can be found (404 otherwise). */
export async function decideFollowRequest(db: Db, actor: Actor | null, handle: string, raw: unknown, now = new Date()) {
  const me = requireSignedIn(actor);
  const { approve } = requestDecisionSchema.parse(raw);
  const requester = await db.user.findUnique({ where: { handle: handle.toLowerCase() }, select: { id: true, deletedAt: true, suspendedAt: true } });
  if (!requester || requester.deletedAt) throw notFound("No follow request from this account");
  return db.$transaction(async (tx) => {
    await lockPair(tx, requester.id, me.userId);
    const { count } = await tx.followRequest.deleteMany({ where: { requesterId: requester.id, targetId: me.userId } });
    if (count === 0) throw notFound("No follow request from this account");
    if (!approve) return { approved: false };
    if (requester.suspendedAt || (await isBlockedEitherWay(tx as Db, me.userId, requester.id))) throw notFound("No follow request from this account");
    await tx.follow.upsert({
      where: { followerId_followeeId: { followerId: requester.id, followeeId: me.userId } },
      create: { followerId: requester.id, followeeId: me.userId, createdAt: now },
      update: {},
    });
    return { approved: true };
  });
}

/** Approve every pending request at once (offered after switching a private account to public). */
export async function approveAllFollowRequests(db: Db, actor: Actor | null, now = new Date()) {
  const me = requireSignedIn(actor);
  return db.$transaction(async (tx) => {
    const pending = await tx.followRequest.findMany({ where: { targetId: me.userId }, select: { requesterId: true } });
    // Lock every pair first (the locks blocks and cancels take), then decide from what's still there.
    for (const r of [...pending].sort((a, b) => a.requesterId.localeCompare(b.requesterId))) await lockPair(tx, r.requesterId, me.userId);
    const blocked = await blockedIdsFor(tx as Db, me.userId);
    const rows = await tx.followRequest.findMany({
      where: { targetId: me.userId, requester: { deletedAt: null, suspendedAt: null }, requesterId: { notIn: blocked } },
      select: { requesterId: true },
    });
    const ids = rows.map((r) => r.requesterId);
    if (!ids.length) return { approved: 0 };
    await tx.follow.createMany({ data: ids.map((id) => ({ followerId: id, followeeId: me.userId, createdAt: now })), skipDuplicates: true });
    await tx.followRequest.deleteMany({ where: { targetId: me.userId, requesterId: { in: ids } } });
    return { approved: ids.length };
  });
}

/** Remove someone who follows you. Idempotent. */
export async function removeFollower(db: Db, actor: Actor | null, handle: string) {
  const me = requireSignedIn(actor);
  const other = await activeUser(db, handle, { allowSuspended: true });
  await db.follow.deleteMany({ where: { followerId: other.id, followeeId: me.userId } });
  return { removed: true as const };
}

// ------------------------------------------------------------------------------------------------
// Profiles and lists
// ------------------------------------------------------------------------------------------------

/** Stamps on a profile: not hidden or removed. App Review stamps count only for their author. */
export const profileStampsWhere = (userId: string, isSelf: boolean) =>
  ({ userId, hiddenAt: null, removedAt: null, ...(isSelf ? {} : { countable: true }) }) as const;

export async function getProfile(db: Db, handle: string, viewer: Actor | null, now = new Date()) {
  const user = await db.user.findUnique({
    where: { handle: handle.toLowerCase() },
    select: {
      ...subjectSelect, createdAt: true, reputation: true, bio: true,
    },
  });
  if (!user) throw notFound("User not found");
  const isSelf = viewer?.userId === user.id;
  // Deleted accounts can't be looked up, and blocked users (either direction) don't see each other.
  if (user.deletedAt || (user.suspendedAt && !isModerator(viewer))) throw notFound("User not found");
  if (viewer && !isSelf && (await isBlockedEitherWay(db, viewer.userId, user.id))) throw notFound("User not found");

  const [states, followsViewer] = await Promise.all([
    followStates(db, viewer?.userId, [user.id]),
    viewer && !isSelf
      ? db.follow.findUnique({ where: { followerId_followeeId: { followerId: user.id, followeeId: viewer.userId } } }).then(Boolean)
      : Promise.resolve(false),
  ]);
  const follow: FollowState = isSelf ? "none" : (states.get(user.id) ?? "none");
  const relationship = { isSelf, follow, followsYou: followsViewer, mutual: follow === "following" && followsViewer };
  const access = profileAccess(viewerOf(viewer), toSubject(user), follow === "following");
  const verified = user.verifiedAt !== null;

  if (access === "limited") {
    return { access: "limited" as const, user: { handle: user.handle, verified, isPrivate: true as const }, relationship };
  }

  const [followers, following, stamps, places] = await Promise.all([
    // Same people the lists show (active accounts).
    db.follow.count({ where: { followeeId: user.id, follower: { deletedAt: null, suspendedAt: null } } }),
    db.follow.count({ where: { followerId: user.id, followee: { deletedAt: null, suspendedAt: null } } }),
    db.photo.count({ where: profileStampsWhere(user.id, isSelf) }),
    db.photo.findMany({ where: profileStampsWhere(user.id, isSelf), distinct: ["venueId"], select: { venueId: true } }).then((r) => r.length),
  ]);
  return {
    access: "full" as const,
    user: {
      handle: user.handle,
      displayName: user.displayName,
      avatarUrl: await avatarUrl(user.avatarKey, now),
      bio: user.bio,
      verified,
      isPrivate: user.isPrivate,
      memberSince: user.createdAt,
      // Reputation is private: shown to the account itself and to moderators only (rule 7).
      reputation: isSelf || isModerator(viewer) ? user.reputation : null,
      counts: { stamps, places, followers, following },
    },
    relationship,
  };
}

export type ProfileView = Awaited<ReturnType<typeof getProfile>>;

/** A list of people as the viewer may see them, with the viewer's follow state toward each. */
async function peopleView(db: Db, viewer: Actor | null, rows: SubjectRow[], now: Date) {
  const states = await followStates(db, viewer?.userId, rows.map((r) => r.id));
  const v = viewerOf(viewer);
  return Promise.all(
    rows.map(async (r) => {
      const state = states.get(r.id) ?? "none";
      const access = profileAccess(v, toSubject(r), state === "following");
      return {
        ...personView(access, { ...r, verified: r.verifiedAt !== null }, access === "full" ? await avatarUrl(r.avatarKey, now) : null),
        follow: state,
        isSelf: viewer?.userId === r.id,
      };
    }),
  );
}

/** Followers or following of a profile. Needs full access to the profile (403 `private_account` otherwise). */
export async function listConnections(db: Db, viewer: Actor | null, handle: string, which: "followers" | "following", now = new Date()) {
  const user = await db.user.findUnique({ where: { handle: handle.toLowerCase() }, select: subjectSelect });
  if (!user || user.deletedAt || (user.suspendedAt && !isModerator(viewer))) throw notFound("User not found");
  const blocked = await blockedIdsFor(db, viewer?.userId);
  if (blocked.includes(user.id)) throw notFound("User not found");
  const follows = await followedAmong(db, viewer?.userId, [user.id]);
  if (profileAccess(viewerOf(viewer), toSubject(user), follows.has(user.id)) === "limited") {
    throw new ServiceError(403, "private_account", "This account is private. Follow it to see who they follow and who follows them.");
  }
  const active = { deletedAt: null, suspendedAt: null, id: { notIn: blocked } };
  const rows =
    which === "followers"
      ? (await db.follow.findMany({ where: { followeeId: user.id, follower: active }, orderBy: { createdAt: "desc" }, take: 500, select: { follower: { select: subjectSelect } } })).map((r) => r.follower)
      : (await db.follow.findMany({ where: { followerId: user.id, followee: active }, orderBy: { createdAt: "desc" }, take: 500, select: { followee: { select: subjectSelect } } })).map((r) => r.followee);
  return peopleView(db, viewer, rows, now);
}

/**
 * People search by handle, and by display name where the viewer may see it (public accounts, people they follow).
 * Matching a private account's display name would reveal it, so those match on the handle only.
 */
export async function searchUsers(db: Db, viewer: Actor | null, q: string, now = new Date()) {
  const query = q.trim().toLowerCase().replace(/^@/, "");
  if (query.length < 2) return [];
  const nameVisible = [{ isPrivate: false }, ...(viewer ? [{ followers: { some: { followerId: viewer.userId } } }] : [])];
  const users = await db.user.findMany({
    where: {
      OR: [{ handle: { contains: query } }, { displayName: { contains: query, mode: "insensitive" }, OR: nameVisible }],
      deletedAt: null,
      suspendedAt: null,
      ...(viewer ? { id: { notIn: [viewer.userId, ...(await blockedIdsFor(db, viewer.userId))] } } : {}),
    },
    take: 20,
    orderBy: { handle: "asc" },
    select: subjectSelect,
  });
  return peopleView(db, viewer, users, now);
}

/** People you follow (approved follows only, so you have full access to each). */
export async function listFollowing(db: Db, viewer: Actor | null, now = new Date()) {
  const me = requireSignedIn(viewer);
  const rows = await db.follow.findMany({
    where: { followerId: me.userId, followee: { deletedAt: null, suspendedAt: null } },
    orderBy: { followee: { handle: "asc" } },
    select: { followee: { select: { ...subjectSelect, following: { where: { followeeId: me.userId }, select: { followerId: true } } } } },
  });
  return Promise.all(
    rows.map(async ({ followee: f }) => ({
      handle: f.handle, displayName: f.displayName, avatarUrl: await avatarUrl(f.avatarKey, now), verified: f.verifiedAt !== null,
      mutual: f.following.length > 0,
    })),
  );
}

// ------------------------------------------------------------------------------------------------
// Profile settings
// ------------------------------------------------------------------------------------------------

export const BIO_MAX = 150;

export const profileSettingsSchema = z
  .object({
    displayName: z.string().trim().min(1, "Enter a name").max(60, "Name: 60 characters max"),
    bio: z.string().trim().max(BIO_MAX, `Bio: ${BIO_MAX} characters max`),
    isPrivate: z.boolean(),
  })
  .partial()
  .strict();

async function settingsView(db: Db, userId: string, now: Date) {
  const [u, pendingRequests] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { handle: true, displayName: true, bio: true, isPrivate: true, avatarKey: true, verifiedAt: true } }),
    db.followRequest.count({ where: { targetId: userId, requester: { deletedAt: null, suspendedAt: null } } }),
  ]);
  return {
    profile: { handle: u.handle, displayName: u.displayName, bio: u.bio, isPrivate: u.isPrivate, avatarUrl: await avatarUrl(u.avatarKey, now), verified: u.verifiedAt !== null },
    /** Still pending after switching to public: the app offers "Approve N pending requests?". */
    pendingRequests,
  };
}

/**
 * Edit display name, bio and the private toggle. Switching private to public doesn't approve pending requests;
 * that's a separate, explicit action (approveAllFollowRequests).
 */
export async function updateProfile(db: Db, actor: Actor | null, raw: unknown, now = new Date()) {
  const me = requireSignedIn(actor);
  const input = profileSettingsSchema.parse(raw);
  assertCleanText({ name: input.displayName, bio: input.bio });
  await db.user.update({ where: { id: me.userId }, data: input });
  return settingsView(db, me.userId, now);
}

export async function getProfileSettings(db: Db, actor: Actor | null, now = new Date()) {
  return settingsView(db, requireSignedIn(actor).userId, now);
}

export const AVATAR_SIZE = 512;

/** Profile photos: same checks as venue photos (size, magic bytes, full decode), then a square JPEG with no metadata. */
export async function processAvatar(input: Buffer) {
  if (input.length === 0) throw badRequest("Empty file");
  if (input.length > MAX_UPLOAD_BYTES) throw new ServiceError(413, "too_large", "Photos must be 5 MB or smaller");
  if (!sniffImage(input)) throw new ServiceError(415, "unsupported_type", "Only JPEG, PNG or WebP images are allowed");
  try {
    return await sharp(input, { failOn: "error", limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE, fit: "cover" })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    throw new ServiceError(415, "unsupported_type", "That image couldn't be read. Try a JPEG, PNG or WebP photo.");
  }
}

export async function setAvatar(db: Db, actor: Actor | null, bytes: Buffer, now = new Date(), storage: BlobStorage = getStorage()) {
  const me = requireSignedIn(actor);
  const clean = await processAvatar(bytes);
  const before = await db.user.findUniqueOrThrow({ where: { id: me.userId }, select: { avatarKey: true } });
  const key = newStorageKey("avatars", "jpg");
  await storage.put(key, clean, "image/jpeg");
  try {
    await db.user.update({ where: { id: me.userId }, data: { avatarKey: key } });
  } catch (err) {
    await storage.delete(key).catch(() => {});
    throw err;
  }
  if (before.avatarKey) await storage.delete(before.avatarKey).catch(() => {});
  return { avatarUrl: await avatarUrl(key, now) };
}

export async function removeAvatar(db: Db, actor: Actor | null, storage: BlobStorage = getStorage()) {
  const me = requireSignedIn(actor);
  const before = await db.user.findUniqueOrThrow({ where: { id: me.userId }, select: { avatarKey: true } });
  if (before.avatarKey) {
    await db.user.update({ where: { id: me.userId }, data: { avatarKey: null } });
    await storage.delete(before.avatarKey).catch(() => {});
  }
  return { avatarUrl: null };
}

export type PersonWithState = PersonView & { follow: FollowState; isSelf: boolean };
