import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { prisma } from "@/lib/db";
import { DAY_MS, nightBounds, nightKey } from "@/lib/time";
import { submitPhoto } from "@/server/services/photos";
import { editPost, getPost, listUserPlaces, listUserPosts, removePost } from "@/server/services/posts";
import { decideFollowRequest, follow, getProfile } from "@/server/services/people";
import { getVenuePage } from "@/server/services/venues";
import { flagContent } from "@/server/services/moderation";
import { blockUser } from "@/server/services/blocks";
import { RATE_LIMITS } from "@/server/rate-limit";
import type { Actor } from "@/server/actor";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeOwner, makeUser, makeVenue, INSIDE, OUTSIDE, VENUE_POS } from "./factories";

installMemoryStorage();

const png = () => {
  const p = new PNG({ width: 4, height: 4 });
  p.data.fill(120);
  return PNG.sync.write(p);
};
const upload = (actor: Actor, venueId: string, meta: Record<string, unknown> = {}) =>
  submitPhoto(prisma, actor, venueId, { bytes: png(), meta: { caption: "", lat: String(INSIDE.lat), lng: String(INSIDE.lng), ...meta } });

/** A post straight in the table, e.g. from a past night (uploads always happen "now"). */
const seedPost = (userId: string, venueId: string, extra: Record<string, unknown> = {}) =>
  prisma.photo.create({
    data: { userId, venueId, storageKey: `photos/${Math.random().toString(36).slice(2)}.png`, mimeType: "image/png", caption: "", ...INSIDE, rating: 7, shared: true, ...extra },
  });

describe("posting: a photo with a rating, taken at the venue", () => {
  it("a rating makes it a post; sharing defaults off for private accounts and on for public ones", async () => {
    const venue = await makeVenue();
    const priv = await makeActor();
    const pub = await makeActor({ isPrivate: false });
    const a = await upload(priv, venue.id, { rating: "8", caption: "best DJ on the block" });
    expect(a).toMatchObject({ rating: 8, shared: false, night: nightKey(a.createdAt) });
    expect((await upload(pub, venue.id, { rating: "6" })).shared).toBe(true);
    const b = await upload(priv, (await makeVenue()).id, { rating: "9", shared: "true" });
    expect(b.shared).toBe(true);
  });

  it("without a rating it's a live-only photo, as before: always on the venue page, never on the profile", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const live = await upload(me, venue.id, { caption: "packed" });
    expect(live).toMatchObject({ rating: null, shared: true });
    expect((await getVenuePage(prisma, venue.slug, null)).live.livePhotos.map((p) => p.id)).toEqual([live.id]);
    expect((await listUserPosts(prisma, me, me.handle)).posts).toEqual([]);
    await expect(upload(me, (await makeVenue()).id, { shared: "false" })).rejects.toThrow(/always appears on the venue page/);
  });

  it("ratings are whole numbers 1-10; captions are 280 for posts and 140 for live photos", async () => {
    const me = await makeActor();
    for (const bad of ["0", "11", "7.5", "ten"]) await expect(upload(me, (await makeVenue()).id, { rating: bad })).rejects.toThrow();
    await expect(upload(me, (await makeVenue()).id, { rating: "5", caption: "x".repeat(281) })).rejects.toThrow(/280/);
    await expect(upload(me, (await makeVenue()).id, { caption: "x".repeat(141) })).rejects.toThrow(/140/);
    await expect(upload(me, (await makeVenue()).id, { rating: "5", caption: "x".repeat(280) })).resolves.toBeTruthy();
    await expect(upload(me, (await makeVenue()).id, { rating: "5", caption: "you f4gg0t" })).rejects.toMatchObject({ code: "objectionable_content" });
  });

  it("proof of presence: outside the geofence is refused, the photo cooldown applies, owners can't post for their venue", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    await expect(upload(me, venue.id, { rating: "7", lat: String(OUTSIDE.lat), lng: String(OUTSIDE.lng) })).rejects.toMatchObject({ status: 403 });
    await upload(me, venue.id, { rating: "7" });
    await expect(upload(me, venue.id, { rating: "8" })).rejects.toMatchObject({ status: 429 });
    const owner = await makeOwner(venue.id);
    await expect(upload(owner, venue.id, { rating: "10" })).rejects.toMatchObject({ status: 403 });
    expect(await prisma.photo.count({ where: { venueId: venue.id } })).toBe(1);
  });

  it("posts are rate-limited per hour across venues", async () => {
    const me = await makeActor();
    const venues = await Promise.all(Array.from({ length: RATE_LIMITS.post.max + 1 }, (_, i) => makeVenue({ lat: VENUE_POS.lat, lng: VENUE_POS.lng, slug: `rl-${i}-${Math.random().toString(36).slice(2, 6)}` })));
    for (const v of venues.slice(0, -1)) await upload(me, v.id, { rating: "5" });
    await expect(upload(me, venues.at(-1)!.id, { rating: "5" })).rejects.toMatchObject({ status: 429 });
  }, 60_000);
});

