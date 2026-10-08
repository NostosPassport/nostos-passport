import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  createStamp,
  editStamp,
  getMyPlacePage,
  getStamp,
  listUserPlaces,
  listUserStamps,
  removeStamp,
  stampDay,
  STAMPS_PAGE,
} from "@/server/services/stamps";
import { nearbyPlaces } from "@/server/services/places";
import { RATE_LIMITS } from "@/server/rate-limit";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeStamp, makeVenue, INSIDE, OUTSIDE } from "./factories";

const mem = installMemoryStorage();
const ART = "https://is1-ssl.mzstatic.com/image/thumb/Music/x/300x300bb.jpg";

describe("creating a stamp", () => {
  it("accepts a photo, caption, song, or any mix and rejects an empty stamp", async () => {
    const [a, b, c, d] = [await makeVenue(), await makeVenue(), await makeVenue(), await makeVenue()];
    const me = await makeActor();

    const photoOnly = await makeStamp(me, a.id, { caption: "", photo: true });
    expect(photoOnly).toMatchObject({ caption: "", song: null });
    expect(photoOnly.photoUrl).toMatch(/^\/api\/uploads\/photos\//);

    const captionOnly = await makeStamp(me, b.id, { caption: "just words", photo: false });
    expect(captionOnly).toMatchObject({ photoUrl: null, caption: "just words", song: null });

    const songOnly = await makeStamp(me, c.id, {
      caption: "",
      photo: false,
      meta: { songTitle: "Wild Horses", songArtist: "The Rolling Stones", songArtUrl: ART, songSourceId: "42" },
    });
    expect(songOnly).toMatchObject({ photoUrl: null, caption: "", song: { title: "Wild Horses", artist: "The Rolling Stones", artUrl: ART, sourceId: "42" } });

    await expect(makeStamp(me, d.id, { caption: "", photo: false })).rejects.toMatchObject({ status: 400 });
    expect(await prisma.photo.count({ where: { venueId: d.id } })).toBe(0);
  });

  it("validates captions, songs, ratings, and unknown fields", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    await expect(makeStamp(me, venue.id, { caption: "x".repeat(281) })).rejects.toThrow(/280 characters max/);
    await expect(makeStamp(me, venue.id, { caption: "x", meta: { songTitle: "Only a title" } })).rejects.toThrow(/title and an artist/);
    await expect(makeStamp(me, venue.id, { caption: "x", meta: { songTitle: "T", songArtist: "A", songArtUrl: "https://evil.example/pixel.gif" } })).rejects.toThrow();
    await expect(makeStamp(me, venue.id, { caption: "x", meta: { rating: "11" } })).rejects.toThrow();
    await expect(makeStamp(me, venue.id, { caption: "x", meta: { bogus: "1" } })).rejects.toThrow();

    const ok = await makeStamp(me, venue.id, { caption: "rated", meta: { rating: "9" } });
    expect(JSON.stringify(ok)).not.toMatch(/rating/);
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: ok.id } })).rating).toBe(9);
  });

  it("verifies Now stamps only when current coordinates are inside the place geofence", async () => {
    const tight = await makeVenue({ geofenceMeters: 30 });
    const wide = await makeVenue({ geofenceMeters: 400 });
    const noLocationVenue = await makeVenue();
    const me = await makeActor();
    const near = { lat: INSIDE.lat + 0.0006, lng: INSIDE.lng };

    const outside = await makeStamp(me, tight.id, { at: near });
    expect(outside).toMatchObject({ verified: false, verifiedAt: null });

    const inside = await makeStamp(me, wide.id, { at: near });
    expect(inside.verified).toBe(true);
    expect(inside.verifiedAt).not.toBeNull();

    const noLocation = await createStamp(prisma, me, noLocationVenue.id, { meta: { caption: "no gps", mode: "now" } });
    expect(noLocation).toMatchObject({ verified: false, verifiedAt: null });

    await expect(makeStamp(me, (await makeVenue()).id, { at: { lat: 91, lng: 0 } })).rejects.toMatchObject({ status: 400 });
    await expect(makeStamp(me, "no-such-place")).rejects.toMatchObject({ status: 404 });
    await expect(createStamp(prisma, null, wide.id, { meta: { caption: "x", mode: "now" } })).rejects.toMatchObject({ status: 401 });
  });

  it("accepts Past stamps from the last year, never verifies them, and rejects future or too-old dates", async () => {
    const me = await makeActor();
    const now = new Date("2026-10-08T19:00:00.000Z");
    const venue = await makeVenue();
    const visitedAt = new Date("2026-05-04T16:00:00.000Z");
    const past = await createStamp(prisma, me, venue.id, { meta: { caption: "spring", mode: "past", visitedAt: visitedAt.toISOString() } }, now);
    expect(past).toMatchObject({ verified: false, verifiedAt: null, visitedAt });

    await expect(createStamp(prisma, me, (await makeVenue()).id, { meta: { caption: "future", mode: "past", visitedAt: "2026-10-10T12:00:00.000Z" } }, now)).rejects.toMatchObject({ status: 400 });
    await expect(createStamp(prisma, me, (await makeVenue()).id, { meta: { caption: "old", mode: "past", visitedAt: "2025-09-01T12:00:00.000Z" } }, now)).rejects.toMatchObject({ status: 400 });
  });

  it("enforces the per-place cooldown and hourly post limit", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const t = new Date();
    await makeStamp(me, venue.id, { now: t });
    await expect(makeStamp(me, venue.id, { now: new Date(t.getTime() + 5 * 60_000) })).rejects.toMatchObject({ status: 429 });
    await expect(makeStamp(me, venue.id, { now: new Date(t.getTime() + 16 * 60_000) })).resolves.toBeTruthy();

    const other = await makeActor();
    for (let i = 0; i < RATE_LIMITS.post.max; i++) await makeStamp(other, (await makeVenue()).id, { now: t });
    await expect(makeStamp(other, (await makeVenue()).id, { now: t })).rejects.toMatchObject({ status: 429 });
  });

  it("leaves no uploaded file behind when the database transaction fails", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    await makeStamp(me, venue.id);
    const before = mem.size;
    await expect(makeStamp(me, venue.id, { now: new Date(Date.now() + 60_000) })).rejects.toMatchObject({ status: 429 });
    expect(mem.size).toBe(before);
  });

  it("rejects non-images, never exposes raw coordinates, and does not retain verification coordinates", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    await expect(createStamp(prisma, me, venue.id, { bytes: Buffer.from("not an image at all"), meta: { caption: "x", mode: "now", lat: String(INSIDE.lat), lng: String(INSIDE.lng) } })).rejects.toMatchObject({ status: 415 });

    const stamp = await makeStamp(me, venue.id);
    expect(JSON.stringify(stamp)).not.toMatch(/"(lat|lng|storageKey|userId)"/);
    expect(await prisma.photo.findUniqueOrThrow({ where: { id: stamp.id } })).toMatchObject({ lat: null, lng: null });
  });
});

