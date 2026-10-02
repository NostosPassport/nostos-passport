import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { getVenuePage } from "@/server/services/venues";
import { ownerVenueDashboard, setOfficialPhoto } from "@/server/services/owner";
import { submitPhoto, processImage, MAX_IMAGE_DIMENSION } from "@/server/services/photos";
import { addComment, editComment, replyAsVenue } from "@/server/services/comments";
import { flagContent } from "@/server/services/moderation";
import { getProfile } from "@/server/services/people";
import { GET as venuesRoute } from "@/app/api/venues/route";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeOwner, makeUser, makeVenue, INSIDE } from "./factories";

const mem = installMemoryStorage();

/** Every key path in a JSON-serialized payload (what actually crosses the wire). */
function keyPaths(value: unknown, path = "$", out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => keyPaths(v, `${path}[]`, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.push(`${path}.${k}`);
      keyPaths(v, `${path}.${k}`, out);
    }
  }
  return out;
}
const wire = (x: unknown) => JSON.parse(JSON.stringify(x)) as unknown;

async function jpegWithGps() {
  return sharp({ create: { width: 3000, height: 1000, channels: 3, background: "#ff3d6e" } })
    .jpeg()
    .withExif({ IFD0: { Make: "LeakyPhone", Model: "X1" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "40/1 43/1 36/1" } })
    .toBuffer();
}

async function populatedVenue() {
  const venue = await makeVenue();
  const author = await makeUser();
  await prisma.photo.create({ data: { userId: author.id, venueId: venue.id, storageKey: "photos/live.png", mimeType: "image/png", caption: "live", ...INSIDE } });
  await prisma.photo.create({
    data: { userId: author.id, venueId: venue.id, storageKey: "photos/old.png", mimeType: "image/png", caption: "old", ...INSIDE, createdAt: new Date(Date.now() - 5 * 3600_000) },
  });
  const c = await addComment(prisma, { userId: author.id, role: "USER", handle: author.handle, displayName: author.handle, ownedVenueIds: [], geofenceExempt: false }, venue.id, { body: "busy!" });
  const owner = await makeOwner(venue.id);
  await replyAsVenue(prisma, owner, c.id, { body: "thanks" });
  await prisma.report.create({ data: { userId: author.id, venueId: venue.id, type: "VIBE", vibe: "BUSY", ...INSIDE } });
  return { venue, author, owner };
}

describe("venue page payload leaks no user-content coordinates, storage keys or user ids", () => {
  it("only the venue's own coordinates appear; photos expose a URL, people expose a handle", async () => {
    const { venue, author } = await populatedVenue();
    const viewer = await makeActor();
    const page = wire(await getVenuePage(prisma, venue.slug, viewer));
    const paths = keyPaths(page);
    expect(paths.filter((p) => /\.(lat|lng)$/.test(p))).toEqual(["$.official.lat", "$.official.lng"]);
    expect(paths.filter((p) => /(storageKey|userId|user\.id|\.user$|createdById|changedById)/.test(p))).toEqual([]);
    const json = JSON.stringify(page);
    expect(json).not.toContain(author.id);
    expect(json).not.toContain(INSIDE.lat.toString());
    const p = (page as { live: { livePhotos: { url: string }[]; earlierPhotos: { url: string }[] } }).live;
    expect(p.livePhotos[0]!.url).toMatch(/^\/api\/uploads\/photos\/live\.png\?exp=\d{10}&sig=[\w-]+$/);
    expect(p.earlierPhotos[0]!.url).toMatch(/^\/api\/uploads\/photos\/old\.png\?exp=/);
  });

  it("the /api/venues response carries only whitelisted venue fields", async () => {
    await populatedVenue();
    const res = await venuesRoute(new Request("http://localhost/api/venues"), undefined as never);
    const body = (await res.json()) as { venues: Record<string, unknown>[] };
    const allowed = ["id", "slug", "name", "address", "neighborhood", "lat", "lng", "vibe", "vibeReports", "hereNow", "goingTonight", "friendsGoing", "activity", "promoted", "fromOsm"];
    for (const v of body.venues) expect(Object.keys(v).sort()).toEqual([...allowed].sort());
    expect(keyPaths(body).filter((p) => /\.(lat|lng)$/.test(p)).every((p) => /^\$\.venues\[\]\.(lat|lng)$/.test(p))).toBe(true);
  });
});

describe("owner dashboard is anonymous about reporters", () => {
  it("recent reports carry id, type, value and age only; no reporter handles or user ids anywhere", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    const reporters = [await makeUser(), await makeUser()];
    for (const r of reporters) await prisma.report.create({ data: { userId: r.id, venueId: venue.id, type: "COVER", coverCents: 2000, ...INSIDE } });
    const dash = wire(await ownerVenueDashboard(prisma, owner, venue.id)) as { recentReports: Record<string, unknown>[] };
    expect(dash.recentReports).toHaveLength(2);
    for (const r of dash.recentReports) expect(Object.keys(r).sort()).toEqual(["coverCents", "createdAt", "id", "line", "type", "vibe"]);
    const json = JSON.stringify(dash);
    for (const r of reporters) {
      expect(json).not.toContain(r.id);
      expect(json).not.toContain(r.handle);
    }
    expect(keyPaths(dash).filter((p) => /(userId|createdById|changedById|storageKey|\.user$)/.test(p))).toEqual([]);
  });
});