describe("editing posts", () => {
  it("rating and caption can change during the night; after it ends the rating locks and the caption stays editable", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const post = await upload(me, venue.id, { rating: "5" });
    expect(await editPost(prisma, me, post.id, { rating: 9, caption: "it got better" })).toMatchObject({ rating: 9, caption: "it got better" });
    const after = new Date(nightBounds(post.night).end.getTime() + 1000);
    await expect(editPost(prisma, me, post.id, { rating: 3 }, after)).rejects.toMatchObject({ status: 409 });
    // The DB trigger uses the real clock, so exercise the caption edit on a genuinely past post.
    const old = await seedPost(me.userId, venue.id, { createdAt: new Date(Date.now() - 3 * DAY_MS) });
    await expect(editPost(prisma, me, old.id, { rating: 2 })).rejects.toThrow(/lock/);
    expect(await editPost(prisma, me, old.id, { caption: "still editable" })).toMatchObject({ caption: "still editable", rating: 7 });
  });

  it("a live photo can be rated (becoming a post) that night only", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const live = await upload(me, venue.id);
    expect(await editPost(prisma, me, live.id, { rating: 8 })).toMatchObject({ rating: 8, shared: true });
    const oldLive = await seedPost(me.userId, venue.id, { rating: null, createdAt: new Date(Date.now() - 3 * DAY_MS) });
    await expect(editPost(prisma, me, oldLive.id, { rating: 8 })).rejects.toMatchObject({ status: 409 });
    await expect(editPost(prisma, me, oldLive.id, { shared: false })).rejects.toMatchObject({ status: 400 });
  });

  it("caption and sharing freeze while a flag is open, and for hidden posts; the rating can still change that night", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const post = await upload(me, venue.id, { rating: "6", shared: "true" });
    await flagContent(prisma, await makeActor(), { targetType: "PHOTO", targetId: post.id, reason: "not here" });
    await expect(editPost(prisma, me, post.id, { caption: "rewrite" })).rejects.toMatchObject({ status: 409 });
    await expect(editPost(prisma, me, post.id, { shared: false })).rejects.toMatchObject({ status: 409 });
    await expect(editPost(prisma, me, post.id, { rating: 7 })).resolves.toMatchObject({ rating: 7 });
    await prisma.photo.update({ where: { id: post.id }, data: { hiddenAt: new Date() } });
    await expect(editPost(prisma, me, post.id, { rating: 8 })).rejects.toMatchObject({ status: 409 });
  });

  it("a live photo's caption is fixed, unless the same edit rates it; an empty rating field means a live photo", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const live = await upload(me, venue.id, { caption: "packed", rating: "" });
    expect(live.rating).toBeNull();
    await expect(editPost(prisma, me, live.id, { caption: "changed" })).rejects.toMatchObject({ status: 400 });
    expect(await editPost(prisma, me, live.id, { rating: 7, caption: "packed, and great" })).toMatchObject({ rating: 7, caption: "packed, and great" });
  });

  it("an owner can't turn their old live photo at their own venue into a post", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const live = await upload(me, venue.id);
    await prisma.venueClaim.create({ data: { venueId: venue.id, userId: me.userId, status: "APPROVED" } });
    await prisma.user.update({ where: { id: me.userId }, data: { role: "VENUE_OWNER" } });
    const { actorFor } = await import("./factories");
    await expect(editPost(prisma, await actorFor(me.userId), live.id, { rating: 10 })).rejects.toMatchObject({ status: 403 });
  });

  it("a database backstop firing at a boundary answers 409, not 500", async () => {
    const { errorResponse } = await import("@/server/http");
    const me = await makeActor();
    const old = await seedPost(me.userId, (await makeVenue()).id, { createdAt: new Date(Date.now() - 3 * DAY_MS) });
    const err = await prisma.photo.update({ where: { id: old.id }, data: { rating: 2 } }).catch((e: unknown) => e);
    const res = errorResponse(err);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "conflict", message: "A post's rating is locked after its night ends" });
  });

  it("IDOR: only the author can edit or remove; venue owners and moderators get 403", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const post = await upload(me, venue.id, { rating: "6" });
    for (const other of [await makeActor(), await makeOwner(venue.id), await makeActor({ role: "MODERATOR" })]) {
      await expect(editPost(prisma, other, post.id, { rating: 1 })).rejects.toMatchObject({ status: 403 });
      await expect(removePost(prisma, other, post.id)).rejects.toMatchObject({ status: 403 });
    }
    await expect(editPost(prisma, null, post.id, { rating: 1 })).rejects.toMatchObject({ status: 401 });
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: post.id } })).rating).toBe(6);
  });
});

