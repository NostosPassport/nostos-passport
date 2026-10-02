import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { DAY_MS, nightKey } from "@/lib/time";
import { likePost, unlikePost } from "@/server/services/likes";
import { runFeaturing, completedNights } from "@/server/services/featuring";
import { featuredArchive, featuredMonth, venueGallery, currentMonth } from "@/server/services/gallery";
import { listActivity } from "@/server/services/activity";
import { getVenuePage } from "@/server/services/venues";
import { getPost } from "@/server/services/posts";
import { getProfile } from "@/server/services/people";
import { blockUser } from "@/server/services/blocks";
import { deleteAccount } from "@/server/services/account";
import { moderate } from "@/server/services/moderation";
import { hashPassword } from "@/lib/auth/password";
import { POST as cronRoute } from "@/app/api/cron/featured/route";
import type { Actor } from "@/server/actor";
import { installMemoryStorage } from "./mem-storage";
import { actorFor, makeActor, makeOwner, makeUser, makeVenue, INSIDE, verify } from "./factories";

installMemoryStorage();

const PAST = () => new Date(Date.now() - 3 * DAY_MS);
let k = 0;
const post = (userId: string, venueId: string, extra: Record<string, unknown> = {}) =>
  prisma.photo.create({
    data: { userId, venueId, storageKey: `photos/p${++k}.png`, mimeType: "image/png", caption: `post ${k}`, ...INSIDE, rating: 7, shared: true, createdAt: PAST(), ...extra },
  });
/** Established users whose likes count: USER, 30 days old, reputation 0.5. */
const fans = (n: number) => Promise.all(Array.from({ length: n }, () => makeActor()));
/** Likes made during the post's night (a minute after it), as they would be; the job only counts likes by 5:05am. */
const likeAll = async (likers: Actor[], photoId: string) => {
  const p = await prisma.photo.findUniqueOrThrow({ where: { id: photoId }, select: { createdAt: true } });
  const at = new Date(Math.min(p.createdAt.getTime() + 60_000, Date.now()));
  for (const l of likers) await likePost(prisma, l, photoId, at);
};

describe("likes", () => {
  it("like once, unlike, never your own; counts exclude App Review likes", async () => {
    const venue = await makeVenue();
    const author = await makeActor({ isPrivate: false });
    const p = await post(author.userId, venue.id, { createdAt: new Date() });
    const fan = await makeActor();
    expect(await likePost(prisma, fan, p.id)).toEqual({ liked: true, count: 1, viewerLiked: true });
    expect(await likePost(prisma, fan, p.id)).toEqual({ liked: true, count: 1, viewerLiked: true });
    await expect(likePost(prisma, author, p.id)).rejects.toMatchObject({ status: 400 });
    const reviewer = await makeActor();
    await prisma.user.update({ where: { id: reviewer.userId }, data: { geofenceExempt: true } });
    await likePost(prisma, { ...reviewer, geofenceExempt: true }, p.id);
    expect((await getPost(prisma, fan, p.id)).post.likes).toEqual({ count: 1, viewerLiked: true });
    expect(await unlikePost(prisma, fan, p.id)).toEqual({ liked: false, count: 0, viewerLiked: false });
    await expect(likePost(prisma, null, p.id)).rejects.toMatchObject({ status: 401 });
  });

  it("only shared posts you can see: unshared, live-only, hidden, removed and blocked are 404", async () => {
    const venue = await makeVenue();
    const author = await makeActor({ isPrivate: false });
    const fan = await makeActor();
    for (const extra of [{ shared: false }, { rating: null }, { hiddenAt: new Date() }, { removedAt: new Date() }]) {
      const p = await post(author.userId, venue.id, extra);
      await expect(likePost(prisma, fan, p.id), JSON.stringify(extra)).rejects.toMatchObject({ status: 404 });
    }
    const p = await post(author.userId, venue.id);
    await blockUser(prisma, author, fan.handle);
    await expect(likePost(prisma, fan, p.id)).rejects.toMatchObject({ status: 404 });
  });

  it("a stranger can like a private author's shared post without learning who it is", async () => {
    const venue = await makeVenue();
    const author = await makeActor({ handle: "shy_sue" });
    const p = await post(author.userId, venue.id, { createdAt: new Date() });
    const res = await likePost(prisma, await makeActor(), p.id);
    expect(JSON.stringify(res)).not.toContain("shy_sue");
    const page = await getVenuePage(prisma, venue.slug, await makeActor());
    expect(page.live.livePhotos[0]).toMatchObject({ author: { kind: "anonymous" }, likes: { count: 1, viewerLiked: false } });
  });

  it("likes never change consensus, counts or the feed order", async () => {
    const venue = await makeVenue();
    const [a, b] = [await makeActor({ isPrivate: false }), await makeActor({ isPrivate: false })];
    await post(a.userId, venue.id, { createdAt: new Date(Date.now() - 60_000) });
    const newer = await post(b.userId, venue.id, { createdAt: new Date() });
    const strip = (p: Awaited<ReturnType<typeof getVenuePage>>) => ({ order: p.live.livePhotos.map((x) => x.id), consensus: p.live.consensus, here: p.live.hereNow, going: p.live.goingTonight });
    const before = strip(await getVenuePage(prisma, venue.slug, null));
    const older = before.order[1]!;
    await likeAll(await fans(5), older);
    expect(strip(await getVenuePage(prisma, venue.slug, null))).toEqual(before);
    void newer;
  });

  it("account deletion removes the user's likes", async () => {
    const venue = await makeVenue();
    const author = await makeActor({ isPrivate: false });
    const p = await post(author.userId, venue.id);
    const u = await makeUser();
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword("pw pw pw pw") } });
    const me = await actorFor(u.id);
    await likePost(prisma, me, p.id);
    await deleteAccount(prisma, me, { password: "pw pw pw pw" });
    expect(await prisma.photoLike.count()).toBe(0);
  });
});

