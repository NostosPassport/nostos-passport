// The rules that must never break (CLAUDE.md section "Rules that must never break"). One test per rule, named
// "rule N: ...". scripts/gate.sh fails if this file is missing, skipped, or if a required rule below has no passing test.
// Required rules are listed in scripts/invariants-required.txt.
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { processImage } from "@/server/services/image";
import { createStamp, getStamp, listFeed, listUserPlaces, listUserStamps, removeStamp } from "@/server/services/stamps";
import { decideFollowRequest, follow, getProfile } from "@/server/services/people";
import { blockUser } from "@/server/services/blocks";
import { likeStamp } from "@/server/services/likes";
import { getMe } from "@/server/services/me";
import { listActivity } from "@/server/services/activity";
import { installMemoryStorage } from "./mem-storage";
import { actorFor, makeActor, makeStamp, makeUser, makeVenue, verify, INSIDE, OUTSIDE } from "./factories";

installMemoryStorage();

const wire = (x: unknown) => JSON.parse(JSON.stringify(x)) as unknown;

describe("invariants", () => {
  it("rule 1: a stamp is created only inside the geofence; exempt accounts are the only exception and see only themselves", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    await expect(makeStamp(me, venue.id, { at: OUTSIDE })).rejects.toMatchObject({ status: 403 });
    // Even a request that lies about nothing but is far away, and one with coordinates just past the radius.
    await expect(makeStamp(me, venue.id, { at: { lat: INSIDE.lat + 0.002, lng: INSIDE.lng } })).rejects.toMatchObject({ status: 403 });
    expect(await prisma.photo.count({ where: { venueId: venue.id } })).toBe(0);
    await expect(makeStamp(me, venue.id, { at: INSIDE })).resolves.toBeTruthy();
    const reviewer = await makeActor({ isPrivate: false });
    await prisma.user.update({ where: { id: reviewer.userId }, data: { geofenceExempt: true } });
    const exempt = { ...reviewer, geofenceExempt: true };
    const stamp = await makeStamp(exempt, venue.id, { at: OUTSIDE });
    await expect(getStamp(prisma, await makeActor(), stamp.id)).rejects.toMatchObject({ status: 404 });
    await expect(getStamp(prisma, exempt, stamp.id)).resolves.toBeTruthy();
  });

  it("rule 2: a private account's stamps and places reach nobody without full access, in any payload", async () => {
    const venue = await makeVenue();
    const author = await makeActor({ handle: "inv_private" });
    const stamp = await makeStamp(author, venue.id);
    const requester = await makeActor();
    await follow(prisma, requester, author.handle);
    const follower = await makeActor();
    await follow(prisma, follower, author.handle);
    await decideFollowRequest(prisma, author, follower.handle, { approve: true });
    for (const v of [null, await makeActor(), requester]) {
      await expect(getStamp(prisma, v, stamp.id)).rejects.toMatchObject({ status: 404 });
      await expect(listUserStamps(prisma, v, author.handle)).rejects.toMatchObject({ status: 403 });
      await expect(listUserPlaces(prisma, v, author.handle)).rejects.toMatchObject({ status: 403 });
      const profile = JSON.stringify(wire(await getProfile(prisma, author.handle, v)));
      expect(profile).not.toContain(venue.slug);
      expect(profile).not.toContain(stamp.id);
    }
    // The pending requester sees nothing of the author's stamps in the feed or in activity either.
    expect((await listFeed(prisma, requester)).stamps).toEqual([]);
    await expect(listUserStamps(prisma, follower, author.handle)).resolves.toBeTruthy();
    await expect(listUserPlaces(prisma, follower, author.handle)).resolves.toBeTruthy();
    expect((await listFeed(prisma, follower)).stamps.map((s) => s.id)).toEqual([stamp.id]);
    await expect(getStamp(prisma, author, stamp.id)).resolves.toBeTruthy();
  });

  it("rule 3: a block in either direction hides everything, except from staff", async () => {
    const venue = await makeVenue();
    const author = await makeActor({ isPrivate: false });
    const stamp = await makeStamp(author, venue.id);
    const other = await makeActor();
    await blockUser(prisma, other, author.handle);
    for (const [viewer, target] of [[other, author], [author, other]] as const) {
      await expect(listUserStamps(prisma, viewer, target.handle)).rejects.toMatchObject({ status: 404 });
      await expect(getProfile(prisma, target.handle, viewer)).rejects.toMatchObject({ status: 404 });
    }
    await expect(getStamp(prisma, other, stamp.id)).rejects.toMatchObject({ status: 404 });
    await expect(likeStamp(prisma, other, stamp.id)).rejects.toMatchObject({ status: 404 });
    await expect(getStamp(prisma, author, stamp.id)).resolves.toBeTruthy();
    await expect(getStamp(prisma, await makeActor({ role: "MODERATOR" }), stamp.id)).resolves.toBeTruthy();
  });

  it("rule 4: hidden content is hidden, never deleted; the moderation log is append-only", async () => {
    const venue = await makeVenue();
    const author = await makeActor({ isPrivate: false });
    const stamp = await makeStamp(author, venue.id);
    await removeStamp(prisma, author, stamp.id);
    expect(await prisma.photo.findUnique({ where: { id: stamp.id } })).toMatchObject({ removedAt: expect.any(Date) });
    await expect(getStamp(prisma, await makeActor(), stamp.id)).rejects.toMatchObject({ status: 404 });
    await expect(prisma.photo.delete({ where: { id: stamp.id } })).rejects.toThrow(/hide user content/);
    const event = await prisma.moderationEvent.create({ data: { action: "HIDE", targetType: "PHOTO", targetId: stamp.id, actorId: author.userId } });
    await expect(prisma.moderationEvent.update({ where: { id: event.id }, data: { note: "x" } })).rejects.toThrow(/append-only/);
    await expect(prisma.moderationEvent.delete({ where: { id: event.id } })).rejects.toThrow(/append-only/);
  });

  it("rule 5: EXIF and GPS are stripped from every upload", async () => {
    const jpeg = await sharp({ create: { width: 200, height: 100, channels: 3, background: "#ff3d6e" } })
      .jpeg()
      .withExif({ IFD0: { Make: "LeakyPhone" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "40/1 43/1 36/1" } })
      .toBuffer();
    expect((await sharp(jpeg).metadata()).exif).toBeTruthy();
    const { bytes } = await processImage(jpeg);
    expect((await sharp(bytes).metadata()).exif).toBeUndefined();
    expect(bytes.toString("latin1")).not.toContain("LeakyPhone");
    // And through the real stamp path: what lands in storage is clean.
    const venue = await makeVenue();
    const me = await makeActor();
    const stamp = await createStamp(prisma, me, venue.id, { bytes: jpeg, meta: { caption: "", lat: String(INSIDE.lat), lng: String(INSIDE.lng) } });
    const row = await prisma.photo.findUniqueOrThrow({ where: { id: stamp.id } });
    const stored = await (await import("@/lib/storage")).getStorage().get(row.storageKey!);
    expect(stored).not.toBeNull();
    expect((await sharp(stored!).metadata()).exif).toBeUndefined();
    expect(stored!.toString("latin1")).not.toContain("LeakyPhone");
  });

  it("rule 6: no user coordinates, storage keys or user ids reach a viewer who should not get them", async () => {
    const venue = await makeVenue();
    const author = await makeActor({ isPrivate: false });
    // A stamper's own position, distinct from the place's (the place's location is public, the stamper's never is).
    const at = { lat: INSIDE.lat + 0.00031, lng: INSIDE.lng + 0.00027 };
    const stamp = await makeStamp(author, venue.id, { at });
    const viewer = await makeActor();
    await likeStamp(prisma, viewer, stamp.id);
    await follow(prisma, viewer, author.handle);
    const payloads = [
      wire(await getStamp(prisma, viewer, stamp.id)), wire(await listUserStamps(prisma, viewer, author.handle)),
      wire(await getProfile(prisma, author.handle, viewer)), wire(await listFeed(prisma, viewer)),
      wire(await listActivity(prisma, await actorFor(author.userId))),
    ];
    const places = wire(await listUserPlaces(prisma, viewer, author.handle));
    const json = JSON.stringify([...payloads, places]);
    // Media is reachable only through a signed URL, never as a raw storage key field.
    expect(json).not.toMatch(/"(storageKey|storage_key|userId|user_id)"/);
    for (const m of json.matchAll(/"(?:url|photoUrl)":"([^"]+)"/g)) expect(m[1]).toMatch(/[?&]sig=/);
    expect(json).not.toContain(author.userId);
    expect(json).not.toContain(viewer.userId);
    // The stamper's coordinates appear nowhere. Only the places list carries lat and lng, and those are the place's own.
    expect(json).not.toContain(String(at.lat));
    expect(json).not.toContain(String(at.lng));
    expect(JSON.stringify(payloads)).not.toMatch(/"(lat|lng)"/);
    expect(JSON.stringify(places)).toContain(String(venue.lat));
  });

  it("rule 7: reputation is visible only to the user and moderators", async () => {
    const subject = await makeActor({ isPrivate: false, reputation: 0.77 });
    const stranger = await makeActor();
    const mod = await makeActor({ role: "MODERATOR" });
    const seen = async (v: typeof stranger) => {
      const p = await getProfile(prisma, subject.handle, v);
      return p.access === "full" ? p.user.reputation : null;
    };
    expect(await seen(stranger)).toBeNull();
    expect(await seen(subject)).toBe(0.77);
    expect(await seen(mod)).toBe(0.77);
    expect(JSON.stringify(wire(await getMe(prisma, stranger)))).not.toContain("0.77");
    // It never appears on a stamp, in the feed or in a list.
    const venue = await makeVenue();
    const stamp = await makeStamp(subject, venue.id);
    await follow(prisma, stranger, subject.handle);
    expect(JSON.stringify([wire(await getStamp(prisma, stranger, stamp.id)), wire(await listFeed(prisma, stranger))])).not.toMatch(/reputation|0\.77/);
  });

  it("rule 9: the feed is chronological from people you follow, with no ranking or personalization", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const a = await makeActor({ isPrivate: false });
    const b = await makeActor({ isPrivate: false });
    const stranger = await makeActor({ isPrivate: false });
    await follow(prisma, me, a.handle);
    await follow(prisma, me, b.handle);
    const t0 = Date.now() - 3 * 3600_000;
    const s1 = await makeStamp(a, venue.id, { caption: "first", now: new Date(t0) });
    const s2 = await makeStamp(b, venue.id, { caption: "second", now: new Date(t0 + 3600_000) });
    const s3 = await makeStamp(a, venue.id, { caption: "third", now: new Date(t0 + 2 * 3600_000) });
    await makeStamp(stranger, venue.id, { caption: "not followed", now: new Date(t0 + 2.5 * 3600_000) });
    // Likes, a verified badge and a higher reputation change nothing about the order.
    const fan = await makeActor();
    await likeStamp(prisma, fan, s1.id);
    await verify(a.userId);
    await prisma.user.update({ where: { id: a.userId }, data: { reputation: 1.4 } });
    const feed = await listFeed(prisma, me);
    expect(feed.stamps.map((s) => s.id)).toEqual([s3.id, s2.id, s1.id]);
    // Same answer for anyone with the same follows: nothing about the viewer's history shapes it.
    const twin = await makeActor();
    await follow(prisma, twin, a.handle);
    await follow(prisma, twin, b.handle);
    await likeStamp(prisma, twin, s2.id);
    expect((await listFeed(prisma, twin)).stamps.map((s) => s.id)).toEqual([s3.id, s2.id, s1.id]);
    // Paging is by time, newest first, with no gaps.
    const times = feed.stamps.map((s) => s.createdAt.getTime());
    expect([...times].sort((x, y) => y - x)).toEqual(times);
  });

  it("rule 10: likes and badges never affect anything else", async () => {
    const venue = await makeVenue();
    const author = await makeActor({ isPrivate: false });
    const stamp = await makeStamp(author, venue.id);
    const fan = await makeActor();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: author.userId } });
    const rowBefore = await prisma.photo.findUniqueOrThrow({ where: { id: stamp.id } });
    await likeStamp(prisma, fan, stamp.id);
    await verify(author.userId);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: author.userId } });
    const rowAfter = await prisma.photo.findUniqueOrThrow({ where: { id: stamp.id } });
    expect(after.reputation).toBe(before.reputation);
    expect(after.isPrivate).toBe(before.isPrivate);
    expect(rowAfter).toEqual(rowBefore);
    // A verified private account is still private.
    const priv = await makeUser({ isPrivate: true });
    await verify(priv.id);
    await expect(listUserStamps(prisma, await makeActor(), priv.handle)).rejects.toMatchObject({ status: 403 });
  });
});
