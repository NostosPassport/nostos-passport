import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { addStampPhotos, removeStampPhoto, setPhotoLayout } from "@/server/services/stamps";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeStamp, makeVenue, pngBytes } from "./factories";

const mem = installMemoryStorage();

describe("editable stamp photos", () => {
  it("lets the owner append photos after creation, processes them, and enforces the six-photo cap", async () => {
    const me = await makeActor();
    const s = await makeStamp(me, (await makeVenue()).id);
    const before = mem.size;
    const appended = await addStampPhotos(prisma, me, s.id, [pngBytes(), pngBytes(90)]);
    expect(appended.stamp.photos).toHaveLength(3);
    expect(mem.size).toBe(before + 2);

    await expect(addStampPhotos(prisma, me, s.id, [Buffer.from("invalid photo")])).rejects.toMatchObject({ status: 415 });
    await expect(addStampPhotos(prisma, me, s.id, [pngBytes(), pngBytes(), pngBytes(), pngBytes()])).rejects.toMatchObject({ status: 400 });
    expect((await addStampPhotos(prisma, me, s.id, [pngBytes(), pngBytes(), pngBytes()])).stamp.photos).toHaveLength(6);
  });

  it("later append is owner-only and creation metadata remains immutable", async () => {
    const me = await makeActor();
    const other = await makeActor();
    const s = await makeStamp(me, (await makeVenue()).id);
    await expect(addStampPhotos(prisma, other, s.id, [pngBytes()])).rejects.toMatchObject({ status: 404 });
    await expect(addStampPhotos(prisma, null, s.id, [pngBytes()])).rejects.toMatchObject({ status: 401 });
    await expect(prisma.photo.update({ where: { id: s.id }, data: { creationTransaction: "spoofed" } })).rejects.toThrow(/immutable/);
  });

  it("layout, removal, replacement, and final-removal rules continue to work", async () => {
    const me = await makeActor();
    const s = await makeStamp(me, (await makeVenue()).id, { caption: "keeps content valid" });
    expect((await setPhotoLayout(prisma, me, s.id, { photos: [{ id: s.photos[0]!.id, x: 0.3, rotation: -5 }] })).stamp.photos[0]).toMatchObject({ x: 0.3, rotation: -5 });
    await removeStampPhoto(prisma, me, s.id, s.photos[0]!.id);
    const replacement = await addStampPhotos(prisma, me, s.id, [pngBytes()]);
    expect(replacement.stamp.photos).toHaveLength(1);
    await expect(prisma.stampPhoto.update({ where: { id: s.photos[0]!.id }, data: { removedAt: null } })).rejects.toThrow(/stays removed/);
  });
});