describe("nightly featuring", () => {
  it("ranks a finished night's shared posts by eligible likes (3+), stores the top with ranks, and ignores ineligible likes", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    const [a, b, c] = [await makeActor(), await makeActor(), await makeActor()];
    const pa = await post(a.userId, venue.id);
    const pb = await post(b.userId, venue.id, { createdAt: new Date(PAST().getTime() + 60_000) });
    const pc = await post(c.userId, venue.id);
    await likeAll(await fans(4), pa.id);
    await likeAll(await fans(3), pb.id);
    // Ineligible: brand-new account, low reputation, the venue's owner, an App Review account, a moderator.
    const newbie = await makeActor({ ageDays: 2 });
    const lowRep = await makeActor({ reputation: 0.3 });
    const reviewer = await makeActor();
    await prisma.user.update({ where: { id: reviewer.userId }, data: { geofenceExempt: true } });
    for (const x of [newbie, lowRep, owner, { ...reviewer, geofenceExempt: true }, await makeActor({ role: "MODERATOR" })]) {
      await likeAll([x], pc.id);
      await likeAll([x], pb.id);
    }
    await likeAll(await fans(2), pc.id);

    const res = await runFeaturing(prisma);
    expect(res.skipped).toBe(false);
    expect(res.nights).toContain(pa.night);
    const rows = await prisma.featuredPhoto.findMany({ where: { venueId: venue.id }, orderBy: { rank: "asc" } });
    expect(rows.map((r) => [r.photoId, r.rank, r.eligibleLikes])).toEqual([[pa.id, 1, 4], [pb.id, 2, 3]]);
  });

  it("ties go to the earlier post", async () => {
    const venue = await makeVenue();
    const later = await post((await makeActor()).userId, venue.id, { createdAt: new Date(PAST().getTime() + 120_000) });
    const earlier = await post((await makeActor()).userId, venue.id, { createdAt: PAST() });
    const likers = await fans(3);
    await likeAll(likers, later.id);
    await likeAll(likers, earlier.id);
    await runFeaturing(prisma);
    expect((await prisma.featuredPhoto.findMany({ where: { venueId: venue.id }, orderBy: { rank: "asc" } })).map((r) => r.photoId)).toEqual([earlier.id, later.id]);
  });

  it("is idempotent: a rerun (or a late second run) changes nothing and never duplicates", async () => {
    const venue = await makeVenue();
    const p = await post((await makeActor()).userId, venue.id);
    await likeAll(await fans(3), p.id);
    const first = await runFeaturing(prisma);
    expect(first.featured).toBe(1);
    await likeAll(await fans(5), p.id); // more likes after the run don't re-rank a processed night
    const [second, third] = await Promise.all([runFeaturing(prisma), runFeaturing(prisma)]);
    expect([second.featured, third.featured]).toEqual([0, 0]);
    expect(await prisma.featuredPhoto.findMany({ select: { photoId: true, rank: true, eligibleLikes: true } })).toEqual([{ photoId: p.id, rank: 1, eligibleLikes: 3 }]);
    expect(await prisma.featuredRun.count({ where: { night: p.night } })).toBe(1);
  });

  it("catches up after a missed night, and never processes tonight", async () => {
    const venue = await makeVenue();
    const older = await post((await makeActor()).userId, venue.id, { createdAt: new Date(Date.now() - 5 * DAY_MS) });
    const tonight = await post((await makeActor()).userId, venue.id, { createdAt: new Date() });
    const likers = await fans(3);
    await likeAll(likers, older.id);
    await likeAll(likers, tonight.id);
    const res = await runFeaturing(prisma);
    expect(res.nights).toContain(older.night);
    expect(res.nights).not.toContain(nightKey(new Date()));
    expect(completedNights(new Date())).not.toContain(nightKey(new Date()));
    expect(await prisma.featuredPhoto.findMany({ select: { photoId: true } })).toEqual([{ photoId: older.id }]);
  });

  it("verified badges and Regular status don't change featuring", async () => {
    const venue = await makeVenue();
    const [vip, plain] = [await makeActor(), await makeActor()];
    await verify(vip.userId);
    const pv = await post(vip.userId, venue.id, { createdAt: new Date(PAST().getTime() + 60_000) });
    const pp = await post(plain.userId, venue.id);
    const likers = await fans(3);
    await likeAll(likers, pv.id);
    await likeAll(likers, pp.id);
    await runFeaturing(prisma);
    // Same likes: the earlier (plain) post wins; the badge counts for nothing.
    expect((await prisma.featuredPhoto.findMany({ orderBy: { rank: "asc" } })).map((r) => r.photoId)).toEqual([pp.id, pv.id]);
  });
});

