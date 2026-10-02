import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { addStampPhotos, createStamp, getStamp, MAX_STAMP_PHOTOS, removeStampPhoto, setPhotoLayout } from "@/server/services/stamps";
import { deleteAccount } from "@/server/services/account";
import { hashPassword } from "@/lib/auth/password";
import { getStorage } from "@/lib/storage";
import { installMemoryStorage } from "./mem-storage";
import { INSIDE, makeActor, makeStamp, makeVenue, pngBytes } from "./factories";

const mem = installMemoryStorage();
const many = (n: number) => Array.from({ length: n }, (_, i) => pngBytes(100 + i));
const stampWith = (actor: Awaited<ReturnType<typeof makeActor>>, venueId: string, n: number, extra: Record<string, unknown> = {}) =>
  createStamp(prisma, actor, venueId, { photos: many(n), meta: { caption: "", lat: String(INSIDE.lat), lng: String(INSIDE.lng), ...extra } });

describe("multi-photo stamps", () => {
  it("holds up to 6 photos in the order they were taken, and refuses a 7th", async () => {
    const v = await makeVenue();
    const me = await makeActor();
    const s = await stampWith(me, v.id, 6);
    expect(s.photos.map((p) => p.position)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(s.photoUrl).toBe(s.photos[0]!.url);
    expect(MAX_STAMP_PHOTOS).toBe(6);
    await expect(stampWith(me, (await makeVenue()).id, 7)).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/up to 6 photos/) });
    await expect(addStampPhotos(prisma, me, s.id, many(1))).rejects.toMatchObject({ status: 400 });
    // The database refuses too, whatever the service says.
    await expect(prisma.stampPhoto.create({ data: { stampId: s.id, storageKey: "photos/x7.png", mimeType: "image/png", position: 5 } })).rejects.toThrow(/at most 6 photos/);
    await expect(prisma.stampPhoto.create({ data: { stampId: s.id, storageKey: "photos/x8.png", mimeType: "image/png", position: 6 } })).rejects.toThrow();
  });

  it("adds photos into the next free positions and keeps the order after a removal", async () => {
    const v = await makeVenue();
    const me = await makeActor();
    const s = await stampWith(me, v.id, 3);
    const removed = await removeStampPhoto(prisma, me, s.id, s.photos[1]!.id);
    expect(removed.stamp.photos.map((p) => p.position)).toEqual([0, 2]);
    const added = await addStampPhotos(prisma, me, s.id, many(2));
    expect(added.stamp.photos.map((p) => p.position)).toEqual([0, 1, 2, 3]);
    expect(added.stamp.editedAt).not.toBeNull();
  });

  it("strips EXIF and GPS from every photo", async () => {
    const v = await makeVenue();
    const me = await makeActor();
    const dirty = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#aa8844" } }).jpeg().withExif({ IFD0: { Make: "LeakyPhone" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "40/1 43/1 36/1" } }).toBuffer();
    const s = await createStamp(prisma, me, v.id, { photos: [dirty, dirty], meta: { caption: "", lat: String(INSIDE.lat), lng: String(INSIDE.lng) } });
    await addStampPhotos(prisma, me, s.id, [dirty]);
    const rows = await prisma.stampPhoto.findMany({ where: { stampId: s.id } });
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      const bytes = (await getStorage().get(r.storageKey))!;
      expect((await sharp(bytes).metadata()).exif).toBeUndefined();
      expect(bytes.toString("latin1")).not.toContain("LeakyPhone");
    }
  });

  it("persists the scrapbook layout and the order, owner only, and never moves the files", async () => {
    const v = await makeVenue();
    const me = await makeActor();
    const s = await stampWith(me, v.id, 3);
    const [a, b, c] = s.photos;
    const out = await setPhotoLayout(prisma, me, s.id, { photos: [{ id: a!.id, x: 0.2, y: 0.3, rotation: 5 }, { id: b!.id, position: 2 }, { id: c!.id, position: 1 }] });
    expect(out.stamp.photos.map((p) => p.id)).toEqual([a!.id, c!.id, b!.id]);
    expect(out.stamp.photos[0]).toMatchObject({ x: 0.2, y: 0.3, rotation: 5 });
    expect(out.stamp.photos.map((p) => p.url.split("?")[0]).sort()).toEqual(s.photos.map((p) => p.url.split("?")[0]).sort());
    // Reloading shows the same layout.
    expect((await getStamp(prisma, me, s.id)).stamp.photos[0]).toMatchObject({ x: 0.2, y: 0.3, rotation: 5 });
    await expect(setPhotoLayout(prisma, me, s.id, { photos: [{ id: a!.id, position: 1 }] })).rejects.toMatchObject({ status: 400 }); // clashes with c
    await expect(setPhotoLayout(prisma, me, s.id, { photos: [{ id: a!.id, x: 2 }] })).rejects.toThrow();
    await expect(setPhotoLayout(prisma, me, s.id, { photos: [{ id: a!.id, rotation: 90 }] })).rejects.toThrow();
    await expect(setPhotoLayout(prisma, me, s.id, { photos: [{ id: "nope", x: 0.1 }] })).rejects.toMatchObject({ status: 400 });
    const other = await makeActor({ isPrivate: false });
    await expect(setPhotoLayout(prisma, other, s.id, { photos: [{ id: a!.id, x: 0.9 }] })).rejects.toMatchObject({ status: 404 });
    await expect(prisma.stampPhoto.update({ where: { id: a!.id }, data: { storageKey: "photos/other.png" } })).rejects.toThrow(/immutable/);
  });

  it("is hidden, never deleted: removal is final, rows can't be deleted, and the last photo of a photo-only stamp stays", async () => {
    const v = await makeVenue();
    const me = await makeActor();
    const s = await stampWith(me, v.id, 2);
    await removeStampPhoto(prisma, me, s.id, s.photos[0]!.id);
    await expect(removeStampPhoto(prisma, me, s.id, s.photos[0]!.id)).rejects.toMatchObject({ status: 404 });
    await expect(removeStampPhoto(prisma, me, s.id, s.photos[1]!.id)).rejects.toMatchObject({ status: 400 });
    expect(await prisma.stampPhoto.count({ where: { stampId: s.id } })).toBe(2);
    await expect(prisma.stampPhoto.delete({ where: { id: s.photos[1]!.id } })).rejects.toThrow(/hide user content/);
    await expect(prisma.stampPhoto.update({ where: { id: s.photos[0]!.id }, data: { removedAt: null } })).rejects.toThrow(/stays removed/);
    // With a caption the last photo can go.
    const t = await makeStamp(me, (await makeVenue()).id, { caption: "words" });
    await expect(removeStampPhoto(prisma, me, t.id, t.photos[0]!.id)).resolves.toBeTruthy();
  });

  it("only the owner edits photos; hidden stamps freeze; photos follow the stamp's visibility", async () => {
    const v = await makeVenue();
    const me = await makeActor({ isPrivate: false });
    const stranger = await makeActor();
    const s = await stampWith(me, v.id, 2);
    await expect(addStampPhotos(prisma, stranger, s.id, many(1))).rejects.toMatchObject({ status: 404 });
    await expect(removeStampPhoto(prisma, stranger, s.id, s.photos[0]!.id)).rejects.toMatchObject({ status: 404 });
    expect((await getStamp(prisma, stranger, s.id)).stamp.photos).toHaveLength(2);
    await prisma.photo.update({ where: { id: s.id }, data: { hiddenAt: new Date() } });
    await expect(getStamp(prisma, stranger, s.id)).rejects.toMatchObject({ status: 404 });
    await expect(addStampPhotos(prisma, me, s.id, many(1))).rejects.toMatchObject({ status: 409 });
    const priv = await makeActor();
    const p = await stampWith(priv, (await makeVenue()).id, 2);
    await expect(getStamp(prisma, stranger, p.id)).rejects.toMatchObject({ status: 404 });
  });

  it("deleting the account deletes every photo file", async () => {
    const v = await makeVenue();
    const me = await makeActor();
    await prisma.user.update({ where: { id: me.userId }, data: { passwordHash: await hashPassword("pw pw pw pw") } });
    const s = await stampWith(me, v.id, 3);
    const keys = (await prisma.stampPhoto.findMany({ where: { stampId: s.id } })).map((r) => r.storageKey);
    expect(keys.every((k) => mem.has(k))).toBe(true);
    await deleteAccount(prisma, me, { password: "pw pw pw pw" });
    expect(keys.some((k) => mem.has(k))).toBe(false);
  });

  it("a failed stamp leaves no files behind", async () => {
    const v = await makeVenue();
    const me = await makeActor();
    await stampWith(me, v.id, 1);
    const before = mem.size;
    await expect(stampWith(me, v.id, 3)).rejects.toMatchObject({ status: 429 });
    expect(mem.size).toBe(before);
  });
});