describe("editing and removing a stamp", () => {
  it("lets only the owner edit caption and song", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const other = await makeActor();
    const stamp = await makeStamp(me, venue.id, { caption: "before" });

    const edited = await editStamp(prisma, me, stamp.id, { caption: "after", song: { title: "Song", artist: "Band", artUrl: ART } });
    expect(edited.stamp).toMatchObject({ caption: "after", song: { title: "Song", artist: "Band", artUrl: ART, sourceId: null }, photoUrl: stamp.photoUrl, createdAt: stamp.createdAt, visitedAt: stamp.visitedAt });
    expect(edited.stamp.editedAt).not.toBeNull();
    expect((await editStamp(prisma, me, stamp.id, { song: null })).stamp.song).toBeNull();
    await expect(editStamp(prisma, other, stamp.id, { caption: "mine now" })).rejects.toMatchObject({ status: 404 });
    await expect(editStamp(prisma, null, stamp.id, { caption: "x" })).rejects.toMatchObject({ status: 401 });
    await expect(editStamp(prisma, me, stamp.id, {})).rejects.toThrow(/Nothing to change/);
  });

  it("allows visit-date edits and removes verification when a verified calendar day changes", async () => {
    const me = await makeActor();
    const stamp = await makeStamp(me, (await makeVenue()).id, { now: new Date("2026-10-08T18:00:00.000Z") });
    expect(stamp.verified).toBe(true);

    const sameDay = await editStamp(prisma, me, stamp.id, { visitedAt: "2026-10-08T22:00:00.000Z" }, new Date("2026-10-08T23:00:00.000Z"));
    expect(sameDay.stamp.verified).toBe(true);

    const changed = await editStamp(prisma, me, stamp.id, { visitedAt: "2026-10-07T16:00:00.000Z" }, new Date("2026-10-08T23:00:00.000Z"));
    expect(changed.stamp).toMatchObject({ verified: false, verifiedAt: null });
    await expect(editStamp(prisma, me, stamp.id, { visitedAt: "2026-10-09T16:00:00.000Z" }, new Date("2026-10-08T23:00:00.000Z"))).rejects.toMatchObject({ status: 400 });
  });

  it("does not allow an edit to leave a stamp with no content", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const wordsOnly = await makeStamp(me, venue.id, { caption: "words", photo: false });
    await expect(editStamp(prisma, me, wordsOnly.id, { caption: "" })).rejects.toMatchObject({ status: 400 });

    const photoStamp = await makeStamp(me, (await makeVenue()).id, { caption: "words" });
    await expect(editStamp(prisma, me, photoStamp.id, { caption: "" })).resolves.toBeTruthy();
  });

  it("removes a stamp permanently from every owner view while retaining its database row", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const other = await makeActor();
    const stamp = await makeStamp(me, venue.id);

    await expect(removeStamp(prisma, other, stamp.id)).rejects.toMatchObject({ status: 404 });
    await removeStamp(prisma, me, stamp.id);
    await expect(removeStamp(prisma, me, stamp.id)).rejects.toMatchObject({ status: 404 });
    await expect(getStamp(prisma, me, stamp.id)).rejects.toMatchObject({ status: 404 });
    expect((await listUserStamps(prisma, me, me.handle)).stamps).toEqual([]);
    expect((await listUserPlaces(prisma, me, me.handle)).places).toEqual([]);
    await expect(editStamp(prisma, me, stamp.id, { caption: "back?" })).rejects.toMatchObject({ status: 404 });
    expect(await prisma.photo.count({ where: { id: stamp.id } })).toBe(1);
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: stamp.id } })).removedAt).not.toBeNull();
  });
});

