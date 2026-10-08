import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { makeUser, makeVenue } from "./factories";

describe("database guards", () => {
  async function stampRow(extra: Record<string, unknown> = {}) {
    const user = await makeUser();
    const venue = await makeVenue();
    const photo = await prisma.photo.create({
      data: {
        userId: user.id,
        venueId: venue.id,
        storageKey: `photos/${Math.random().toString(36).slice(2)}.png`,
        mimeType: "image/png",
        caption: "x",
        lat: null,
        lng: null,
        ...extra,
      },
    });
    return { user, venue, photo };
  }

  it("rejects DELETE, raw coordinate retention, and rewrites of immutable creation data", async () => {
    const { photo } = await stampRow();
    await expect(prisma.photo.delete({ where: { id: photo.id } })).rejects.toThrow();
    await expect(prisma.photo.update({ where: { id: photo.id }, data: { createdAt: new Date() } })).rejects.toThrow(/immutable/);
    await expect(prisma.photo.update({ where: { id: photo.id }, data: { lat: 1 } })).rejects.toThrow(/raw visit coordinates|check constraint/);
    await expect(prisma.photo.update({ where: { id: photo.id }, data: { storageKey: "photos/other.png" } })).rejects.toThrow(/immutable/);
    await expect(prisma.photo.update({ where: { id: photo.id }, data: { rating: 9 } })).rejects.toThrow(/immutable/);
    await expect(prisma.photo.update({ where: { id: photo.id }, data: { countable: false } })).rejects.toThrow(/immutable/);
    await expect(prisma.photo.create({ data: { userId: photo.userId, venueId: photo.venueId, caption: "coords", lat: 40.7, lng: -73.9 } })).rejects.toThrow();
  });

  it("allows visit-date edits but never lets an edit manufacture verification", async () => {
    const { photo } = await stampRow({ visitedAt: new Date("2026-10-08T16:00:00Z") });
    await expect(prisma.photo.update({ where: { id: photo.id }, data: { visitedAt: new Date("2026-10-07T16:00:00Z") } })).resolves.toBeTruthy();
    await expect(prisma.photo.update({ where: { id: photo.id }, data: { verifiedAt: new Date() } })).rejects.toThrow(/verification can only be established/);
  });

  it("caption and song remain editable and captions stay within 280 characters", async () => {
    const { photo } = await stampRow();
    await expect(prisma.photo.update({ where: { id: photo.id }, data: { caption: "edited", editedAt: new Date(), songTitle: "Song", songArtist: "Artist" } })).resolves.toBeTruthy();
    await expect(prisma.photo.update({ where: { id: photo.id }, data: { caption: "x".repeat(281) } })).rejects.toThrow(/caption_length/);
  });

  it("a removed stamp stays removed", async () => {
    const { photo } = await stampRow();
    await prisma.photo.update({ where: { id: photo.id }, data: { removedAt: new Date() } });
    await expect(prisma.photo.update({ where: { id: photo.id }, data: { removedAt: null } })).rejects.toThrow(/stays removed/);
  });

  it("a stamp needs a live photo, a caption or a song", async () => {
    const user = await makeUser();
    const venue = await makeVenue();
    const base = { userId: user.id, venueId: venue.id, lat: null, lng: null };
    await expect(prisma.photo.create({ data: { ...base, caption: "" } })).rejects.toThrow(/needs a photo, a caption or a song/);
    await expect(prisma.photo.create({ data: { ...base, caption: "   " } })).rejects.toThrow(/needs a photo, a caption or a song/);
    await expect(prisma.photo.create({ data: { ...base, caption: "hello" } })).resolves.toBeTruthy();
    await expect(prisma.photo.create({ data: { ...base, caption: "", songTitle: "T", songArtist: "A" } })).resolves.toBeTruthy();
    await expect(prisma.photo.create({ data: { ...base, caption: "", storageKey: "photos/stale.png", mimeType: "image/png" } })).rejects.toThrow(/needs a photo, a caption or a song/);
    await expect(
      prisma.$transaction(async (tx) => {
        const p = await tx.photo.create({ data: { ...base, caption: "", storageKey: "photos/p.png", mimeType: "image/png" } });
        await tx.stampPhoto.create({ data: { stampId: p.id, storageKey: "photos/p.png", mimeType: "image/png", position: 0 } });
      }),
    ).resolves.toBeUndefined();
    await expect(prisma.photo.create({ data: { ...base, caption: "x", storageKey: "photos/q.png" } })).rejects.toThrow(/photo_storage_pair/);
    await expect(prisma.photo.create({ data: { ...base, caption: "x", songTitle: "T" } })).rejects.toThrow(/photo_song_shape/);
    await expect(prisma.photo.create({ data: { ...base, caption: "x", songTitle: "T", songArtist: "A", songArtUrl: "http://x.test/a.jpg" } })).rejects.toThrow(/photo_song_shape/);
  });

  it("allows only current rate-limit kinds", async () => {
    const user = await makeUser();
    await expect(prisma.rateEvent.create({ data: { userId: user.id, kind: "typo" } })).rejects.toThrow(/rate_event_kind/);
    await expect(prisma.rateEvent.create({ data: { userId: user.id, kind: "post" } })).resolves.toBeTruthy();
    await expect(prisma.rateEvent.create({ data: { userId: user.id, kind: "song_search" } })).resolves.toBeTruthy();
  });

  it("enforces the profile bio limit", async () => {
    const user = await makeUser();
    await expect(prisma.user.update({ where: { id: user.id }, data: { bio: "x".repeat(151) } })).rejects.toThrow(/bio_length/);
  });

  it("places default to a 100 m geofence", async () => {
    expect((await makeVenue()).geofenceMeters).toBe(100);
  });
});
