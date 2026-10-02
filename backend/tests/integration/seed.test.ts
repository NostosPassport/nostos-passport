import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { login } from "@/server/services/auth";
import { getStamp, listFeed, listUserStamps } from "@/server/services/stamps";
import { getProfile } from "@/server/services/people";
import { moderationQueue } from "@/server/services/moderation";
import { getMe } from "@/server/services/me";
import { actorFor } from "./factories";
import { getStorage } from "@/lib/storage";
import { installMemoryStorage } from "./mem-storage";
import { seed } from "../../prisma/seed";
import { PEOPLE, PLACES } from "../../prisma/seed-data";

const mem = installMemoryStorage();
const NOW = new Date("2026-10-02T16:00:00Z");
const env = { APP_ENV: "development", DEV_SEED_PASSWORD: "seed password 123" };
const run = (now = NOW) => seed(prisma, { now, storage: getStorage(), env });
const id = (handle: string) => `seed_u_${handle}`;
const actor = async (handle: string) => (await actorFor(id(handle)))!;

describe("the demo seed", () => {
  it("is deterministic: the same anchor gives the same rows", async () => {
    await run();
    const snap = async () =>
      JSON.stringify([
        await prisma.photo.findMany({ orderBy: { id: "asc" }, select: { id: true, userId: true, venueId: true, caption: true, songTitle: true, storageKey: true, createdAt: true, hiddenAt: true, removedAt: true } }),
        await prisma.photoLike.findMany({ orderBy: [{ userId: "asc" }, { photoId: "asc" }] }),
        await prisma.follow.findMany({ orderBy: [{ followerId: "asc" }, { followeeId: "asc" }] }),
      ]);
    const first = await snap();
    await run();
    expect(await snap()).toBe(first);
  });

  it("is anchored to now: a later anchor moves every timestamp with it", async () => {
    await run();
    const latestA = (await prisma.photo.findFirstOrThrow({ orderBy: { createdAt: "desc" } })).createdAt.getTime();
    await run(new Date(NOW.getTime() + 3 * 86_400_000));
    const latestB = (await prisma.photo.findFirstOrThrow({ orderBy: { createdAt: "desc" } })).createdAt.getTime();
    expect(latestB - latestA).toBe(3 * 86_400_000);
    expect(NOW.getTime() - latestA).toBeLessThan(24 * 3600_000);
  });

  it("has the cast: public and private accounts, one verified, one blocked pair, pending requests, staff and App Review", async () => {
    const s = await run();
    expect(s).toMatchObject({ places: PLACES.length, people: PEOPLE.length });
    const users = await prisma.user.findMany();
    expect(users.some((u) => u.isPrivate) && users.some((u) => !u.isPrivate)).toBe(true);
    expect(users.filter((u) => u.verifiedAt).map((u) => u.handle)).toEqual(["maya_r"]);
    expect(await prisma.verificationEvent.count()).toBe(1);
    expect(await prisma.block.count()).toBe(1);
    expect(await prisma.block.findFirstOrThrow()).toMatchObject({ blockerId: id("blocker_blake"), blockedId: id("blocked_bea") });
    expect(await prisma.followRequest.count({ where: { targetId: id("avaa") } })).toBe(4);
    expect(await prisma.follow.count({ where: { followerId: id("moth_hopeful") } })).toBe(0);
    expect(users.find((u) => u.handle === "admin")!.role).toBe("ADMIN");
    expect(users.find((u) => u.handle === "mod_morgan")!.role).toBe("MODERATOR");
    expect(users.find((u) => u.handle === "appreview")!.geofenceExempt).toBe(true);
    expect(users.filter((u) => u.handle !== "appreview").every((u) => !u.geofenceExempt)).toBe(true);
    // No owner accounts, and nobody is "anonymous".
    expect(users.map((u) => u.handle).join(",")).not.toMatch(/owner|anonymous/);
  });

  it("has stamps of every kind at several places, with likes that obey the rules", async () => {
    await run();
    const stamps = await prisma.photo.findMany();
    expect(stamps.length).toBeGreaterThan(40);
    expect(stamps.some((s) => s.storageKey && s.caption && s.songTitle)).toBe(true); // photo + caption + song
    expect(stamps.some((s) => s.storageKey && !s.caption && !s.songTitle)).toBe(true); // photo only
    expect(stamps.some((s) => !s.storageKey && s.caption && !s.songTitle)).toBe(true); // caption only
    expect(stamps.some((s) => !s.storageKey && !s.caption && s.songTitle)).toBe(true); // song only
    expect(new Set(stamps.map((s) => s.venueId)).size).toBeGreaterThan(8);
    for (const s of stamps.filter((x) => x.storageKey)) expect(mem.has(s.storageKey!)).toBe(true);
    const likes = await prisma.photoLike.findMany({ include: { photo: true } });
    expect(likes.length).toBeGreaterThan(50);
    expect(likes.every((l) => l.userId !== l.photo.userId && !l.photo.hiddenAt && !l.photo.removedAt && l.photo.countable)).toBe(true);
  });

  it("every stamp is inside its place's geofence, except App Review's, which only that account can see", async () => {
    await run();
    const places = new Map((await prisma.venue.findMany()).map((p) => [p.id, p]));
    const { distanceMeters } = await import("@/lib/geo");
    for (const s of await prisma.photo.findMany()) {
      const p = places.get(s.venueId)!;
      const d = distanceMeters({ lat: s.lat, lng: s.lng }, p);
      if (s.userId === id("appreview")) {
        expect(s.countable).toBe(false);
        expect(d).toBeGreaterThan(p.geofenceMeters);
      } else expect(d).toBeLessThanOrEqual(p.geofenceMeters);
    }
    const reviewStamp = await prisma.photo.findFirstOrThrow({ where: { userId: id("appreview") } });
    await expect(getStamp(prisma, await actor("maya_r"), reviewStamp.id)).rejects.toMatchObject({ status: 404 });
    await expect(getStamp(prisma, await actor("appreview"), reviewStamp.id)).resolves.toBeTruthy();
  });

  it("privacy holds on the seeded data: a stranger sees nothing of a private passport, a follower sees it, a pending request is not enough", async () => {
    await run();
    const priv = "avaa";
    const stranger = await actor("moth_hopeful");
    const follower = await actor("maya_r");
    const requester = await actor("rowan_k");
    for (const v of [null, stranger, requester]) {
      expect((await getProfile(prisma, priv, v)).access).toBe("limited");
      await expect(listUserStamps(prisma, v, priv)).rejects.toMatchObject({ status: 403 });
    }
    expect((await getProfile(prisma, priv, follower)).access).toBe("full");
    const stamp = await prisma.photo.findFirstOrThrow({ where: { userId: id(priv), hiddenAt: null, removedAt: null } });
    await expect(getStamp(prisma, stranger, stamp.id)).rejects.toMatchObject({ status: 404 });
    await expect(getStamp(prisma, follower, stamp.id)).resolves.toBeTruthy();
    expect((await listFeed(prisma, await actor("avaa"))).stamps.length).toBeGreaterThan(0);
  });

  it("the blocked pair cannot see each other; a hidden and a removed stamp are gone for everyone but staff", async () => {
    await run();
    const blake = await actor("blocker_blake");
    const bea = await actor("blocked_bea");
    await expect(getProfile(prisma, "blocked_bea", blake)).rejects.toMatchObject({ status: 404 });
    await expect(getProfile(prisma, "blocker_blake", bea)).rejects.toMatchObject({ status: 404 });
    const hidden = await prisma.photo.findFirstOrThrow({ where: { hiddenAt: { not: null } } });
    const removed = await prisma.photo.findFirstOrThrow({ where: { removedAt: { not: null } } });
    const viewer = await actor("nia_s");
    for (const s of [hidden, removed]) {
      await expect(getStamp(prisma, viewer, s.id)).rejects.toMatchObject({ status: 404 });
      await expect(getStamp(prisma, await actor("mod_morgan"), s.id)).resolves.toBeTruthy();
    }
  });

  it("gives the moderator a queue to try, and the demo accounts sign in with the dev password", async () => {
    await run();
    expect((await moderationQueue(prisma, await actor("mod_morgan"))).length).toBe(1);
    expect((await getMe(prisma, await actor("avaa"))).social.pendingFollowRequests).toBe(4);
    for (const handle of ["avaa", "maya_r", "mod_morgan", "admin", "appreview", "moth_hopeful"]) {
      expect(await login(prisma, { email: `${handle}@lastcall.dev`, password: "seed password 123" })).toBeTruthy();
    }
  });

  it("refuses to run against production", async () => {
    await expect(seed(prisma, { now: NOW, storage: getStorage(), env: { APP_ENV: "production" } })).rejects.toThrow(/Refusing to run the demo seed/);
  });
});