describe("owner passport and places", () => {
  it("rejects another account and groups the owner's stamps by place", async () => {
    const [a, b] = [await makeVenue(), await makeVenue()];
    const me = await makeActor();
    const other = await makeActor();
    const t = Date.now() - 3 * 3600_000;
    await makeStamp(me, a.id, { caption: "first at a", now: new Date(t) });
    await makeStamp(me, a.id, { caption: "second at a", now: new Date(t + 3600_000) });
    const last = await makeStamp(me, b.id, { caption: "at b", now: new Date(t + 2 * 3600_000) });

    await expect(listUserStamps(prisma, other, me.handle)).rejects.toMatchObject({ status: 404 });
    await expect(listUserPlaces(prisma, other, me.handle)).rejects.toMatchObject({ status: 404 });

    const grid = await listUserStamps(prisma, me, me.handle);
    expect(grid.stamps.map((s) => s.caption)).toEqual(["first at a", "second at a", "at b"]);
    expect(grid.stamps.map((s) => [s.page, s.slot])).toEqual([[1, 1], [1, 2], [1, 3]]);
    const { places } = await listUserPlaces(prisma, me, me.handle);
    expect(places.map((p) => [p.place.slug, p.stamps])).toEqual([[b.slug, 1], [a.slug, 2]]);
    expect(places[0]!.latestStamp.id).toBe(last.id);
  });

  it("orders and pages the passport by visit date rather than record creation time", async () => {
    const me = await makeActor();
    const venue = await makeVenue();
    const base = Date.now() - 90 * 60_000;
    for (let i = 0; i < STAMPS_PAGE + 4; i++) {
      const at = new Date(base + i * 1000);
      await prisma.photo.create({ data: { userId: me.userId, venueId: venue.id, caption: `s${i}`, lat: null, lng: null, createdAt: new Date(base + (STAMPS_PAGE + 4 - i) * 1000), visitedAt: at } });
    }
    const first = await listUserStamps(prisma, me, me.handle);
    const second = await listUserStamps(prisma, me, me.handle, first.nextAfter);
    expect(first.stamps).toHaveLength(STAMPS_PAGE);
    expect([...first.stamps, ...second.stamps].map((s) => s.caption)).toEqual(Array.from({ length: STAMPS_PAGE + 4 }, (_, i) => `s${i}`));
    expect(second.nextAfter).toBeNull();
    await expect(listUserStamps(prisma, me, me.handle, "garbage")).rejects.toMatchObject({ status: 400 });
  });
});

