import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { processImage } from "@/server/services/image";
import { createStamp, getStamp, listUserPlaces, listUserStamps, removeStamp } from "@/server/services/stamps";
import { createCollection } from "@/server/services/collections";
import { enableCollectionShare, resolveCollectionShare } from "@/server/services/collection-sharing";
import { startSignup, UNDERAGE_MESSAGE } from "@/server/services/auth";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeStamp, makeVenue, INSIDE, OUTSIDE } from "./factories";

installMemoryStorage();
process.env.SHARE_TOKEN_SECRET = "invariants-collection-share-secret-1234567890";
const wire = (x: unknown) => JSON.parse(JSON.stringify(x)) as unknown;

describe("invariants", () => {
  it("rule 1: location verification is server-enforced while outside stamps remain unverified", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const outside = await makeStamp(me, venue.id, { at: OUTSIDE });
    expect(outside.verified).toBe(false);
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: outside.id } })).countable).toBe(true);

    const inside = await makeStamp(me, venue.id, { at: INSIDE });
    expect(inside.verified).toBe(true);

    const reviewer = await makeActor({ geofenceExempt: true });
    const stamp = await makeStamp(reviewer, venue.id, { at: OUTSIDE });
    expect(stamp.verified).toBe(false);
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: stamp.id } })).countable).toBe(false);
  });

  it("rule 2: another account never receives someone else's passport or stamp data", async () => {
    const venue = await makeVenue();
    const owner = await makeActor({ handle: "inv_owner" });
    const other = await makeActor({ handle: "inv_other" });
    const stamp = await makeStamp(owner, venue.id);

    await expect(getStamp(prisma, owner, stamp.id)).resolves.toBeTruthy();
    await expect(listUserStamps(prisma, owner, owner.handle)).resolves.toBeTruthy();
    await expect(listUserPlaces(prisma, owner, owner.handle)).resolves.toBeTruthy();

    await expect(getStamp(prisma, other, stamp.id)).rejects.toMatchObject({ status: 404 });
    await expect(listUserStamps(prisma, other, owner.handle)).rejects.toMatchObject({ status: 404 });
    await expect(listUserPlaces(prisma, other, owner.handle)).rejects.toMatchObject({ status: 404 });
  });

  it("rule 3: removed stamps are retained as removed records and can never be restored or hard-deleted", async () => {
    const venue = await makeVenue();
    const owner = await makeActor();
    const stamp = await makeStamp(owner, venue.id);

    await removeStamp(prisma, owner, stamp.id);
    expect(await prisma.photo.findUnique({ where: { id: stamp.id } })).toMatchObject({ removedAt: expect.any(Date) });
    await expect(getStamp(prisma, owner, stamp.id)).rejects.toMatchObject({ status: 404 });
    await expect(prisma.photo.update({ where: { id: stamp.id }, data: { removedAt: null } })).rejects.toThrow(/stays removed/);
    await expect(prisma.photo.delete({ where: { id: stamp.id } })).rejects.toThrow();
  });

  it("rule 4: uploaded images are re-encoded so EXIF and GPS never survive", async () => {
    const jpeg = await sharp({ create: { width: 200, height: 100, channels: 3, background: "#ff3d6e" } })
      .jpeg()
      .withExif({ IFD0: { Make: "LeakyPhone" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "40/1 43/1 36/1" } })
      .toBuffer();
    expect((await sharp(jpeg).metadata()).exif).toBeTruthy();

    const { bytes } = await processImage(jpeg);
    expect((await sharp(bytes).metadata()).exif).toBeUndefined();
    expect(bytes.toString("latin1")).not.toContain("LeakyPhone");

    const venue = await makeVenue();
    const owner = await makeActor();
    const stamp = await createStamp(prisma, owner, venue.id, { bytes: jpeg, meta: { caption: "", lat: String(INSIDE.lat), lng: String(INSIDE.lng) } });
    const row = await prisma.photo.findUniqueOrThrow({ where: { id: stamp.id } });
    const stored = await (await import("@/lib/storage")).getStorage().get(row.storageKey!);
    expect(stored).not.toBeNull();
    expect((await sharp(stored!).metadata()).exif).toBeUndefined();
  });

  it("rule 5: stamp payloads expose no raw storage keys, internal user ids, or visit coordinates", async () => {
    const venue = await makeVenue();
    const owner = await makeActor();
    const at = { lat: INSIDE.lat + 0.00011, lng: INSIDE.lng + 0.00009 };
    const stamp = await makeStamp(owner, venue.id, { at });

    const detail = wire(await getStamp(prisma, owner, stamp.id));
    const passport = wire(await listUserStamps(prisma, owner, owner.handle));
    const places = wire(await listUserPlaces(prisma, owner, owner.handle));
    const stampJson = JSON.stringify([detail, passport]);
    const allJson = JSON.stringify([detail, passport, places]);

    expect(allJson).not.toMatch(/"(storageKey|storage_key|userId|user_id)"/);
    expect(allJson).not.toContain(owner.userId);
    expect(stampJson).not.toMatch(/"(lat|lng)"/);
    expect(stampJson).not.toContain(String(at.lat));
    expect(stampJson).not.toContain(String(at.lng));
  });

  it("rule 6: under-age signup is rejected before anything is stored and birthdates are never persisted", async () => {
    const now = new Date("2026-10-02T16:00:00Z");
    const email = "underage-invariant@example.com";
    const beforeUsers = await prisma.user.count();
    const beforeChallenges = await prisma.emailChallenge.count();

    await expect(
      startSignup(
        prisma,
        { email, displayName: "Twelve", handle: "twelve_invariant", acceptTerms: true, birthdate: "2013-10-03" },
        { ip: "127.0.0.1", now },
      ),
    ).rejects.toMatchObject({ status: 403, code: "underage", message: UNDERAGE_MESSAGE });

    expect(await prisma.user.count()).toBe(beforeUsers);
    expect(await prisma.emailChallenge.count()).toBe(beforeChallenges);
    const cols = await prisma.$queryRaw<{ column_name: string }[]>`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'`;
    expect(cols.map((c) => c.column_name).filter((c) => /birth|dob/i.test(c))).toEqual([]);
  });

  it("rule 7: backend and mobile contract copies stay byte-for-byte synchronized", () => {
    const backend = readFileSync(path.resolve(process.cwd(), "src/contracts/api.ts"), "utf8");
    const mobile = readFileSync(path.resolve(process.cwd(), "../mobile/src/api/contracts.ts"), "utf8");
    const mobileBody = mobile.replace(/^\/\*\*\n \* COPIED VERBATIM[\s\S]*?\*\/\n/, "");
    expect(mobileBody).toBe(backend);
  });

  it("rule 8: collection sharing can expose only an explicit collection and never the master Passport", async () => {
    const owner = await makeActor();
    const sharedStamp = await makeStamp(owner, (await makeVenue()).id, { caption: "shared" });
    const masterOnlyStamp = await makeStamp(owner, (await makeVenue()).id, { caption: "master only" });
    const created = await createCollection(prisma, owner, { name: "Shared", color: "blue", stampIds: [sharedStamp.id] });
    const result = await enableCollectionShare(prisma, owner, created.collection.id);
    expect(result.share.enabled).toBe(true);
    if (!result.share.enabled) throw new Error("Expected collection sharing to be enabled");

    const token = decodeURIComponent(new URL(result.share.url).pathname.split("/").filter(Boolean).at(-1)!);
    const publicView = wire(await resolveCollectionShare(prisma, token));
    const json = JSON.stringify(publicView);
    expect(json).toContain(sharedStamp.id);
    expect(json).not.toContain(masterOnlyStamp.id);
    expect(json).not.toContain(owner.userId);
  });
});
