// The rules that must never break (CLAUDE.md section "Rules that must never break"). One test per rule, named
// "rule N: ...". scripts/gate.sh fails if this file is missing, skipped, or if a required rule below has no passing test.
// Required rules are listed in scripts/invariants-required.txt.
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { submitPhoto, processImage } from "@/server/services/photos";
import { getPost, listUserPosts, listUserPlaces, removePost } from "@/server/services/posts";
import { decideFollowRequest, follow, getProfile } from "@/server/services/people";
import { blockUser } from "@/server/services/blocks";
import { likePost } from "@/server/services/likes";
import { getMe } from "@/server/services/me";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeUser, makeVenue, verify, INSIDE, OUTSIDE } from "./factories";

installMemoryStorage();

const wire = (x: unknown) => JSON.parse(JSON.stringify(x)) as unknown;
const png = () => sharp({ create: { width: 8, height: 8, channels: 3, background: "#336699" } }).png().toBuffer();
async function stamp(actor: Awaited<ReturnType<typeof makeActor>>, venueId: string, at = INSIDE, rating = "7") {
  return submitPhoto(prisma, actor, venueId, { bytes: await png(), meta: { caption: "hi", lat: String(at.lat), lng: String(at.lng), rating } });
}

describe("invariants", () => {
  it("rule 1: a stamp is created only inside the geofence; exempt accounts are the only exception and see only themselves", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    await expect(stamp(me, venue.id, OUTSIDE)).rejects.toMatchObject({ status: 403 });
    expect(await prisma.photo.count({ where: { venueId: venue.id } })).toBe(0);
    await expect(stamp(me, venue.id, INSIDE)).resolves.toBeTruthy();
    const reviewer = await makeActor({ isPrivate: false });
    await prisma.user.update({ where: { id: reviewer.userId }, data: { geofenceExempt: true } });
    const exempt = { ...reviewer, geofenceExempt: true };
    const post = await stamp(exempt, venue.id, OUTSIDE, "9");
    await expect(getPost(prisma, await makeActor(), post.id)).rejects.toMatchObject({ status: 404 });
    await expect(getPost(prisma, exempt, post.id)).resolves.toBeTruthy();
  });

  it("rule 2: a private account's stamps and places reach nobody without full access", async () => {
    const venue = await makeVenue();
    const author = await makeActor({ handle: "inv_private" });
    const post = await stamp(author, venue.id);
    const requester = await makeActor();
    await follow(prisma, requester, author.handle);
    const follower = await makeActor();
    await follow(prisma, follower, author.handle);
    await decideFollowRequest(prisma, author, follower.handle, { approve: true });
    for (const v of [null, await makeActor(), requester]) {
      await expect(listUserPosts(prisma, v, author.handle)).rejects.toMatchObject({ status: 403 });
      await expect(listUserPlaces(prisma, v, author.handle)).rejects.toMatchObject({ status: 403 });
      const profile = JSON.stringify(wire(await getProfile(prisma, author.handle, v)));
      expect(profile).not.toContain(venue.slug);
      expect(profile).not.toContain(post.id);
    }
    await expect(listUserPosts(prisma, follower, author.handle)).resolves.toBeTruthy();
    await expect(listUserPosts(prisma, author, author.handle)).resolves.toBeTruthy();
  });

  it("rule 3: a block in either direction hides everything, except from staff", async () => {
    const venue = await makeVenue();
    const author = await makeActor({ isPrivate: false });
    const post = await stamp(author, venue.id);
    const other = await makeActor();
    await blockUser(prisma, other, author.handle);
    await expect(getPost(prisma, other, post.id)).rejects.toMatchObject({ status: 404 });
    await expect(getPost(prisma, author, post.id)).resolves.toBeTruthy();
    await expect(listUserPosts(prisma, other, author.handle)).rejects.toMatchObject({ status: 404 });
    await expect(listUserPosts(prisma, author, other.handle)).rejects.toMatchObject({ status: 404 });
    await expect(getPost(prisma, await makeActor({ role: "MODERATOR" }), post.id)).resolves.toBeTruthy();
  });

  it("rule 4: hidden content is hidden, never deleted; the moderation log is append-only", async () => {
    const venue = await makeVenue();
    const author = await makeActor({ isPrivate: false });
    const post = await stamp(author, venue.id);
    await removePost(prisma, author, post.id);
    expect(await prisma.photo.findUnique({ where: { id: post.id } })).toMatchObject({ removedAt: expect.any(Date) });
    await expect(prisma.photo.delete({ where: { id: post.id } })).rejects.toThrow(/hide user content/);
    const event = await prisma.moderationEvent.create({ data: { action: "HIDE", targetType: "PHOTO", targetId: post.id, actorId: author.userId } });
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
    const meta = await sharp(bytes).metadata();
    expect(meta.exif).toBeUndefined();
    expect(bytes.toString("latin1")).not.toContain("LeakyPhone");
  });

  it("rule 6: no user coordinates, storage keys or user ids reach a viewer who should not get them", async () => {
    const venue = await makeVenue();
    const author = await makeActor({ isPrivate: false });
    const post = await stamp(author, venue.id);
    const viewer = await makeActor();
    const json = JSON.stringify([wire(await getPost(prisma, viewer, post.id)), wire(await listUserPosts(prisma, viewer, author.handle)), wire(await getProfile(prisma, author.handle, viewer))]);
    // Media is reachable only through a signed URL, never as a raw storage key field.
    expect(json).not.toMatch(/"(storageKey|storage_key|userId|user_id)"/);
    for (const m of json.matchAll(/"url":"([^"]+)"/g)) expect(m[1]).toMatch(/[?&]sig=/);
    expect(json).not.toContain(author.userId);
    expect(json).not.toContain(String(INSIDE.lat));
    expect(json).not.toContain(String(INSIDE.lng));
  });

  it("rule 7: reputation is visible only to the user and moderators", async () => {
    const subject = await makeActor({ isPrivate: false, reputation: 0.77 });
    const stranger = await makeActor();
    const mod = await makeActor({ role: "MODERATOR" });
    const seen = async (v: typeof stranger) => {
      const p = await getProfile(prisma, subject.handle, v);
      return p.access === "full" || p.access === "limited" ? (p.user as { reputation?: number | null }).reputation ?? null : null;
    };
    expect(await seen(stranger)).toBeNull();
    expect(await seen(subject)).toBe(0.77);
    expect(await seen(mod)).toBe(0.77);
    expect(JSON.stringify(wire(await getMe(prisma, stranger)))).not.toContain("0.77");
  });

  it("rule 10: likes and badges never affect anything else", async () => {
    const venue = await makeVenue();
    const author = await makeActor({ isPrivate: false });
    const post = await stamp(author, venue.id);
    const fan = await makeActor();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: author.userId } });
    const rowBefore = await prisma.photo.findUniqueOrThrow({ where: { id: post.id } });
    await likePost(prisma, fan, post.id);
    await verify(author.userId);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: author.userId } });
    const rowAfter = await prisma.photo.findUniqueOrThrow({ where: { id: post.id } });
    expect(after.reputation).toBe(before.reputation);
    expect(after.isPrivate).toBe(before.isPrivate);
    expect({ ...rowAfter, updatedAt: null }).toEqual({ ...rowBefore, updatedAt: null });
    // A verified private account is still private.
    const priv = await makeUser({ isPrivate: true });
    await verify(priv.id);
    await expect(listUserPosts(prisma, await makeActor(), priv.handle)).rejects.toMatchObject({ status: 403 });
  });
});