describe("removing a post (delete means hide)", () => {
  it("disappears from the venue page, the profile and detail; staff can still open it; nothing is deleted", async () => {
    const venue = await makeVenue();
    const me = await makeActor({ isPrivate: false });
    const post = await upload(me, venue.id, { rating: "7" });
    expect(await removePost(prisma, me, post.id)).toEqual({ removed: true });
    expect((await getVenuePage(prisma, venue.slug, null)).live.livePhotos).toEqual([]);
    expect((await listUserPosts(prisma, me, me.handle)).posts).toEqual([]);
    await expect(getPost(prisma, me, post.id)).rejects.toMatchObject({ status: 404 });
    await expect(getPost(prisma, await makeActor({ role: "MODERATOR" }), post.id)).resolves.toBeTruthy();
    await expect(removePost(prisma, me, post.id)).rejects.toMatchObject({ status: 404 });
    expect(await prisma.photo.count({ where: { id: post.id } })).toBe(1);
    const p = await getProfile(prisma, me.handle, me);
    expect(p.access === "full" && p.user.counts.posts).toBe(0);
  });

  it("live-only photos can't be removed (they expire from the feed)", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const live = await upload(me, venue.id);
    await expect(removePost(prisma, me, live.id)).rejects.toMatchObject({ status: 400 });
  });
});

