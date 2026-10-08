import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { addStampPhotos, createStamp, getStamp, MAX_STAMP_PHOTOS, removeStamp, removeStampPhoto, setPhotoLayout } from "@/server/services/stamps";
import { deleteAccount } from "@/server/services/account";
import { getStorage } from "@/lib/storage";
import { installMemoryStorage } from "./mem-storage";
import { INSIDE, makeActor, makeStamp, makeVenue, pngBytes, seedEmailChallenge } from "./factories";

const mem = installMemoryStorage();
const many = (n: number) => Array.from({ length: n }, (_, i) => pngBytes(100 + i));
const stampWith = (actor: Awaited<ReturnType<typeof makeActor>>, venueId: string, n: number, extra: Record<string, unknown> = {}) =>
  createStamp(prisma, actor, venueId, { photos: many(n), meta: { caption: "", lat: String(INSIDE.lat), lng: String(INSIDE.lng), ...extra } });

describe("multi-photo stamps", () => {
  it("holds up to 6 photos in capture order and refuses a 7th", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const stamp = await stampWith(me, venue.id, 6);
    expect(stamp.photos.map((p) => p.position)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(stamp.photoUrl).toBe(stamp.photos[0]!.url);
    expect(MAX_STAMP_PHOTOS).toBe(6);
    await expect(stampWith(me, (await makeVenue()).id, 7)).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/up to 6 photos/) });
    await expect(addStampPhotos(prisma, me, stamp.id, many(1))).rejects.toMatchObject({ status: 400 });
    await expect(
      prisma.$transaction(async (tx) => {
        const parent = await tx.photo.create({ data: { userId: me.userId, venueId: venue.id, caption: "batch", ...INSIDE } });
        for (let i = 0; i < 7; i++) await tx.stampPhoto.create({ data: { stampId: parent.id, storageKey: `photos/limit${i}.png`, mimeType: "image/png", position: i % 6 } });
      }),
    ).rejects.toThrow(/at most 6 photos/);
    await expect(prisma.stampPhoto.create({ data: { stampId: stamp.id, storageKey: "photos/x8.png", mimeType: "image/png", position: 6 } })).rejects.toThrow();
  });

  it("refuses later additions and keeps original positions after a removal", async () => {
    const me = await makeActor();
    const stamp = await stampWith(me, (await makeVenue()).id, 3);
    const removed = await removeStampPhoto(prisma, me, stamp.id, stamp.photos[1]!.id);
    expect(removed.stamp.photos.map((p) => p.position)).toEqual([0, 2]);
    await expect(addStampPhotos(prisma, me, stamp.id, many(2))).rejects.toMatchObject({ status: 400 });
    expect((await getStamp(prisma, me, stamp.id)).stamp.photos.map((p) => p.position)).toEqual([0, 2]);
    expect(removed.stamp.editedAt).not.toBeNull();
  });

  it("strips EXIF and GPS from every photo", async () => {
    const me = await makeActor();
    const dirty = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#aa8844" } })
      .jpeg()
      .withExif({ IFD0: { Make: "LeakyPhone" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "40/1 43/1 36/1" } })
      .toBuffer();
    const stamp = await createStamp(prisma, me, (await makeVenue()).id, {
      photos: [dirty, dirty, dirty],
      meta: { caption: "", lat: String(INSIDE.lat), lng: String(INSIDE.lng) },
    });
    const rows = await prisma.stampPhoto.findMany({ where: { stampId: stamp.id } });
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      const bytes = (await getStorage().get(row.storageKey))!;
      expect((await sharp(bytes).metadata()).exif).toBeUndefined();
      expect(bytes.toString("latin1")).not.toContain("LeakyPhone");
    }
  });

  it("persists scrapbook layout and order for the owner without moving files", async () => {
    const me = await makeActor();
    const stamp = await stampWith(me, (await makeVenue()).id, 3);
    const [a, b, c] = stamp.photos;
    const out = await setPhotoLayout(prisma, me, stamp.id, {
      photos: [{ id: a!.id, x: 0.2, y: 0.3, rotation: 5 }, { id: b!.id, position: 2 }, { id: c!.id, position: 1 }],
    });
    expect(out.stamp.photos.map((p) => p.id)).toEqual([a!.id, c!.id, b!.id]);
    expect(out.stamp.photos[0]).toMatchObject({ x: 0.2, y: 0.3, rotation: 5 });
    expect(out.stamp.photos.map((p) => p.url.split("?")[0]).sort()).toEqual(stamp.photos.map((p) => p.url.split("?")[0]).sort());
    expect((await getStamp(prisma, me, stamp.id)).stamp.photos[0]).toMatchObject({ x: 0.2, y: 0.3, rotation: 5 });
    await expect(setPhotoLayout(prisma, me, stamp.id, { photos: [{ id: a!.id, position: 1 }] })).rejects.toMatchObject({ status: 400 });
    await expect(setPhotoLayout(prisma, me, stamp.id, { photos: [{ id: a!.id, x: 2 }] })).rejects.toThrow();
    await expect(setPhotoLayout(prisma, me, stamp.id, { photos: [{ id: "nope", x: 0.1 }] })).rejects.toMatchObject({ status: 400 });
    await expect(setPhotoLayout(prisma, await makeActor(), stamp.id, { photos: [{ id: a!.id, x: 0.9 }] })).rejects.toMatchObject({ status: 404 });
    await expect(prisma.stampPhoto.update({ where: { id: a!.id }, data: { storageKey: "photos/other.png" } })).rejects.toThrow(/immutable/);
  });

  it("photo removal is final and cannot leave a photo-only stamp empty", async () => {
    const me = await makeActor();
    const stamp = await stampWith(me, (await makeVenue()).id, 2);
    await removeStampPhoto(prisma, me, stamp.id, stamp.photos[0]!.id);
    await expect(removeStampPhoto(prisma, me, stamp.id, stamp.photos[0]!.id)).rejects.toMatchObject({ status: 404 });
    await expect(removeStampPhoto(prisma, me, stamp.id, stamp.photos[1]!.id)).rejects.toMatchObject({ status: 400 });
    expect(await prisma.stampPhoto.count({ where: { stampId: stamp.id } })).toBe(2);
    await expect(prisma.stampPhoto.delete({ where: { id: stamp.photos[1]!.id } })).rejects.toThrow();
    await expect(prisma.stampPhoto.update({ where: { id: stamp.photos[0]!.id }, data: { removedAt: null } })).rejects.toThrow(/stays removed/);

    const withCaption = await makeStamp(me, (await makeVenue()).id, { caption: "words" });
    await expect(removeStampPhoto(prisma, me, withCaption.id, withCaption.photos[0]!.id)).resolves.toBeTruthy();
  });

  it("photo operations and viewing are owner-only, and final stamp removal closes the stamp", async () => {
    const me = await makeActor();
    const stranger = await makeActor();
    const stamp = await stampWith(me, (await makeVenue()).id, 2);
    await expect(getStamp(prisma, stranger, stamp.id)).rejects.toMatchObject({ status: 404 });
    await expect(addStampPhotos(prisma, stranger, stamp.id, many(1))).rejects.toMatchObject({ status: 404 });
    await expect(removeStampPhoto(prisma, stranger, stamp.id, stamp.photos[0]!.id)).rejects.toMatchObject({ status: 404 });
    await removeStamp(prisma, me, stamp.id);
    await expect(getStamp(prisma, me, stamp.id)).rejects.toMatchObject({ status: 404 });
    await expect(setPhotoLayout(prisma, me, stamp.id, { photos: [{ id: stamp.photos[0]!.id, x: 0.5 }] })).rejects.toMatchObject({ status: 404 });
  });

  it("deleting the account deletes every photo file", async () => {
    const me = await makeActor();
    const stamp = await stampWith(me, (await makeVenue()).id, 3);
    const keys = (await prisma.stampPhoto.findMany({ where: { stampId: stamp.id } })).map((row) => row.storageKey);
    expect(keys.every((key) => mem.has(key))).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: me.userId } });
    await deleteAccount(prisma, me, await seedEmailChallenge(user.email, "DELETE_ACCOUNT"));
    expect(keys.every((key) => !mem.has(key))).toBe(true);
  });

  it("a failed stamp leaves no files behind", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    await stampWith(me, venue.id, 1);
    const before = mem.size;
    await expect(stampWith(me, venue.id, 3)).rejects.toMatchObject({ status: 429 });
    expect(mem.size).toBe(before);
  });
});
