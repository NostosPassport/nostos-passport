import { assertSocialEnabled } from "@/server/social";
/**
 * Activity (in-app only, no push): follow requests, new followers and likes on your stamps. Derived from the data
 * each time; there's no notifications table. People are shown as the rules allow (src/server/privacy.ts), blocked
 * people never appear, and App Review likes don't count.
 */
import type { Db } from "@/lib/db";
import { DAY_MS } from "@/lib/time";
import type { Actor } from "@/server/actor";
import { requireSignedIn } from "@/server/permissions";
import { personView, profileAccess, subjectSelect, toSubject, viewerOf } from "@/server/privacy";
import { blockedIdsFor } from "@/server/services/blocks";
import { avatarUrl } from "@/server/services/people";
import { followedAmong } from "@/server/privacy";
import { livePhotoCoverSelect, uploadUrl } from "@/server/media";

export const ACTIVITY_DAYS = 30;
export const ACTIVITY_MAX = 100;

export async function listActivity(db: Db, actor: Actor | null, now = new Date()) {
  assertSocialEnabled();
  const me = requireSignedIn(actor);
  const since = new Date(now.getTime() - ACTIVITY_DAYS * DAY_MS);
  const blocked = await blockedIdsFor(db, me.userId);
  const active = { deletedAt: null, suspendedAt: null, id: { notIn: blocked } };
  const stamp = { select: { id: true, ...livePhotoCoverSelect, venue: { select: { name: true, slug: true } } } } as const;
  const [requests, followers, likes] = await Promise.all([
    db.followRequest.findMany({ where: { targetId: me.userId, requester: active }, orderBy: { createdAt: "desc" }, take: ACTIVITY_MAX, select: { createdAt: true, requester: { select: subjectSelect } } }),
    db.follow.findMany({ where: { followeeId: me.userId, createdAt: { gt: since }, follower: active }, orderBy: { createdAt: "desc" }, take: ACTIVITY_MAX, select: { createdAt: true, follower: { select: subjectSelect } } }),
    db.photoLike.findMany({
      where: { photo: { userId: me.userId, removedAt: null, hiddenAt: null }, countable: true, createdAt: { gt: since }, user: active },
      orderBy: { createdAt: "desc" },
      take: ACTIVITY_MAX,
      select: { createdAt: true, user: { select: subjectSelect }, photo: stamp },
    }),
  ]);

  const people = [...requests.map((r) => r.requester), ...followers.map((f) => f.follower), ...likes.map((l) => l.user)];
  const follows = await followedAmong(db, me.userId, people.map((p) => p.id));
  const viewer = viewerOf(me);
  const person = async (p: (typeof people)[number]) => {
    const access = profileAccess(viewer, toSubject(p), follows.has(p.id));
    return personView(access, { ...p, verified: p.verifiedAt !== null }, access === "full" ? await avatarUrl(p.avatarKey, now) : null);
  };
  const stampRef = async (p: { id: string; photos: { storageKey: string }[]; venue: { name: string; slug: string } }) => ({ id: p.id, url: p.photos[0] ? await uploadUrl(p.photos[0].storageKey, now) : null, place: p.venue });

  const items = [
    ...(await Promise.all(requests.map(async (r) => ({ kind: "follow_request" as const, at: r.createdAt, person: await person(r.requester) })))),
    ...(await Promise.all(followers.map(async (f) => ({ kind: "new_follower" as const, at: f.createdAt, person: await person(f.follower) })))),
    ...(await Promise.all(likes.map(async (l) => ({ kind: "like" as const, at: l.createdAt, person: await person(l.user), stamp: await stampRef(l.photo) })))),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, ACTIVITY_MAX);
}