describe("auto-hide eligibility", () => {
  it("only USER accounts >= 7 days old with reputation >= 0.5 count", async () => {
    const venue = await makeVenue();
    const author = await makeUser();
    const photo = await prisma.photo.create({ data: { userId: author.id, venueId: venue.id, storageKey: "photos/x.png", mimeType: "image/png", caption: "", ...INSIDE } });
    const flag = async (a: Awaited<ReturnType<typeof makeActor>>) => (await flagContent(prisma, a, { targetType: "PHOTO", targetId: photo.id, reason: "fake" })).autoHidden;
    expect(await flag(await makeActor({ ageDays: 2 }))).toBe(false); // too new
    expect(await flag(await makeActor({ ageDays: 60, reputation: 0.3 }))).toBe(false); // low reputation
    expect(await flag(await makeActor({ ageDays: 8, reputation: 0.5 }))).toBe(false); // 1 eligible
    expect(await flag(await makeActor({ ageDays: 400, reputation: 1.2 }))).toBe(false); // 2 eligible
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: photo.id } })).hiddenAt).toBeNull();
    expect(await flag(await makeActor({ ageDays: 30, reputation: 0.9 }))).toBe(true); // 3 eligible
  });
});

describe("comment edits freeze once others have acted", () => {
  it("409 after a venue reply", async () => {
    const venue = await makeVenue();
    const author = await makeActor();
    const c = await addComment(prisma, author, venue.id, { body: "cover $20" });
    await replyAsVenue(prisma, await makeOwner(venue.id), c.id, { body: "it's $10" });
    await expect(editComment(prisma, author, c.id, { body: "cover $10" })).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/replied/) });
  });

  it("409 while a flag is open; editable again after review", async () => {
    const venue = await makeVenue();
    const author = await makeActor();
    const c = await addComment(prisma, author, venue.id, { body: "meh" });
    await flagContent(prisma, await makeActor(), { targetType: "COMMENT", targetId: c.id, reason: "rude!" });
    await expect(editComment(prisma, author, c.id, { body: "nice" })).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/review/) });
    await prisma.flag.updateMany({ where: { targetId: c.id }, data: { status: "RESOLVED" } });
    await expect(editComment(prisma, author, c.id, { body: "nice" })).resolves.toMatchObject({ body: "nice" });
  });
});

describe("reputation is private", () => {
  it("visible to self and moderators only", async () => {
    const u = await makeActor({ reputation: 0.8, isPrivate: false });
    const rep = async (viewer: Parameters<typeof getProfile>[2]) => {
      const p = await getProfile(prisma, u.handle, viewer);
      return p.access === "full" ? p.user.reputation : "limited";
    };
    expect(await rep(u)).toBe(0.8);
    expect(await rep(await makeActor({ role: "MODERATOR" }))).toBe(0.8);
    expect(await rep(await makeActor())).toBeNull();
    expect(await rep(null)).toBeNull();
  });
});

describe("uploads are re-encoded without metadata", () => {
  it("processImage strips EXIF/GPS and caps dimensions at 2048px", async () => {
    const input = await jpegWithGps();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const { bytes, kind } = await processImage(input);
    const meta = await sharp(bytes).metadata();
    expect(kind.ext).toBe("jpg");
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(meta.width).toBe(MAX_IMAGE_DIMENSION);
    expect(meta.height).toBe(Math.round((1000 * MAX_IMAGE_DIMENSION) / 3000));
    expect(bytes.includes(Buffer.from("LeakyPhone"))).toBe(false);
  });

  it("stored user photos and official photos have no EXIF", async () => {
    const venue = await makeVenue();
    const photo = await submitPhoto(prisma, await makeActor(), venue.id, { bytes: await jpegWithGps(), meta: { caption: "", ...INSIDE } });
    expect((await sharp(mem.get(photo.storageKey)!).metadata()).exif).toBeUndefined();
    const v = await setOfficialPhoto(prisma, await makeOwner(venue.id), venue.id, await jpegWithGps());
    expect((await sharp(mem.get(v.officialPhotoKey!)!).metadata()).exif).toBeUndefined();
  });

  it("rejects bytes that sniff as an image but don't decode", async () => {
    const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("not really a jpeg")]);
    await expect(processImage(fake)).rejects.toMatchObject({ status: 415 });
  });
});

describe("comment burst limit under concurrency", () => {
  it("parallel posts can't exceed 5 per user per venue per 10 minutes", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => addComment(prisma, me, venue.id, { body: `c${i}` })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    expect(await prisma.comment.count({ where: { userId: me.userId } })).toBe(5);
  });
});
