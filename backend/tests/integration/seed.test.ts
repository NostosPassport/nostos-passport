import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { devLogin } from "@/server/services/auth";
import { getStamp } from "@/server/services/stamps";
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
  it("is deterministic for a fixed anchor", async () => {
    await run();
    const snap = async () =>
      JSON.stringify([
        await prisma.user.findMany({ orderBy: { id: "asc" }, select: { id: true, handle: true, bio: true, geofenceExempt: true, createdAt: true } }),
        await prisma.photo.findMany({ orderBy: { id: "asc" }, select: { id: true, userId: true, venueId: true, caption: true, songTitle: true, storageKey: true, createdAt: true, visitedAt: true, verifiedAt: true, removedAt: true, countable: true } }),
        await prisma.stampPhoto.findMany({ orderBy: [{ stampId: "asc" }, { position: "asc" }], select: { stampId: true, storageKey: true, position: true, x: true, y: true, rotation: true } }),
      ]);
    const first = await snap();
    await run();
    expect(await snap()).toBe(first);
  });

  it("moves seeded timestamps with a later anchor", async () => {
    await run();
    const latestA = (await prisma.photo.findFirstOrThrow({ orderBy: { createdAt: "desc" } })).createdAt.getTime();
    await run(new Date(NOW.getTime() + 3 * 86_400_000));
    const latestB = (await prisma.photo.findFirstOrThrow({ orderBy: { createdAt: "desc" } })).createdAt.getTime();
    expect(latestB - latestA).toBe(3 * 86_400_000);
  });

  it("creates only current account fields and a single geofence-exempt App Review account", async () => {
    const summary = await run();
    expect(summary).toMatchObject({ places: PLACES.length, people: PEOPLE.length });
    const users = await prisma.user.findMany({ orderBy: { handle: "asc" } });
    expect(users).toHaveLength(PEOPLE.length);
    expect(users.filter((u) => u.geofenceExempt).map((u) => u.handle)).toEqual(["appreview"]);
    expect(users.every((u) => u.emailVerifiedAt && u.ageVerifiedAt && u.termsAcceptedAt)).toBe(true);
  });

  it("creates varied stamp content with stored media", async () => {
    await run();
    const stamps = await prisma.photo.findMany();
    expect(stamps.length).toBeGreaterThan(30);
    expect(stamps.some((s) => s.storageKey && s.caption && s.songTitle)).toBe(true);
    expect(stamps.some((s) => s.storageKey && !s.caption && !s.songTitle)).toBe(true);
    expect(stamps.some((s) => !s.storageKey && s.caption && !s.songTitle)).toBe(true);
    expect(stamps.some((s) => !s.storageKey && !s.caption && s.songTitle)).toBe(true);
    expect(new Set(stamps.map((s) => s.venueId)).size).toBeGreaterThan(8);
    for (const photo of await prisma.stampPhoto.findMany()) expect(mem.has(photo.storageKey)).toBe(true);
    expect(stamps.some((s) => s.removedAt !== null)).toBe(true);
  });

  it("never stores raw visit coordinates and mixes verified/unverified memories", async () => {
    await run();
    const stamps = await prisma.photo.findMany();
    expect(stamps.every((s) => s.lat === null && s.lng === null)).toBe(true);
    expect(stamps.some((s) => s.verifiedAt !== null)).toBe(true);
    expect(stamps.some((s) => s.verifiedAt === null && s.userId !== id("appreview"))).toBe(true);
    expect(stamps.filter((s) => s.userId === id("appreview")).every((s) => !s.countable && s.verifiedAt === null)).toBe(true);

    const reviewStamp = await prisma.photo.findFirstOrThrow({ where: { userId: id("appreview"), removedAt: null } });
    await expect(getStamp(prisma, await actor("maya_r"), reviewStamp.id)).rejects.toMatchObject({ status: 404 });
    await expect(getStamp(prisma, await actor("appreview"), reviewStamp.id)).resolves.toBeTruthy();
  });

  it("keeps dev-password login only for seeded development accounts", async () => {
    await run();
    vi.stubEnv("NODE_ENV", "development");
    try {
      for (const handle of ["avaa", "maya_r", "appreview"]) {
        await expect(devLogin(prisma, { email: `${handle}@lastcall.dev`, password: "seed password 123" })).resolves.toBeTruthy();
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("refuses to seed production", async () => {
    await expect(seed(prisma, { now: NOW, storage: getStorage(), env: { APP_ENV: "production" } })).rejects.toThrow(/Refusing to run the demo seed/);
  });
});