describe("who sees a post", () => {
  async function scene() {
    const venue = await makeVenue();
    const author = await makeActor({ handle: "priv_pat" });
    const shared = await upload(author, venue.id, { rating: "8", shared: "true" });
    const unshared = await seedPost(author.userId, venue.id, { shared: false });
    const follower = await makeActor();
    await follow(prisma, follower, author.handle);
    await decideFollowRequest(prisma, author, follower.handle, { approve: true });
    const requester = await makeActor();
    await follow(prisma, requester, author.handle);
    return { venue, author, shared, unshared, follower, requester };
  }

  it("an unshared post is visible only to the author, approved followers and staff", async () => {
    const s = await scene();
    for (const v of [s.author, s.follower, await makeActor({ role: "MODERATOR" })]) await expect(getPost(prisma, v, s.unshared.id)).resolves.toBeTruthy();
    for (const v of [null, await makeActor(), s.requester, await makeOwner(s.venue.id)]) await expect(getPost(prisma, v, s.unshared.id)).rejects.toMatchObject({ status: 404 });
  });

  it("an unshared post never appears on the venue page, even for the author", async () => {
    const s = await scene();
    for (const v of [null, s.author, s.follower]) {
      const ids = (await getVenuePage(prisma, s.venue.slug, v)).live.livePhotos.map((p) => p.id);
      expect(ids).not.toContain(s.unshared.id);
      expect(ids).toContain(s.shared.id);
    }
  });

  it("a shared post of a private account opens for anyone, with the author as Anonymous to non-followers", async () => {
    const s = await scene();
    const stranger = await getPost(prisma, await makeActor(), s.shared.id);
    expect(stranger.post.author).toEqual({ kind: "anonymous" });
    expect(JSON.stringify(stranger)).not.toContain("priv_pat");
    expect(stranger.post.ratingEditableUntil).toBeNull();
    expect((await getPost(prisma, s.follower, s.shared.id)).post.author).toMatchObject({ kind: "user", handle: "priv_pat" });
    const own = await getPost(prisma, s.author, s.shared.id);
    expect(own.post.mine).toBe(true);
    expect(own.post.ratingEditableUntil).toEqual(nightBounds(s.shared.night).end);
  });

  it("the posts grid and places need full access (403 private_account); followers see unshared posts too", async () => {
    const s = await scene();
    for (const v of [null, await makeActor(), s.requester]) {
      await expect(listUserPosts(prisma, v, s.author.handle)).rejects.toMatchObject({ status: 403, code: "private_account" });
      await expect(listUserPlaces(prisma, v, s.author.handle)).rejects.toMatchObject({ status: 403 });
    }
    const grid = await listUserPosts(prisma, s.follower, s.author.handle);
    expect(grid.posts.map((p) => p.id).sort()).toEqual([s.shared.id, s.unshared.id].sort());
    const places = await listUserPlaces(prisma, s.follower, s.author.handle);
    expect(places.places).toHaveLength(1);
    expect(places.places[0]).toMatchObject({ posts: 2, venue: { slug: s.venue.slug } });
  });

  it("a suspended author's posts don't open by id, except for staff", async () => {
    const venue = await makeVenue();
    const author = await makeActor({ isPrivate: false });
    const post = await upload(author, venue.id, { rating: "8" });
    await prisma.user.update({ where: { id: author.userId }, data: { suspendedAt: new Date() } });
    await expect(getPost(prisma, await makeActor(), post.id)).rejects.toMatchObject({ status: 404 });
    await expect(getPost(prisma, await makeActor({ role: "MODERATOR" }), post.id)).resolves.toBeTruthy();
  });

  it("a block hides posts both ways (404), even public ones", async () => {
    const venue = await makeVenue();
    const author = await makeActor({ isPrivate: false });
    const post = await upload(author, venue.id, { rating: "8" });
    const other = await makeActor();
    await blockUser(prisma, author, other.handle);
    await expect(getPost(prisma, other, post.id)).rejects.toMatchObject({ status: 404 });
    await expect(listUserPosts(prisma, other, author.handle)).rejects.toMatchObject({ status: 404 });
  });

  it("App Review posts are visible only to their author and staff, and never on the venue page for others", async () => {
    const venue = await makeVenue();
    const reviewer = await makeActor({ isPrivate: false });
    await prisma.user.update({ where: { id: reviewer.userId }, data: { geofenceExempt: true } });
    const me = { ...reviewer, geofenceExempt: true };
    const post = await submitPhoto(prisma, me, venue.id, { bytes: png(), meta: { caption: "", lat: String(OUTSIDE.lat), lng: String(OUTSIDE.lng), rating: "9" } });
    expect(post.countable).toBe(false);
    await expect(getPost(prisma, await makeActor(), post.id)).rejects.toMatchObject({ status: 404 });
    await expect(getPost(prisma, me, post.id)).resolves.toBeTruthy();
    expect((await getVenuePage(prisma, venue.slug, null)).live.livePhotos).toEqual([]);
    const p = await getProfile(prisma, reviewer.handle, await makeActor());
    expect(p.access === "full" && p.user.counts.posts).toBe(0);
  });

  it("posts page 30 at a time, newest first", async () => {
    const me = await makeActor();
    const venue = await makeVenue();
    const base = Date.now() - 2 * DAY_MS;
    // Several posts share each millisecond (posts at different venues can), so the cursor must also use the id.
    for (let i = 0; i < 35; i++) await seedPost(me.userId, venue.id, { createdAt: new Date(base + Math.floor(i / 4) * 60_000) });
    const first = await listUserPosts(prisma, me, me.handle);
    expect(first.posts).toHaveLength(30);
    expect(first.nextBefore).not.toBeNull();
    const second = await listUserPosts(prisma, me, me.handle, first.nextBefore!);
    expect(second.posts).toHaveLength(5);
    expect(second.nextBefore).toBeNull();
    expect(new Set([...first.posts, ...second.posts].map((p) => p.id)).size).toBe(35);
  });

  it("posts never change consensus, counts or reputation inputs", async () => {
    const venue = await makeVenue();
    const before = await getVenuePage(prisma, venue.slug, null);
    await upload(await makeActor(), venue.id, { rating: "10", shared: "true" });
    const after = await getVenuePage(prisma, venue.slug, null);
    expect(after.live.consensus).toEqual(before.live.consensus);
    expect([after.live.hereNow, after.live.goingTonight]).toEqual([before.live.hereNow, before.live.goingTonight]);
    expect(after.official.accuracy).toEqual(before.official.accuracy);
    expect(await prisma.report.count()).toBe(0);
    void makeUser;
  });
});
