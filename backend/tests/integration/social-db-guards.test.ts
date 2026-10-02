import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { DAY_MS, nightKey } from "@/lib/time";
import { makeUser, makeVenue, INSIDE } from "./factories";

// Database-level backstops for the social layer (posts, likes, featuring, verification).
describe("social database guards", () => {
  async function post(opts: { createdAt?: Date; rating?: number | null; shared?: boolean } = {}) {
    const user = await makeUser();
    const venue = await makeVenue();
    const photo = await prisma.photo.create({
      data: {
        userId: user.id, venueId: venue.id, storageKey: `photos/${Math.random().toString(36).slice(2)}.png`, mimeType: "image/png", caption: "",
        ...INSIDE, rating: opts.rating === undefined ? 7 : opts.rating, shared: opts.shared ?? true, ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
      },
    });
    return { user, venue, photo };
  }

  it("derives the New York night from created_at on insert, whatever the client sends", async () => {
    // 2026-09-26 03:30 UTC is Friday 11:30pm in New York; 08:30 UTC is 4:30am, still Friday's night.
    const a = await post({ createdAt: new Date("2026-09-26T03:30:00Z") });
    const b = await post({ createdAt: new Date("2026-09-26T08:30:00Z") });
    const c = await post({ createdAt: new Date("2026-09-26T09:30:00Z") }); // 5:30am: Saturday's night
    expect([a.photo.night, b.photo.night, c.photo.night]).toEqual(["2026-09-25", "2026-09-25", "2026-09-26"]);
    const d = await prisma.photo.create({
      data: { userId: a.user.id, venueId: a.venue.id, storageKey: "photos/lie.png", mimeType: "image/png", caption: "", ...INSIDE, night: "1999-01-01" },
    });
    expect(d.night).toBe(nightKey(d.createdAt));
    await expect(prisma.photo.update({ where: { id: d.id }, data: { night: "1999-01-01" } })).rejects.toThrow(/immutable/);
  });

  it("ratings are whole numbers from 1 to 10", async () => {
    await expect(post({ rating: 0 })).rejects.toThrow(/photo_rating_range/);
    await expect(post({ rating: 11 })).rejects.toThrow(/photo_rating_range/);
    await expect(post({ rating: 1 })).resolves.toBeTruthy();
    await expect(post({ rating: 10 })).resolves.toBeTruthy();
  });

  it("a rating can change during its night, is never cleared, and locks after the night ends", async () => {
    const tonight = await post({ rating: 5 });
    await prisma.photo.update({ where: { id: tonight.photo.id }, data: { rating: 9, caption: "better than I said", editedAt: new Date() } });
    await expect(prisma.photo.update({ where: { id: tonight.photo.id }, data: { rating: null } })).rejects.toThrow(/can't be cleared/);

    const lastWeek = await post({ rating: 5, createdAt: new Date(Date.now() - 7 * DAY_MS) });
    await expect(prisma.photo.update({ where: { id: lastWeek.photo.id }, data: { rating: 6 } })).rejects.toThrow(/locked/);
    // The caption stays editable, and a live-only photo from a past night can't become a post.
    await prisma.photo.update({ where: { id: lastWeek.photo.id }, data: { caption: "still editable" } });
    const oldLive = await post({ rating: null, createdAt: new Date(Date.now() - 7 * DAY_MS) });
    await expect(prisma.photo.update({ where: { id: oldLive.photo.id }, data: { rating: 8 } })).rejects.toThrow(/locked/);
  });

  it("a removed post stays removed", async () => {
    const { photo } = await post();
    await prisma.photo.update({ where: { id: photo.id }, data: { removedAt: new Date() } });
    await expect(prisma.photo.update({ where: { id: photo.id }, data: { removedAt: null } })).rejects.toThrow(/stays removed/);
    await expect(prisma.photo.delete({ where: { id: photo.id } })).rejects.toThrow(/hide user content/);
  });

  it("likes: never your own post, only shared posts", async () => {
    const { user, photo } = await post();
    await expect(prisma.photoLike.create({ data: { userId: user.id, photoId: photo.id } })).rejects.toThrow(/your own post/);
    const other = await makeUser();
    await prisma.photoLike.create({ data: { userId: other.id, photoId: photo.id } });
    const unshared = await post({ shared: false });
    await expect(prisma.photoLike.create({ data: { userId: other.id, photoId: unshared.photo.id } })).rejects.toThrow(/only shared posts/);
    const live = await post({ rating: null });
    await expect(prisma.photoLike.create({ data: { userId: other.id, photoId: live.photo.id } })).rejects.toThrow(/only shared posts/);
    await expect(prisma.photoLike.update({ where: { userId_photoId: { userId: other.id, photoId: photo.id } }, data: { countable: false } })).rejects.toThrow(/snapshot/);
  });

  it("featuring results, runs and the verification log are append-only", async () => {
    const { venue, photo, user } = await post({ createdAt: new Date(Date.now() - 3 * DAY_MS) });
    await prisma.featuredRun.create({ data: { night: photo.night, ranAt: new Date(), featured: 1 } });
    const f = await prisma.featuredPhoto.create({ data: { venueId: venue.id, night: photo.night, photoId: photo.id, rank: 1, eligibleLikes: 3 } });
    await expect(prisma.featuredPhoto.update({ where: { id: f.id }, data: { rank: 2 } })).rejects.toThrow(/append-only/);
    await expect(prisma.featuredPhoto.delete({ where: { id: f.id } })).rejects.toThrow(/append-only/);
    const run = await prisma.featuredRun.findUniqueOrThrow({ where: { night: photo.night } });
    await expect(prisma.featuredRun.update({ where: { night: run.night }, data: { featured: 9 } })).rejects.toThrow(/append-only/);
    await expect(prisma.featuredRun.delete({ where: { night: run.night } })).rejects.toThrow(/append-only/);
    const e = await prisma.verificationEvent.create({ data: { userId: user.id, action: "GRANT", note: "Known DJ" } });
    await expect(prisma.verificationEvent.update({ where: { id: e.id }, data: { note: "rewritten" } })).rejects.toThrow(/append-only/);
    await expect(prisma.verificationEvent.delete({ where: { id: e.id } })).rejects.toThrow(/append-only/);
    await expect(prisma.verificationEvent.create({ data: { userId: user.id, action: "REVOKE", note: " " } })).rejects.toThrow(/verification_event_note/);
  });

  it("featured rank 1-20 with at least 3 eligible likes; one feature per photo", async () => {
    const { venue, photo } = await post({ createdAt: new Date(Date.now() - 3 * DAY_MS) });
    await prisma.featuredRun.create({ data: { night: photo.night, ranAt: new Date(), featured: 1 } });
    await expect(prisma.featuredPhoto.create({ data: { venueId: venue.id, night: photo.night, photoId: photo.id, rank: 21, eligibleLikes: 3 } })).rejects.toThrow(/rank_range/);
    await expect(prisma.featuredPhoto.create({ data: { venueId: venue.id, night: photo.night, photoId: photo.id, rank: 1, eligibleLikes: 2 } })).rejects.toThrow(/min_likes/);
    await prisma.featuredPhoto.create({ data: { venueId: venue.id, night: photo.night, photoId: photo.id, rank: 1, eligibleLikes: 3 } });
    await expect(prisma.featuredPhoto.create({ data: { venueId: venue.id, night: photo.night, photoId: photo.id, rank: 2, eligibleLikes: 3 } })).rejects.toThrow(/Unique constraint/);
  });

  it("a night can't be featured before it ends, and a featured row must match a shared, visible post of that venue and night", async () => {
    const tonight = await post();
    await expect(prisma.featuredRun.create({ data: { night: tonight.photo.night, ranAt: new Date(), featured: 0 } })).rejects.toThrow(/hasn't ended/);
    const past = await post({ createdAt: new Date(Date.now() - 3 * DAY_MS) });
    await prisma.featuredRun.create({ data: { night: past.photo.night, ranAt: new Date(), featured: 0 } });
    const other = await makeVenue();
    await expect(prisma.featuredPhoto.create({ data: { venueId: other.id, night: past.photo.night, photoId: past.photo.id, rank: 1, eligibleLikes: 3 } })).rejects.toThrow(/match its venue/);
    const unshared = await post({ createdAt: new Date(Date.now() - 3 * DAY_MS), shared: false });
    await expect(prisma.featuredPhoto.create({ data: { venueId: unshared.venue.id, night: unshared.photo.night, photoId: unshared.photo.id, rank: 1, eligibleLikes: 3 } })).rejects.toThrow(/shared, visible/);
    const hidden = await post({ createdAt: new Date(Date.now() - 3 * DAY_MS) });
    await prisma.photo.update({ where: { id: hidden.photo.id }, data: { hiddenAt: new Date() } });
    await expect(prisma.featuredPhoto.create({ data: { venueId: hidden.venue.id, night: hidden.photo.night, photoId: hidden.photo.id, rank: 1, eligibleLikes: 3 } })).rejects.toThrow(/shared, visible/);
  });

  it("likes are refused on hidden, removed and App Review posts", async () => {
    const liker = await makeUser();
    for (const data of [{ hiddenAt: new Date() }, { removedAt: new Date() }]) {
      const { photo } = await post();
      await prisma.photo.update({ where: { id: photo.id }, data });
      await expect(prisma.photoLike.create({ data: { userId: liker.id, photoId: photo.id } })).rejects.toThrow(/can't be liked/);
    }
    const u = await makeUser();
    const v = await makeVenue();
    const exempt = await prisma.photo.create({ data: { userId: u.id, venueId: v.id, storageKey: "photos/exempt.png", mimeType: "image/png", caption: "", ...INSIDE, rating: 5, shared: true, countable: false } });
    await expect(prisma.photoLike.create({ data: { userId: liker.id, photoId: exempt.id } })).rejects.toThrow(/can't be liked/);
  });

  it("a follow clears the matching request; photos default to unshared; captions max 280", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    await prisma.followRequest.create({ data: { requesterId: a.id, targetId: b.id } });
    await prisma.follow.create({ data: { followerId: a.id, followeeId: b.id } });
    expect(await prisma.followRequest.count()).toBe(0);
    const v = await makeVenue();
    const p = await prisma.photo.create({ data: { userId: a.id, venueId: v.id, storageKey: "photos/d.png", mimeType: "image/png", caption: "", ...INSIDE } });
    expect(p.shared).toBe(false);
    await expect(prisma.photo.update({ where: { id: p.id }, data: { caption: "x".repeat(281) } })).rejects.toThrow(/caption_length/);
    await expect(prisma.rateEvent.create({ data: { userId: a.id, kind: "typo" } })).rejects.toThrow(/rate_event_kind/);
  });

  it("no following or requesting yourself; bios are 150 characters max", async () => {
    const u = await makeUser();
    await expect(prisma.follow.create({ data: { followerId: u.id, followeeId: u.id } })).rejects.toThrow(/follow_not_self/);
    await expect(prisma.followRequest.create({ data: { requesterId: u.id, targetId: u.id } })).rejects.toThrow(/follow_request_not_self/);
    await expect(prisma.user.update({ where: { id: u.id }, data: { bio: "x".repeat(151) } })).rejects.toThrow(/bio_length/);
  });

  it("the verified badge changes only with a matching log entry in the same transaction; accounts can't start verified", async () => {
    const u = await makeUser();
    await expect(prisma.user.update({ where: { id: u.id }, data: { verifiedAt: new Date() } })).rejects.toThrow(/verification log entry/);
    // A log entry from an earlier transaction doesn't count.
    await prisma.verificationEvent.create({ data: { userId: u.id, action: "GRANT", note: "Earlier" } });
    await expect(prisma.user.update({ where: { id: u.id }, data: { verifiedAt: new Date() } })).rejects.toThrow(/verification log entry/);
    // The wrong action doesn't either.
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.verificationEvent.create({ data: { userId: u.id, action: "REVOKE", note: "Wrong way" } });
        await tx.user.update({ where: { id: u.id }, data: { verifiedAt: new Date() } });
      }),
    ).rejects.toThrow(/verification log entry/);
    await prisma.$transaction(async (tx) => {
      await tx.verificationEvent.create({ data: { userId: u.id, action: "GRANT", note: "Known DJ" } });
      await tx.user.update({ where: { id: u.id }, data: { verifiedAt: new Date() } });
    });
    await expect(prisma.user.create({ data: { email: "v@x.dev", handle: "born_verified", displayName: "V", passwordHash: "x", verifiedAt: new Date() } })).rejects.toThrow(/at creation/);
  });

  it("new accounts are private by default", async () => {
    expect((await makeUser()).isPrivate).toBe(true);
  });
});
