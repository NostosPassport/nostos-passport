import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { PNG } from "pngjs";
import { submitReport } from "@/server/services/reports";
import { submitPhoto } from "@/server/services/photos";
import { addComment, editComment } from "@/server/services/comments";
import { getVenuePage, listVenuesForMap } from "@/server/services/venues";
import { sortVenues } from "@/lib/sort-venues";
import { POST as reportRoute } from "@/app/api/venues/[id]/reports/route";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeOwner, makeUser, makeVenue, INSIDE, OUTSIDE, VENUE_POS } from "./factories";

const MIN = 60_000;
const mem = installMemoryStorage();

function png(): Buffer {
  const p = new PNG({ width: 2, height: 2 });
  p.data.fill(200);
  return PNG.sync.write(p);
}

describe("invariant 3: out-of-geofence reports are rejected server-side", () => {
  it("rejects a report 1km away and accepts one 20m away", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    await expect(submitReport(prisma, me, venue.id, { type: "VIBE", vibe: "PACKED", ...OUTSIDE })).rejects.toMatchObject({ status: 403 });
    await expect(submitReport(prisma, me, venue.id, { type: "VIBE", vibe: "PACKED", ...INSIDE })).resolves.toMatchObject({ vibe: "PACKED" });
  });

  it("checks the boundary: 99m accepted, 101m rejected", async () => {
    const venue = await makeVenue();
    const [a, b] = [await makeActor(), await makeActor()];
    const m = 1 / 111_195; // degrees latitude per meter
    await expect(submitReport(prisma, a, venue.id, { type: "LINE", line: "NONE", lat: VENUE_POS.lat + 99 * m, lng: VENUE_POS.lng })).resolves.toBeTruthy();
    await expect(submitReport(prisma, b, venue.id, { type: "LINE", line: "NONE", lat: VENUE_POS.lat + 101 * m, lng: VENUE_POS.lng })).rejects.toMatchObject({ status: 403 });
  });

  it("rejects out-of-geofence photos and invalid coordinates", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    await expect(submitPhoto(prisma, me, venue.id, { bytes: png(), meta: { caption: "x", ...OUTSIDE } })).rejects.toMatchObject({ status: 403 });
    await expect(submitReport(prisma, me, venue.id, { type: "VIBE", vibe: "DEAD", lat: 999, lng: 0 })).rejects.toMatchObject({ status: 400 });
  });

  it("enforces it at the HTTP route too", async () => {
    const venue = await makeVenue();
    const u = await makeUser();
    const { token } = await createSession(prisma, u.id);
    const res = await reportRoute(
      new Request(`http://localhost/api/venues/${venue.id}/reports`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
        body: JSON.stringify({ type: "VIBE", vibe: "PACKED", ...OUTSIDE }),
      }),
      { params: Promise.resolve({ id: venue.id }) },
    );
    expect(res.status).toBe(403);
    expect(await prisma.report.count()).toBe(0);
  });
});

describe("rate limit: one report of each type per user per venue per 15 minutes", () => {
  it("blocks a second vibe within 15 min, allows other types and after 15 min", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const t0 = new Date();
    await submitReport(prisma, me, venue.id, { type: "VIBE", vibe: "BUSY", ...INSIDE }, t0);
    await expect(submitReport(prisma, me, venue.id, { type: "VIBE", vibe: "PACKED", ...INSIDE }, new Date(t0.getTime() + 14 * MIN))).rejects.toMatchObject({ status: 429 });
    await submitReport(prisma, me, venue.id, { type: "COVER", cover: "20", ...INSIDE }, new Date(t0.getTime() + MIN));
    await submitReport(prisma, me, venue.id, { type: "VIBE", vibe: "PACKED", ...INSIDE }, new Date(t0.getTime() + 15 * MIN + 1));
  });

  it("cannot be raced with concurrent submissions", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => submitReport(prisma, me, venue.id, { type: "LINE", line: "NONE", ...INSIDE })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.report.count()).toBe(1);
  });

  it("stores cover in integer cents", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const r = await submitReport(prisma, me, venue.id, { type: "COVER", cover: "12.50", ...INSIDE });
    expect(r.coverCents).toBe(1250);
    await expect(submitReport(prisma, await makeActor(), venue.id, { type: "COVER", cover: "-3", ...INSIDE })).rejects.toMatchObject({ status: 400 });
  });
});

describe("invariant 6: photos older than 3 hours never appear in the live feed", () => {
  it("splits live vs earlier at exactly 3 hours", async () => {
    const venue = await makeVenue();
    const u = await makeUser();
    const now = new Date();
    const mk = (minAgo: number, caption: string) =>
      prisma.photo.create({ data: { userId: u.id, venueId: venue.id, storageKey: `photos/${caption}.png`, mimeType: "image/png", caption, ...INSIDE, createdAt: new Date(now.getTime() - minAgo * MIN) } });
    await mk(5, "fresh");
    await mk(179, "almost");
    await mk(180, "exactly3h");
    await mk(400, "old");
    const page = await getVenuePage(prisma, venue.slug, null, now);
    expect(page.live.livePhotos.map((p) => p.caption).sort()).toEqual(["almost", "fresh"]);
    expect(page.live.earlierPhotos.map((p) => p.caption).sort()).toEqual(["exactly3h", "old"]);
  });

  it("a photo ages out of the live feed as time passes", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const t0 = new Date();
    await submitPhoto(prisma, me, venue.id, { bytes: png(), meta: { caption: "now", ...INSIDE } }, t0);
    expect((await getVenuePage(prisma, venue.slug, null, new Date(t0.getTime() + 179 * MIN))).live.livePhotos).toHaveLength(1);
    expect((await getVenuePage(prisma, venue.slug, null, new Date(t0.getTime() + 180 * MIN))).live.livePhotos).toHaveLength(0);
  });

  it("hidden photos are in neither feed", async () => {
    const venue = await makeVenue();
    const u = await makeUser();
    await prisma.photo.create({ data: { userId: u.id, venueId: venue.id, storageKey: "photos/h.png", mimeType: "image/png", caption: "h", ...INSIDE, hiddenAt: new Date() } });
    const page = await getVenuePage(prisma, venue.slug, null);
    expect(page.live.livePhotos).toHaveLength(0);
    expect(page.live.earlierPhotos).toHaveLength(0);
  });
});

