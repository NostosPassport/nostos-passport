import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { makeUser, makeVenue, INSIDE } from "./factories";

// Database-level backstops: rule 4 (hide, never delete; append-only log), the stamp shape, likes, follows and the badge log.
describe("database guards", () => {
  async function stampRow(extra: Record<string, unknown> = {}) {
    const user = await makeUser();
    const venue = await makeVenue();
    const photo = await prisma.photo.create({
      data: { userId: user.id, venueId: venue.id, storageKey: `photos/${Math.random().toString(36).slice(2)}.png`, mimeType: "image/png", caption: "x", ...INSIDE, ...extra },
    });
    return { user, venue, photo };
  }

  it("rejects UPDATE and DELETE on moderation_event", async () => {
    const { user, photo } = await stampRow();
    const event = await prisma.moderationEvent.create({ data: { action: "HIDE", targetType: "PHOTO", targetId: photo.id, actorId: user.id } });
    await expect(prisma.moderationEvent.update({ where: { id: event.id }, data: { note: "rewrite history" } })).rejects.toThrow(/append-only/);
    await expect(prisma.moderationEvent.delete({ where: { id: event.id } })).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRawUnsafe(`DELETE FROM moderation_event`)).rejects.toThrow(/append-only/);
  });

  it("rejects DELETE of a stamp; allows hiding; refuses rewriting who, where, when or what", async () => {
    const { photo } = await stampRow();
    await expect(prisma.photo.delete({ where: { id: photo.id } })).rejects.toThrow(/hide user content/);
    await expect(prisma.photo.update({ where: { id: photo.id }, data: { createdAt: new Date() } })).rejects.toThrow(/immutable/);
    await expect(prisma.photo.update({ where: { id: photo.id }, data: { lat: 1 } })).rejects.toThrow(/immutable/);
    await expect(prisma.photo.update({ where: { id: photo.id }, data: { storageKey: "photos/other.png" } })).rejects.toThrow(/immutable/);
    await expect(prisma.photo.update({ where: { id: photo.id }, data: { rating: 9 } })).rejects.toThrow(/immutable/);
    await prisma.photo.update({ where: { id: photo.id }, data: { hiddenAt: new Date() } });
    await expect(prisma.photo.update({ where: { id: photo.id }, data: { hiddenAt: null } })).resolves.toBeTruthy();
  });

  it("caption and song are the only editable content, and the caption is 280 characters at most", async () => {
    const { photo } = await stampRow();
    await prisma.photo.update({ where: { id: photo.id }, data: { caption: "edited", editedAt: new Date(), songTitle: "Song", songArtist: "Artist" } });
    await expect(prisma.photo.update({ where: { id: photo.id }, data: { caption: "x".repeat(281) } })).rejects.toThrow(/caption_length/);
  });

  it("a removed stamp stays removed", async () => {
    const { photo } = await stampRow();
    await prisma.photo.update({ where: { id: photo.id }, data: { removedAt: new Date() } });
    await expect(prisma.photo.update({ where: { id: photo.id }, data: { removedAt: null } })).rejects.toThrow(/stays removed/);
  });

  it("a stamp needs a photo, a caption or a song", async () => {
    const user = await makeUser();
    const venue = await makeVenue();
    const base = { userId: user.id, venueId: venue.id, ...INSIDE };
    await expect(prisma.photo.create({ data: { ...base, caption: "" } })).rejects.toThrow(/photo_has_content/);
    await expect(prisma.photo.create({ data: { ...base, caption: "   " } })).rejects.toThrow(/photo_has_content/);
    await expect(prisma.photo.create({ data: { ...base, caption: "hello" } })).resolves.toBeTruthy();
    await expect(prisma.photo.create({ data: { ...base, caption: "", songTitle: "T", songArtist: "A" } })).resolves.toBeTruthy();
    await expect(prisma.photo.create({ data: { ...base, caption: "", storageKey: "photos/p.png", mimeType: "image/png" } })).resolves.toBeTruthy();
    // A photo has both key and type; a song has title and artist; art must be https.
    await expect(prisma.photo.create({ data: { ...base, caption: "x", storageKey: "photos/q.png" } })).rejects.toThrow(/photo_storage_pair/);
    await expect(prisma.photo.create({ data: { ...base, caption: "x", songTitle: "T" } })).rejects.toThrow(/photo_song_shape/);
    await expect(prisma.photo.create({ data: { ...base, caption: "x", songTitle: "T", songArtist: "A", songArtUrl: "http://x.test/a.jpg" } })).rejects.toThrow(/photo_song_shape/);
  });

  it("likes: never your own stamp, and refused on hidden, removed and App Review stamps", async () => {
    const { user, photo } = await stampRow();
    const liker = await makeUser();
    await expect(prisma.photoLike.create({ data: { userId: user.id, photoId: photo.id } })).rejects.toThrow(/own stamp/);
    await expect(prisma.photoLike.create({ data: { userId: liker.id, photoId: photo.id } })).resolves.toBeTruthy();
    const hidden = (await stampRow({ hiddenAt: new Date() })).photo;
    const removed = (await stampRow({ removedAt: new Date() })).photo;
    const exempt = (await stampRow({ countable: false })).photo;
    for (const p of [hidden, removed, exempt]) await expect(prisma.photoLike.create({ data: { userId: liker.id, photoId: p.id } })).rejects.toThrow(/can't be liked/);
  });

  it("enforces value constraints", async () => {
    const { user } = await stampRow();
    await expect(prisma.user.update({ where: { id: user.id }, data: { reputation: 2 } })).rejects.toThrow();
    await expect(prisma.rateEvent.create({ data: { userId: user.id, kind: "typo" } })).rejects.toThrow(/rate_event_kind/);
    await expect(prisma.rateEvent.create({ data: { userId: user.id, kind: "song_search" } })).resolves.toBeTruthy();
  });

  it("a follow clears the matching request; no following or requesting yourself; bios are 150 characters max", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    await prisma.followRequest.create({ data: { requesterId: a.id, targetId: b.id } });
    await prisma.follow.create({ data: { followerId: a.id, followeeId: b.id } });
    expect(await prisma.followRequest.count({ where: { requesterId: a.id } })).toBe(0);
    await expect(prisma.follow.create({ data: { followerId: a.id, followeeId: a.id } })).rejects.toThrow(/follow_not_self/);
    await expect(prisma.followRequest.create({ data: { requesterId: a.id, targetId: a.id } })).rejects.toThrow(/follow_request_not_self/);
    await expect(prisma.user.update({ where: { id: a.id }, data: { bio: "x".repeat(151) } })).rejects.toThrow(/bio_length/);
  });

  it("the verification log is append-only; the badge changes only with a matching log entry in the same transaction", async () => {
    const u = await makeUser();
    await expect(prisma.user.update({ where: { id: u.id }, data: { verifiedAt: new Date() } })).rejects.toThrow(/verification log entry/);
    await prisma.verificationEvent.create({ data: { userId: u.id, action: "GRANT", note: "Earlier" } });
    await expect(prisma.user.update({ where: { id: u.id }, data: { verifiedAt: new Date() } })).rejects.toThrow(/verification log entry/);
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.verificationEvent.create({ data: { userId: u.id, action: "REVOKE", note: "Wrong way" } });
        await tx.user.update({ where: { id: u.id }, data: { verifiedAt: new Date() } });
      }),
    ).rejects.toThrow(/verification log entry/);
    const ev = await prisma.$transaction(async (tx) => {
      const e = await tx.verificationEvent.create({ data: { userId: u.id, action: "GRANT", note: "Known artist" } });
      await tx.user.update({ where: { id: u.id }, data: { verifiedAt: new Date() } });
      return e;
    });
    await expect(prisma.verificationEvent.update({ where: { id: ev.id }, data: { note: "rewrite" } })).rejects.toThrow(/append-only/);
    await expect(prisma.verificationEvent.delete({ where: { id: ev.id } })).rejects.toThrow(/append-only/);
    await expect(prisma.user.create({ data: { email: "v@x.dev", handle: "born_verified", displayName: "V", passwordHash: "x", verifiedAt: new Date() } })).rejects.toThrow(/at creation/);
  });

  it("new accounts are private by default", async () => {
    expect((await makeUser()).isPrivate).toBe(true);
  });

  it("places have a default 100 m geofence", async () => {
    expect((await makeVenue()).geofenceMeters).toBe(100);
  });
});
