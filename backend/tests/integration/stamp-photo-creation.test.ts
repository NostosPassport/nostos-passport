import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { addStampPhotos, removeStampPhoto, setPhotoLayout } from "@/server/services/stamps";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeStamp, makeVenue, pngBytes } from "./factories";

const mem = installMemoryStorage();

describe("creation-only stamp photos", () => {
  it("a remote later append is refused before processing or storage, including while flagged", async () => {
    const me = await makeActor();
    const s = await makeStamp(me, (await makeVenue()).id);
    const before = mem.size;
    await expect(addStampPhotos(prisma, me, s.id, [pngBytes()], new Date(Date.now() + 86_400_000))).rejects.toMatchObject({ status: 400, message: "Photos can only be attached when creating a stamp" });
    await prisma.flag.create({ data: { targetType: "PHOTO", targetId: s.id, flaggerId: (await makeActor()).userId, reason: "legacy flag" } });
    await expect(addStampPhotos(prisma, me, s.id, [Buffer.from("invalid photo")])).rejects.toMatchObject({ status: 400, message: "Photos can only be attached when creating a stamp" });
    expect(mem.size).toBe(before);
    expect(await prisma.stampPhoto.count({ where: { stampId: s.id } })).toBe(1);
  });

  it("direct database append is refused even after updating the parent in the same transaction", async () => {
    const me = await makeActor();
    const s = await makeStamp(me, (await makeVenue()).id);
    const row = { stampId: s.id, storageKey: "photos/later.png", mimeType: "image/png", position: 1 };
    await expect(prisma.stampPhoto.create({ data: row })).rejects.toThrow(/only be attached when creating/);
    await expect(prisma.$transaction(async (tx) => {
      await tx.photo.update({ where: { id: s.id }, data: { caption: "changed" } });
      await tx.stampPhoto.create({ data: row });
    })).rejects.toThrow(/only be attached when creating/);
    await expect(prisma.photo.update({ where: { id: s.id }, data: { creationTransaction: "spoofed" } })).rejects.toThrow(/immutable/);
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: s.id } })).caption).toBe("hello");
  });

  it("layout and final removal remain permitted without reopening the photo set", async () => {
    const me = await makeActor();
    const s = await makeStamp(me, (await makeVenue()).id);
    expect((await setPhotoLayout(prisma, me, s.id, { photos: [{ id: s.photos[0]!.id, x: 0.3, rotation: -5 }] })).stamp.photos[0]).toMatchObject({ x: 0.3, rotation: -5 });
    await removeStampPhoto(prisma, me, s.id, s.photos[0]!.id);
    await expect(prisma.stampPhoto.create({ data: { stampId: s.id, storageKey: "photos/replacement.png", mimeType: "image/png", position: 0 } })).rejects.toThrow(/only be attached when creating/);
    await expect(prisma.stampPhoto.update({ where: { id: s.photos[0]!.id }, data: { removedAt: null } })).rejects.toThrow(/stays removed/);
  });
});