describe("upload validation", () => {
  it("rejects non-images by content, regardless of declared type", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    await expect(submitPhoto(prisma, me, venue.id, { bytes: Buffer.from("<svg onload=alert(1)>"), meta: { caption: "", ...INSIDE } })).rejects.toMatchObject({ status: 415 });
  });
  it("rejects files over 5 MB", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const big = Buffer.concat([png(), Buffer.alloc(5 * 1024 * 1024)]);
    await expect(submitPhoto(prisma, me, venue.id, { bytes: big, meta: { caption: "", ...INSIDE } })).rejects.toMatchObject({ status: 413 });
  });
  it("stores a valid PNG under a server-generated key", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const p = await submitPhoto(prisma, me, venue.id, { bytes: png(), meta: { caption: "dance floor", ...INSIDE } });
    expect(p.storageKey).toMatch(/^photos\/[a-f0-9]{32}\.png$/);
    expect(mem.has(p.storageKey)).toBe(true);
  });
});

describe("invariant 1 (reporting surface): venue owners can't write or edit user reality", () => {
  it("owner cannot post reports, photos or top-level comments for their own venue", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    await expect(submitReport(prisma, owner, venue.id, { type: "VIBE", vibe: "PACKED", ...INSIDE })).rejects.toMatchObject({ status: 403 });
    await expect(submitPhoto(prisma, owner, venue.id, { bytes: png(), meta: { caption: "", ...INSIDE } })).rejects.toMatchObject({ status: 403 });
    await expect(addComment(prisma, owner, venue.id, { body: "best bar ever" })).rejects.toMatchObject({ status: 403 });
  });

  it("owner gets 403 editing a user's comment at their venue; the author can edit", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    const author = await makeActor();
    const c = await addComment(prisma, author, venue.id, { body: "cover was $20" });
    await expect(editComment(prisma, owner, c.id, { body: "cover was $10" })).rejects.toMatchObject({ status: 403 });
    await expect(editComment(prisma, await makeActor({ role: "MODERATOR" }), c.id, { body: "x" })).rejects.toMatchObject({ status: 403 });
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: c.id } })).body).toBe("cover was $20");
    await expect(editComment(prisma, author, c.id, { body: "cover was $25" })).resolves.toMatchObject({ body: "cover was $25" });
  });
});

describe("invariant 2: paid promotions never change order, visibility or weight of user content", () => {
  it("venue page user content and consensus are identical with and without a paid promo", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    const now = new Date();
    for (const [i, vibe] of (["DEAD", "DEAD", "PACKED"] as const).entries()) {
      const u = await makeUser();
      await prisma.report.create({ data: { userId: u.id, venueId: venue.id, type: "VIBE", vibe, ...INSIDE, createdAt: new Date(now.getTime() - (i + 1) * MIN) } });
      await prisma.comment.create({ data: { userId: u.id, venueId: venue.id, body: `c${i}`, createdAt: new Date(now.getTime() - (i + 1) * MIN) } });
      await prisma.photo.create({ data: { userId: u.id, venueId: venue.id, storageKey: `photos/p${i}.png`, mimeType: "image/png", caption: `p${i}`, ...INSIDE, createdAt: new Date(now.getTime() - (i + 1) * MIN) } });
    }
    const strip = (p: Awaited<ReturnType<typeof getVenuePage>>) => ({ live: p.live, accuracy: p.official.accuracy });
    const before = strip(await getVenuePage(prisma, venue.slug, null, now));
    await prisma.promo.create({
      data: { venueId: venue.id, title: "2-for-1", body: "!!!", isPaid: true, createdById: owner.userId, startsAt: new Date(now.getTime() - 60 * MIN), endsAt: new Date(now.getTime() + 60 * MIN) },
    });
    const afterPage = await getVenuePage(prisma, venue.slug, null, now);
    expect(strip(afterPage)).toEqual(before);
    expect(afterPage.official.promos[0]).toMatchObject({ isPaid: true });
  });

  it("map list order and activity scores ignore promos", async () => {
    const quiet = await makeVenue({ slug: "quiet" });
    const busy = await makeVenue({ slug: "busy", lat: VENUE_POS.lat + 0.01 });
    const owner = await makeOwner(quiet.id);
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const u = await makeUser();
      await prisma.report.create({ data: { userId: u.id, venueId: busy.id, type: "VIBE", vibe: "PACKED", lat: busy.lat, lng: busy.lng, createdAt: new Date(now.getTime() - MIN) } });
    }
    const order = async () => sortVenues(await listVenuesForMap(prisma, null, now), "activity").map((v) => [v.slug, v.activity, v.vibe]);
    const before = await order();
    await prisma.promo.create({
      data: { venueId: quiet.id, title: "Promo", body: "b", isPaid: true, createdById: owner.userId, startsAt: new Date(now.getTime() - MIN), endsAt: new Date(now.getTime() + 60 * MIN) },
    });
    expect(await order()).toEqual(before);
    expect(before[0]![0]).toBe("busy");
    expect((await listVenuesForMap(prisma, null, now)).find((v) => v.slug === "quiet")!.promoted).toBe(true);
  });
});