describe("the gallery", () => {
  async function featuredNight(n: number, extra: (i: number) => Record<string, unknown> = () => ({})) {
    const venue = await makeVenue();
    const photos = [];
    const likers = await fans(3);
    for (let i = 0; i < n; i++) {
      const p = await post((await makeActor({ isPrivate: false })).userId, venue.id, { createdAt: new Date(PAST().getTime() + i * 60_000), ...extra(i) });
      await likeAll(likers, p.id);
      photos.push(p);
    }
    await runFeaturing(prisma);
    return { venue, photos };
  }

  it("stores the top 20 and shows the top 10; a hidden photo is replaced by the next rank", async () => {
    const { venue, photos } = await featuredNight(22);
    expect(await prisma.featuredPhoto.count({ where: { venueId: venue.id } })).toBe(20);
    const month = photos[0]!.night.slice(0, 7);
    const shown = async () => (await featuredMonth(prisma, null, venue.id, month)).nights[0]!.photos.map((p) => p.id);
    expect(await shown()).toEqual(photos.slice(0, 10).map((p) => p.id));
    await moderate(prisma, await makeActor({ role: "MODERATOR" }), { targetType: "PHOTO", targetId: photos[1]!.id, action: "HIDE" });
    expect(await shown()).toEqual([photos[0]!, ...photos.slice(2, 11)].map((p) => p.id));
    // Unsharing or removing works the same way.
    await prisma.photo.update({ where: { id: photos[0]!.id }, data: { shared: false } });
    expect((await shown())[0]).toBe(photos[2]!.id);
  }, 60_000);

  it("the venue page shows this month's best; past months go to the archive", async () => {
    const venue = await makeVenue();
    const author = await makeActor({ isPrivate: false });
    // A night in an earlier month, featured directly (the job only catches up 7 nights).
    const lastMonth = await post(author.userId, venue.id, { createdAt: new Date(Date.now() - 45 * DAY_MS) });
    await prisma.featuredRun.create({ data: { night: lastMonth.night, ranAt: new Date(), featured: 1 } });
    await prisma.featuredPhoto.create({ data: { venueId: venue.id, night: lastMonth.night, photoId: lastMonth.id, rank: 1, eligibleLikes: 5 } });
    const g = await venueGallery(prisma, null, venue.id);
    const now = new Date();
    expect(g.thisMonth.month).toBe(currentMonth(now));
    if (lastMonth.night.slice(0, 7) !== currentMonth(now)) {
      expect(g.thisMonth.photos).toEqual([]);
      expect(g.archive).toEqual([{ month: lastMonth.night.slice(0, 7), count: 1 }]);
      expect(await featuredArchive(prisma, venue.id)).toEqual(g.archive);
    }
    const page = await getVenuePage(prisma, venue.slug, null);
    expect(page.featured).toEqual(g);
  });

  it("authors are resolved per viewer, and blocked authors' photos are skipped for that viewer", async () => {
    const venue = await makeVenue();
    const priv = await makeActor({ handle: "gallery_gil" });
    const p = await post(priv.userId, venue.id);
    await likeAll(await fans(3), p.id);
    await runFeaturing(prisma);
    const month = p.night.slice(0, 7);
    const stranger = await makeActor();
    const g = await featuredMonth(prisma, stranger, venue.id, month);
    expect(g.nights[0]!.photos[0]!.author).toEqual({ kind: "anonymous" });
    expect(JSON.stringify(g)).not.toContain("gallery_gil");
    await blockUser(prisma, stranger, priv.handle);
    expect((await featuredMonth(prisma, stranger, venue.id, month)).nights).toEqual([]);
  });

  it("\"Featured at ___, <month>\" on the profile, only while the photo is shown", async () => {
    const venue = await makeVenue();
    const author = await makeActor({ isPrivate: false });
    const p = await post(author.userId, venue.id);
    await likeAll(await fans(3), p.id);
    await runFeaturing(prisma);
    const prof = await getProfile(prisma, author.handle, null);
    expect(prof.access === "full" && prof.featured).toEqual([{ venue: { name: venue.name, slug: venue.slug }, month: p.night.slice(0, 7), count: 1 }]);
    await prisma.photo.update({ where: { id: p.id }, data: { removedAt: new Date() } });
    const after = await getProfile(prisma, author.handle, null);
    expect(after.access === "full" && after.featured).toEqual([]);
  });
});

