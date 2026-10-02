import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createStamp, editStamp, getStamp, listFeed, listUserPlaces, listUserStamps, removeStamp, STAMPS_PAGE } from "@/server/services/stamps";
import { likeStamp, unlikeStamp } from "@/server/services/likes";
import { flagContent } from "@/server/services/moderation";
import { follow } from "@/server/services/people";
import { nearbyPlaces } from "@/server/services/places";
import { RATE_LIMITS } from "@/server/rate-limit";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeStamp, makeVenue, INSIDE, OUTSIDE } from "./factories";

const mem = installMemoryStorage();
const ART = "https://is1-ssl.mzstatic.com/image/thumb/Music/x/300x300bb.jpg";

describe("creating a stamp", () => {
  it("takes a photo, a caption, a song, or any mix, and refuses an empty one", async () => {
    const [a, b, c, d] = [await makeVenue(), await makeVenue(), await makeVenue(), await makeVenue()];
    const me = await makeActor();
    const photoOnly = await makeStamp(me, a.id, { caption: "", photo: true });
    expect(photoOnly).toMatchObject({ caption: "", song: null });
    expect(photoOnly.photoUrl).toMatch(/^\/api\/uploads\/photos\//);
    const captionOnly = await makeStamp(me, b.id, { caption: "just words", photo: false });
    expect(captionOnly).toMatchObject({ photoUrl: null, caption: "just words", song: null });
    const songOnly = await makeStamp(me, c.id, { caption: "", photo: false, meta: { songTitle: "Wild Horses", songArtist: "The Rolling Stones", songArtUrl: ART, songSourceId: "42" } });
    expect(songOnly).toMatchObject({ photoUrl: null, caption: "", song: { title: "Wild Horses", artist: "The Rolling Stones", artUrl: ART, sourceId: "42" } });
    await expect(makeStamp(me, d.id, { caption: "", photo: false })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/photo, a caption or a song/) });
    await expect(makeStamp(me, d.id, { caption: "   ", photo: false })).rejects.toMatchObject({ status: 400 });
    expect(await prisma.photo.count({ where: { venueId: d.id } })).toBe(0);
  });

  it("validates captions and songs", async () => {
    const v = await makeVenue();
    const me = await makeActor();
    await expect(makeStamp(me, v.id, { caption: "x".repeat(281) })).rejects.toThrow(/280 characters max/);
    await expect(makeStamp(me, v.id, { caption: "x", meta: { songTitle: "Only a title" } })).rejects.toThrow(/title and an artist/);
    await expect(makeStamp(me, v.id, { caption: "x", meta: { songTitle: "T", songArtist: "A", songArtUrl: "https://evil.example/pixel.gif" } })).rejects.toThrow();
    await expect(makeStamp(me, v.id, { caption: "x", meta: { songTitle: "T", songArtist: "A", songArtUrl: "http://a.mzstatic.com/x.jpg" } })).rejects.toThrow();
    await expect(makeStamp(me, v.id, { caption: "x", meta: { rating: "11" } })).rejects.toThrow();
    await expect(makeStamp(me, v.id, { caption: "x", meta: { bogus: "1" } })).rejects.toThrow();
    expect(await prisma.photo.count()).toBe(0);
    // The optional rating is stored but never shown.
    const ok = await makeStamp(me, v.id, { caption: "rated", meta: { rating: "9" } });
    expect(JSON.stringify(ok)).not.toMatch(/rating/);
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: ok.id } })).rating).toBe(9);
  });

  it("is geofenced per place: the place's own radius decides, the message says how far away you are", async () => {
    const tight = await makeVenue({ geofenceMeters: 30 });
    const wide = await makeVenue({ geofenceMeters: 400 });
    const me = await makeActor();
    const near = { lat: INSIDE.lat + 0.0006, lng: INSIDE.lng }; // roughly 87 m from the place
    await expect(makeStamp(me, tight.id, { at: near })).rejects.toMatchObject({ status: 403, message: expect.stringMatching(/within 30 m.*you're \d+ m away/) });
    await expect(makeStamp(me, wide.id, { at: near })).resolves.toBeTruthy();
    await expect(makeStamp(me, wide.id, { at: { lat: 91, lng: 0 }, now: new Date(Date.now() + 20 * 60_000) })).rejects.toMatchObject({ status: 400 });
    await expect(makeStamp(me, "no-such-place", {})).rejects.toMatchObject({ status: 404 });
    await expect(createStamp(prisma, null, wide.id, { meta: { caption: "x", lat: "1", lng: "1" } })).rejects.toMatchObject({ status: 401 });
  });

  it("allows one stamp per place per 15 minutes, and 20 an hour across places", async () => {
    const v = await makeVenue();
    const me = await makeActor();
    const t = new Date();
    await makeStamp(me, v.id, { now: t });
    await expect(makeStamp(me, v.id, { now: new Date(t.getTime() + 5 * 60_000) })).rejects.toMatchObject({ status: 429 });
    await expect(makeStamp(me, v.id, { now: new Date(t.getTime() + 16 * 60_000) })).resolves.toBeTruthy();
    const other = await makeActor();
    for (let i = 0; i < RATE_LIMITS.post.max; i++) await makeStamp(other, (await makeVenue()).id, { now: t });
    await expect(makeStamp(other, (await makeVenue()).id, { now: t })).rejects.toMatchObject({ status: 429 });
  });

  it("strips EXIF and leaves no photo behind when the transaction fails", async () => {
    const v = await makeVenue();
    const me = await makeActor();
    await makeStamp(me, v.id);
    const before = mem.size;
    await expect(makeStamp(me, v.id, { now: new Date(Date.now() + 60_000) })).rejects.toMatchObject({ status: 429 });
    expect(mem.size).toBe(before);
  });

  it("rejects things that aren't images", async () => {
    const v = await makeVenue();
    const me = await makeActor();
    await expect(createStamp(prisma, me, v.id, { bytes: Buffer.from("not an image at all"), meta: { caption: "x", lat: String(INSIDE.lat), lng: String(INSIDE.lng) } })).rejects.toMatchObject({ status: 415 });
  });

  it("an account with no stamps has no places, and a stamp's response never carries coordinates or storage keys", async () => {
    const v = await makeVenue();
    const me = await makeActor();
    const s = await makeStamp(me, v.id);
    expect(JSON.stringify(s)).not.toMatch(/"(lat|lng|storageKey|userId)"/);
    expect(s.author).toEqual({ handle: me.handle, displayName: me.displayName, avatarUrl: null, verified: false });
  });
});

describe("editing and removing a stamp", () => {
  it("the author edits the caption and the song; the photo, place and time never change", async () => {
    const v = await makeVenue();
    const me = await makeActor();
    const s = await makeStamp(me, v.id, { caption: "before" });
    const edited = await editStamp(prisma, me, s.id, { caption: "after", song: { title: "Song", artist: "Band", artUrl: ART } });
    expect(edited.stamp).toMatchObject({ caption: "after", song: { title: "Song", artist: "Band", artUrl: ART, sourceId: null }, photoUrl: s.photoUrl, createdAt: s.createdAt });
    expect(edited.stamp.editedAt).not.toBeNull();
    const cleared = await editStamp(prisma, me, s.id, { song: null });
    expect(cleared.stamp.song).toBeNull();
    expect(cleared.stamp.caption).toBe("after");
    await expect(editStamp(prisma, me, s.id, {})).rejects.toThrow(/Nothing to change/);
    await expect(editStamp(prisma, me, s.id, { caption: "x".repeat(281) })).rejects.toThrow();
    await expect(editStamp(prisma, me, s.id, { caption: "porn" })).rejects.toMatchObject({ code: "objectionable_content" });
    await expect(editStamp(prisma, me, s.id, { song: { title: "T", artist: "A", artUrl: "https://evil.example/x.gif" } })).rejects.toThrow();
  });

  it("a stamp with no photo can't be edited into nothing", async () => {
    const v = await makeVenue();
    const me = await makeActor();
    const s = await makeStamp(me, v.id, { caption: "words", photo: false });
    await expect(editStamp(prisma, me, s.id, { caption: "" })).rejects.toMatchObject({ status: 400 });
    // A photo stamp can lose its caption.
    const w = await makeVenue();
    const p = await makeStamp(me, w.id, { caption: "words" });
    await expect(editStamp(prisma, me, p.id, { caption: "" })).resolves.toBeTruthy();
  });

  it("only the author edits or removes: everyone else, staff included, gets 403 or 404", async () => {
    const v = await makeVenue();
    const me = await makeActor({ isPrivate: false });
    const s = await makeStamp(me, v.id);
    for (const other of [await makeActor(), await makeActor({ role: "MODERATOR" }), await makeActor({ role: "ADMIN" })]) {
      await expect(editStamp(prisma, other, s.id, { caption: "mine now" })).rejects.toMatchObject({ status: 403 });
      await expect(removeStamp(prisma, other, s.id)).rejects.toMatchObject({ status: 403 });
    }
    await expect(editStamp(prisma, null, s.id, { caption: "x" })).rejects.toMatchObject({ status: 401 });
  });

  it("editing freezes while a flag is open and after a moderator hides it", async () => {
    const v = await makeVenue();
    const me = await makeActor({ isPrivate: false });
    const s = await makeStamp(me, v.id);
    await flagContent(prisma, await makeActor(), { targetType: "STAMP", targetId: s.id, reason: "looks fake" });
    await expect(editStamp(prisma, me, s.id, { caption: "rewrite" })).rejects.toMatchObject({ status: 409 });
    await prisma.flag.updateMany({ data: { status: "RESOLVED" } });
    await expect(editStamp(prisma, me, s.id, { caption: "ok now" })).resolves.toBeTruthy();
    await prisma.photo.update({ where: { id: s.id }, data: { hiddenAt: new Date() } });
    await expect(editStamp(prisma, me, s.id, { caption: "again" })).rejects.toMatchObject({ status: 409 });
  });

  it("'delete from profile' hides it everywhere for good, and never deletes the row", async () => {
    const v = await makeVenue();
    const me = await makeActor({ isPrivate: false });
    const viewer = await makeActor();
    await follow(prisma, viewer, me.handle);
    const s = await makeStamp(me, v.id);
    await removeStamp(prisma, me, s.id);
    await expect(removeStamp(prisma, me, s.id)).rejects.toMatchObject({ status: 404 });
    await expect(getStamp(prisma, viewer, s.id)).rejects.toMatchObject({ status: 404 });
    await expect(getStamp(prisma, me, s.id)).rejects.toMatchObject({ status: 404 });
    expect((await listUserStamps(prisma, me, me.handle)).stamps).toEqual([]);
    expect((await listFeed(prisma, viewer)).stamps).toEqual([]);
    expect((await listUserPlaces(prisma, me, me.handle)).places).toEqual([]);
    await expect(editStamp(prisma, me, s.id, { caption: "back?" })).rejects.toMatchObject({ status: 404 });
    // Staff can still see it (moderation), and the row is still there.
    await expect(getStamp(prisma, await makeActor({ role: "MODERATOR" }), s.id)).resolves.toMatchObject({ stamp: { removed: true } });
    expect(await prisma.photo.count({ where: { id: s.id } })).toBe(1);
  });
});

describe("likes", () => {
  it("one per person, not your own, counted once, undoable", async () => {
    const v = await makeVenue();
    const author = await makeActor({ isPrivate: false });
    const s = await makeStamp(author, v.id);
    const fan = await makeActor();
    await expect(likeStamp(prisma, author, s.id)).rejects.toMatchObject({ status: 400 });
    expect(await likeStamp(prisma, fan, s.id)).toEqual({ liked: true, count: 1, viewerLiked: true });
    expect(await likeStamp(prisma, fan, s.id)).toEqual({ liked: true, count: 1, viewerLiked: true });
    expect((await getStamp(prisma, await makeActor(), s.id)).stamp.likes).toEqual({ count: 1, viewerLiked: false });
    expect(await unlikeStamp(prisma, fan, s.id)).toEqual({ liked: false, count: 0, viewerLiked: false });
    await expect(likeStamp(prisma, null, s.id)).rejects.toMatchObject({ status: 401 });
  });

  it("not on hidden or removed stamps, and not on stamps you can't see", async () => {
    const v = await makeVenue();
    const author = await makeActor({ isPrivate: false });
    const hidden = await makeStamp(author, v.id);
    const w = await makeVenue();
    const removed = await makeStamp(author, w.id);
    await prisma.photo.update({ where: { id: hidden.id }, data: { hiddenAt: new Date() } });
    await removeStamp(prisma, author, removed.id);
    const fan = await makeActor();
    const mod = await makeActor({ role: "MODERATOR" });
    for (const viewer of [fan, mod]) {
      await expect(likeStamp(prisma, viewer, hidden.id)).rejects.toMatchObject({ status: 404 });
      await expect(likeStamp(prisma, viewer, removed.id)).rejects.toMatchObject({ status: 404 });
    }
    const priv = await makeActor();
    const x = await makeVenue();
    const secret = await makeStamp(priv, x.id);
    await expect(likeStamp(prisma, fan, secret.id)).rejects.toMatchObject({ status: 404 });
  });

  it("App Review likes and suspended people's likes don't count", async () => {
    const v = await makeVenue();
    const author = await makeActor({ isPrivate: false });
    const s = await makeStamp(author, v.id);
    const reviewer = await makeActor();
    await prisma.user.update({ where: { id: reviewer.userId }, data: { geofenceExempt: true } });
    await likeStamp(prisma, { ...reviewer, geofenceExempt: true }, s.id);
    const bad = await makeActor();
    await likeStamp(prisma, bad, s.id);
    await prisma.user.update({ where: { id: bad.userId }, data: { suspendedAt: new Date() } });
    expect((await getStamp(prisma, author, s.id)).stamp.likes.count).toBe(0);
  });

  it("the hourly like limit holds", async () => {
    const author = await makeActor({ isPrivate: false });
    const fan = await makeActor();
    const t = new Date();
    for (let i = 0; i < RATE_LIMITS.like.max; i++) {
      await prisma.rateEvent.create({ data: { userId: fan.userId, kind: "like", createdAt: t } });
    }
    const s = await makeStamp(author, (await makeVenue()).id);
    await expect(likeStamp(prisma, fan, s.id, t)).rejects.toMatchObject({ status: 429 });
  });
});

describe("the feed and the passport", () => {
  it("pages 30 at a time with a stable cursor, newest first, with no gaps or repeats", async () => {
    const me = await makeActor();
    const author = await makeActor({ isPrivate: false });
    await follow(prisma, me, author.handle);
    const base = Date.now() - 100 * 60_000;
    const venue = await makeVenue();
    // Two stamps in the same millisecond (cooldown bypassed by direct inserts) to prove ties don't skip rows.
    const same = new Date(base + 5000 * 60);
    const ids: string[] = [];
    for (let i = 0; i < STAMPS_PAGE + 5; i++) {
      const row = await prisma.photo.create({ data: { userId: author.userId, venueId: venue.id, caption: `s${i}`, ...INSIDE, createdAt: i >= STAMPS_PAGE ? same : new Date(base + i * 1000) } });
      ids.push(row.id);
    }
    const first = await listFeed(prisma, me);
    expect(first.stamps).toHaveLength(STAMPS_PAGE);
    expect(first.nextBefore).not.toBeNull();
    const second = await listFeed(prisma, me, first.nextBefore);
    const all = [...first.stamps, ...second.stamps].map((s) => s.id);
    expect(second.nextBefore).toBeNull();
    expect(new Set(all).size).toBe(STAMPS_PAGE + 5);
    expect([...all].sort()).toEqual([...ids].sort());
    const times = [...first.stamps, ...second.stamps].map((s) => s.createdAt.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    await expect(listFeed(prisma, me, "garbage")).rejects.toMatchObject({ status: 400 });
    await expect(listFeed(prisma, null)).rejects.toMatchObject({ status: 401 });
  });

  it("only shows people you follow: not yourself, not strangers, not people you unfollowed", async () => {
    const venue = await makeVenue();
    const me = await makeActor({ isPrivate: false });
    const a = await makeActor({ isPrivate: false });
    const stranger = await makeActor({ isPrivate: false });
    await makeStamp(me, venue.id, { caption: "mine" });
    await makeStamp(stranger, venue.id, { caption: "stranger" });
    await makeStamp(a, venue.id, { caption: "a" });
    expect((await listFeed(prisma, me)).stamps).toEqual([]);
    await follow(prisma, me, a.handle);
    expect((await listFeed(prisma, me)).stamps.map((s) => s.caption)).toEqual(["a"]);
    await prisma.follow.deleteMany({});
    expect((await listFeed(prisma, me)).stamps).toEqual([]);
  });

  it("the passport grid and places view count and group stamps by place", async () => {
    const [a, b] = [await makeVenue(), await makeVenue()];
    const me = await makeActor({ isPrivate: false });
    const t = Date.now() - 3 * 3600_000;
    await makeStamp(me, a.id, { caption: "first at a", now: new Date(t) });
    await makeStamp(me, a.id, { caption: "second at a", now: new Date(t + 3600_000) });
    const last = await makeStamp(me, b.id, { caption: "at b", now: new Date(t + 2 * 3600_000) });
    const viewer = await makeActor();
    const grid = await listUserStamps(prisma, viewer, me.handle);
    expect(grid.stamps.map((s) => s.caption)).toEqual(["first at a", "second at a", "at b"]);
    expect(grid.stamps.map((s) => [s.page, s.slot])).toEqual([[1, 1], [1, 2], [1, 3]]);
    const { places } = await listUserPlaces(prisma, viewer, me.handle);
    expect(places.map((p) => [p.place.slug, p.stamps])).toEqual([[b.slug, 1], [a.slug, 2]]);
    expect(places[0]!.latestStamp.id).toBe(last.id);
    expect(places[1]!.latestStamp.caption).toBe("second at a");
  });
});

describe("places", () => {
  it("lists places near a position, nearest first, flagging the ones whose geofence you're inside", async () => {
    const here = await makeVenue({ lat: INSIDE.lat, lng: INSIDE.lng });
    const close = await makeVenue({ lat: INSIDE.lat + 0.002, lng: INSIDE.lng });
    await makeVenue({ lat: OUTSIDE.lat + 0.1, lng: OUTSIDE.lng });
    const near = await nearbyPlaces(prisma, INSIDE);
    expect(near.map((p) => p.slug)).toEqual([here.slug, close.slug]);
    expect(near.map((p) => p.inside)).toEqual([true, false]);
    expect(near[0]!.distanceM).toBe(0);
    expect(JSON.stringify(near)).not.toMatch(/osmId/);
  });
});

describe("pages and slots", () => {
  it("numbers stamps oldest first, three to a page, from one shared function", async () => {
    const me = await makeActor();
    const t = Date.now() - 10 * 3600_000;
    const ids: string[] = [];
    for (let i = 0; i < 7; i++) ids.push((await makeStamp(me, (await makeVenue()).id, { caption: `n${i}`, now: new Date(t + i * 3600_000) })).id);
    const grid = await listUserStamps(prisma, me, me.handle);
    expect(grid.stamps.map((s) => s.caption)).toEqual(["n0", "n1", "n2", "n3", "n4", "n5", "n6"]);
    expect(grid.stamps.map((s) => `${s.page}.${s.slot}`)).toEqual(["1.1", "1.2", "1.3", "2.1", "2.2", "2.3", "3.1"]);
    // The same numbers appear on the single-stamp response.
    expect((await getStamp(prisma, me, ids[4]!)).stamp).toMatchObject({ page: 2, slot: 2 });
    // The oldest stays on page 1 when newer ones come; removing one closes the gap behind it.
    await removeStamp(prisma, me, ids[1]!);
    expect((await getStamp(prisma, me, ids[0]!)).stamp).toMatchObject({ page: 1, slot: 1 });
    expect((await getStamp(prisma, me, ids[2]!)).stamp).toMatchObject({ page: 1, slot: 2 });
    expect((await getStamp(prisma, me, ids[6]!)).stamp).toMatchObject({ page: 2, slot: 3 });
    // Staff looking at a removed stamp see no page.
    expect((await getStamp(prisma, await makeActor({ role: "MODERATOR" }), ids[1]!)).stamp).toMatchObject({ page: null, slot: null });
  });

  it("pages the passport oldest first with an after cursor and no gaps", async () => {
    const me = await makeActor();
    const venue = await makeVenue();
    const base = Date.now() - 90 * 60_000;
    for (let i = 0; i < STAMPS_PAGE + 4; i++) await prisma.photo.create({ data: { userId: me.userId, venueId: venue.id, caption: `s${i}`, ...INSIDE, createdAt: new Date(base + i * 1000) } });
    const first = await listUserStamps(prisma, me, me.handle);
    const second = await listUserStamps(prisma, me, me.handle, first.nextAfter);
    expect(first.stamps).toHaveLength(STAMPS_PAGE);
    expect([...first.stamps, ...second.stamps].map((s) => s.caption)).toEqual(Array.from({ length: STAMPS_PAGE + 4 }, (_, i) => `s${i}`));
    expect(second.nextAfter).toBeNull();
  });
});
