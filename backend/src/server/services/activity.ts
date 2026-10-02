/**
 * Activity (in-app only, no push): follow requests, new followers, likes on your posts, and "You were featured at
 * ___". Derived from the data each time; there's no notifications table. People are shown as the rules allow
 * (src/server/privacy.ts), blocked people never appear, and App Review likes don't count.
 */
import type { Db } from "@/lib/db";
import { DAY_MS } from "@/lib/time";
import { visibleTop } from "@/lib/likes";
import type { Actor } from "@/server/actor";
import { requireSignedIn } from "@/server/permissions";
import { personView, profileAccess, subjectSelect, toSubject, viewerOf } from "@/server/privacy";
import { blockedIdsFor } from "@/server/services/blocks";
import { avatarUrl } from "@/server/services/people";
import { followedAmong } from "@/server/privacy";
import { uploadUrl } from "@/server/services/venues";

export const ACTIVITY_DAYS = 30;
export const ACTIVITY_MAX = 100;

export async function listActivity(db: Db, actor: Actor | null, now = new Date()) {
  const me = requireSignedIn(actor);
  const since = new Date(now.getTime() - ACTIVITY_DAYS * DAY_MS);
  const blocked = await blockedIdsFor(db, me.userId);
  const active = { deletedAt: null, suspendedAt: null, id: { notIn: blocked } };
  const post = { select: { id: true, storageKey: true, venue: { select: { name: true, slug: true } } } } as const;
  const [requests, followers, likes, featured] = await Promise.all([
    db.followRequest.findMany({ where: { targetId: me.userId, requester: active }, orderBy: { createdAt: "desc" }, take: ACTIVITY_MAX, select: { createdAt: true, requester: { select: subjectSelect } } }),
    db.follow.findMany({ where: { followeeId: me.userId, createdAt: { gt: since }, follower: active }, orderBy: { createdAt: "desc" }, take: ACTIVITY_MAX, select: { createdAt: true, follower: { select: subjectSelect } } }),
    db.photoLike.findMany({
      where: { photo: { userId: me.userId, removedAt: null, hiddenAt: null }, countable: true, createdAt: { gt: since }, user: active },
      orderBy: { createdAt: "desc" },
      take: ACTIVITY_MAX,
      select: { createdAt: true, user: { select: subjectSelect }, photo: post },
    }),
    db.featuredPhoto.findMany({
      where: { photo: { userId: me.userId }, createdAt: { gt: since } },
      orderBy: { createdAt: "desc" },
      take: ACTIVITY_MAX,
      select: { createdAt: true, night: true, venueId: true, photo: post },
    }),
  ]);

  // Only features still shown in the gallery (top 10 visible for that night): one query for all those nights.
  const nightsOf = featured.length
    ? await db.featuredPhoto.findMany({
        where: { OR: featured.map((f) => ({ venueId: f.venueId, night: f.night })) },
        select: { venueId: true, night: true, rank: true, photoId: true, photo: { select: { shared: true, hiddenAt: true, removedAt: true, countable: true, user: { select: { deletedAt: true, suspendedAt: true } } } } },
      })
    : [];
  const shownFeatures = featured.filter((f) =>
    visibleTop(
      nightsOf.filter((r) => r.venueId === f.venueId && r.night === f.night),
      (r) => r.photo.shared && !r.photo.hiddenAt && !r.photo.removedAt && r.photo.countable && !r.photo.user.deletedAt && !r.photo.user.suspendedAt,
    ).some((r) => r.photoId === f.photo.id),
  );

  const people = [...requests.map((r) => r.requester), ...followers.map((f) => f.follower), ...likes.map((l) => l.user)];
  const follows = await followedAmong(db, me.userId, people.map((p) => p.id));
  const viewer = viewerOf(me);
  const person = async (p: (typeof people)[number]) => {
    const access = profileAccess(viewer, toSubject(p), follows.has(p.id));
    return personView(access, { ...p, verified: p.verifiedAt !== null }, access === "full" ? await avatarUrl(p.avatarKey, now) : null);
  };
  const postRef = async (p: { id: string; storageKey: string; venue: { name: string; slug: string } }) => ({ id: p.id, url: await uploadUrl(p.storageKey, now), venue: p.venue });

  const items = [
    ...(await Promise.all(requests.map(async (r) => ({ kind: "follow_request" as const, at: r.createdAt, person: await person(r.requester) })))),
    ...(await Promise.all(followers.map(async (f) => ({ kind: "new_follower" as const, at: f.createdAt, person: await person(f.follower) })))),
    ...(await Promise.all(likes.map(async (l) => ({ kind: "like" as const, at: l.createdAt, person: await person(l.user), post: await postRef(l.photo) })))),
    ...(await Promise.all(shownFeatures.map(async (f) => ({ kind: "featured" as const, at: f.createdAt, night: f.night, post: await postRef(f.photo) })))),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, ACTIVITY_MAX);
}