describe("activity", () => {
  it("shows requests, new followers, likes on your posts and your features; never blocked people; only your own", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const p = await post(me.userId, venue.id);
    const requester = await makeActor();
    await prisma.followRequest.create({ data: { requesterId: requester.userId, targetId: me.userId } });
    const follower = await makeActor();
    await prisma.follow.create({ data: { followerId: follower.userId, followeeId: me.userId } });
    const likers = await fans(3);
    await likeAll(likers, p.id);
    await runFeaturing(prisma);
    const kinds = (await listActivity(prisma, me)).map((i) => i.kind).sort();
    expect(kinds).toEqual(["featured", "follow_request", "like", "like", "like", "new_follower"]);
    await blockUser(prisma, me, likers[0]!.handle);
    expect((await listActivity(prisma, me)).filter((i) => i.kind === "like")).toHaveLength(2);
    // Someone else's activity doesn't include mine.
    expect(await listActivity(prisma, requester)).toEqual([]);
    await expect(listActivity(prisma, null)).rejects.toMatchObject({ status: 401 });
  });
});

describe("cron route", () => {
  it("needs the cron secret", async () => {
    process.env.CRON_SECRET = "featured-cron-secret-0000";
    expect((await cronRoute(new Request("http://x", { method: "POST" }))).status).toBe(401);
    const ok = await cronRoute(new Request("http://x", { method: "POST", headers: { authorization: "Bearer featured-cron-secret-0000" } }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true, skipped: false });
  });
});

describe("featuring is the same whenever the job runs", () => {
  it("likes after the 5:05am cutoff and accounts too young at the cutoff don't count, even on a late run", async () => {
    const { featuringCutoff } = await import("@/server/services/featuring");
    const venue = await makeVenue();
    const p = await post((await makeActor()).userId, venue.id);
    const cutoff = featuringCutoff(p.night);
    const onTime = await fans(2);
    await likeAll(onTime, p.id);
    // 4 days old now, but younger than 7 days at the cutoff: doesn't count.
    const young = await makeActor({ ageDays: 4 });
    await likeAll([young], p.id);
    // A like after the cutoff (a late run would otherwise see it).
    const late = await makeActor();
    await prisma.photoLike.create({ data: { userId: late.userId, photoId: p.id, createdAt: new Date(cutoff.getTime() + 3600_000) } });
    await runFeaturing(prisma);
    expect(await prisma.featuredPhoto.count()).toBe(0);
  });

  it("an account flagged App Review after liking doesn't count", async () => {
    const venue = await makeVenue();
    const p = await post((await makeActor()).userId, venue.id);
    const likers = await fans(3);
    await likeAll(likers, p.id);
    await prisma.user.update({ where: { id: likers[0]!.userId }, data: { geofenceExempt: true } });
    await runFeaturing(prisma);
    expect(await prisma.featuredPhoto.count()).toBe(0);
  });

  it("a double tap on like doesn't error", async () => {
    const venue = await makeVenue();
    const p = await post((await makeActor({ isPrivate: false })).userId, venue.id, { createdAt: new Date() });
    const fan = await makeActor();
    const results = await Promise.all([likePost(prisma, fan, p.id), likePost(prisma, fan, p.id), likePost(prisma, fan, p.id)]);
    expect(results.every((r) => r.count === 1)).toBe(true);
  });

  it("concurrent runs: one does the work, the other skips or finds it done; nothing duplicates", async () => {
    const venue = await makeVenue();
    const p = await post((await makeActor()).userId, venue.id);
    await likeAll(await fans(3), p.id);
    const [a, b] = await Promise.all([runFeaturing(prisma), runFeaturing(prisma)]);
    expect(a.featured + b.featured).toBe(1);
    expect([...a.failed, ...b.failed]).toEqual([]);
    expect(await prisma.featuredPhoto.count()).toBe(1);
  });
});