describe("pages and slots", () => {
  it("numbers live stamps oldest-visit first, three per page, and closes gaps after removal", async () => {
    const me = await makeActor();
    const t = Date.now() - 10 * 3600_000;
    const ids: string[] = [];
    for (let i = 0; i < 7; i++) ids.push((await makeStamp(me, (await makeVenue()).id, { caption: `n${i}`, now: new Date(t + i * 3600_000) })).id);

    const grid = await listUserStamps(prisma, me, me.handle);
    expect(grid.stamps.map((s) => `${s.page}.${s.slot}`)).toEqual(["1.1", "1.2", "1.3", "2.1", "2.2", "2.3", "3.1"]);
    expect((await getStamp(prisma, me, ids[4]!)).stamp).toMatchObject({ page: 2, slot: 2 });

    await removeStamp(prisma, me, ids[1]!);
    expect((await getStamp(prisma, me, ids[0]!)).stamp).toMatchObject({ page: 1, slot: 1 });
    expect((await getStamp(prisma, me, ids[2]!)).stamp).toMatchObject({ page: 1, slot: 2 });
    expect((await getStamp(prisma, me, ids[6]!)).stamp).toMatchObject({ page: 2, slot: 3 });
  });
});

describe("places", () => {
  it("lists nearby places nearest first and marks geofence membership", async () => {
    const here = await makeVenue({ lat: INSIDE.lat, lng: INSIDE.lng });
    const close = await makeVenue({ lat: INSIDE.lat + 0.002, lng: INSIDE.lng });
    await makeVenue({ lat: OUTSIDE.lat + 0.1, lng: OUTSIDE.lng });
    const near = await nearbyPlaces(prisma, INSIDE);
    expect(near.map((p) => p.slug)).toEqual([here.slug, close.slug]);
    expect(near.map((p) => p.inside)).toEqual([true, false]);
    expect(near[0]!.distanceM).toBe(0);
    expect(JSON.stringify(near)).not.toMatch(/osmId/);
  });

  it("my place page includes only my stamps and groups them by visit day", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const other = await makeActor();
    const d1 = new Date("2026-09-20T23:30:00Z");
    const d2 = new Date("2026-09-20T23:50:00Z");
    const d3 = new Date("2026-09-27T23:30:00Z");
    await makeStamp(me, venue.id, { caption: "a", now: d1 });
    await makeStamp(me, venue.id, { caption: "b", now: d2 });
    await makeStamp(me, venue.id, { caption: "c", now: d3 });
    await makeStamp(other, venue.id, { caption: "not mine" });

    const page = await getMyPlacePage(prisma, me, venue.slug, INSIDE);
    expect(page.stamps.map((s) => s.caption)).toEqual(["a", "b", "c"]);
    expect(page.visits.map((x) => [x.day, x.stamps.length])).toEqual([[stampDay(d1), 2], [stampDay(d3), 1]]);
    expect(page.inside).toBe(true);
    expect(JSON.stringify(page)).not.toContain("not mine");
    expect((await getMyPlacePage(prisma, me, venue.id, OUTSIDE)).inside).toBe(false);
    expect(await getMyPlacePage(prisma, me, venue.id)).toMatchObject({ inside: null, distanceM: null });
    await expect(getMyPlacePage(prisma, null, venue.id)).rejects.toMatchObject({ status: 401 });
  });
});
