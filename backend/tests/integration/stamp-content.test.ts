import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createStamp, editStamp, getStamp, removeStampPhoto } from "@/server/services/stamps";
import { installMemoryStorage } from "./mem-storage";
import { INSIDE, makeActor, makeStamp, makeVenue, pngBytes } from "./factories";

installMemoryStorage();
// Red regression runs can leave deliberately invalid fixtures. Preserve rows with final removal before the next migration.
afterEach(async () => { await prisma.photo.updateMany({ where: { removedAt: null }, data: { removedAt: new Date() } }); });

describe("live stamp content", () => {
  it("removing all photos then clearing caption and song is rejected by the service and database", async () => {
    const me = await makeActor();
    const s = await makeStamp(me, (await makeVenue()).id, { caption: "words", meta: { songTitle: "Song", songArtist: "Artist" } });
    await removeStampPhoto(prisma, me, s.id, s.photos[0]!.id);
    await expect(editStamp(prisma, me, s.id, { caption: "", song: null })).rejects.toMatchObject({ status: 400 });
    await expect(prisma.photo.update({ where: { id: s.id }, data: { caption: "", songTitle: null, songArtist: null } })).rejects.toThrow(/photo_has_content/);
    expect((await getStamp(prisma, me, s.id)).stamp).toMatchObject({ photos: [], photoUrl: null, caption: "words", song: { title: "Song" } });
    await editStamp(prisma, me, s.id, { caption: "" });
    await expect(editStamp(prisma, me, s.id, { song: null })).rejects.toMatchObject({ status: 400 });
  });

  it("the database refuses last-photo removal and supports an atomic switch to a caption", async () => {
    const me = await makeActor();
    const s = await makeStamp(me, (await makeVenue()).id, { caption: "" });
    await expect(prisma.stampPhoto.update({ where: { id: s.photos[0]!.id }, data: { removedAt: new Date() } })).rejects.toThrow(/photo_has_content/);
    await prisma.$transaction(async (tx) => {
      await tx.stampPhoto.update({ where: { id: s.photos[0]!.id }, data: { removedAt: new Date() } });
      await tx.photo.update({ where: { id: s.id }, data: { caption: "replacement" } });
    });
    expect((await getStamp(prisma, me, s.id)).stamp).toMatchObject({ photos: [], caption: "replacement" });
  });

  it("concurrent caption clear and last-photo removal cannot commit an empty stamp", async () => {
    const me = await makeActor();
    const s = await makeStamp(me, (await makeVenue()).id, { caption: "words" });
    const outcomes = await Promise.allSettled([editStamp(prisma, me, s.id, { caption: "" }), removeStampPhoto(prisma, me, s.id, s.photos[0]!.id)]);
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find((r) => r.status === "rejected")).toMatchObject({ reason: { status: 400 } });
    const { stamp } = await getStamp(prisma, me, s.id);
    expect(Boolean(stamp.caption.trim() || stamp.song || stamp.photos.length)).toBe(true);
  });

  it("concurrent removal of the last two photos leaves one live photograph", async () => {
    const me = await makeActor();
    const s = await createStamp(prisma, me, (await makeVenue()).id, { photos: [pngBytes(), pngBytes()], meta: { ...INSIDE, caption: "" } });
    const results = await Promise.allSettled(s.photos.map((p) => removeStampPhoto(prisma, me, s.id, p.id)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { status: 400 } });
    expect((await getStamp(prisma, me, s.id)).stamp.photos).toHaveLength(1);
  });

  it("concurrent direct SQL caption clear and photo removal cannot bypass the content constraint", async () => {
    const me = await makeActor();
    const s = await makeStamp(me, (await makeVenue()).id, { caption: "words" });
    const results = await Promise.allSettled([
      prisma.photo.update({ where: { id: s.id }, data: { caption: "" } }),
      prisma.stampPhoto.update({ where: { id: s.photos[0]!.id }, data: { removedAt: new Date() } }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { message: expect.stringContaining("photo_has_content") } });
  });

  it("repeatable-read edits cannot clear content using a snapshot from before photo removal", async () => {
    const me = await makeActor();
    const s = await makeStamp(me, (await makeVenue()).id, { caption: "words" });
    let signalSnapshot!: () => void;
    let signalRemoval!: () => void;
    const snapshot = new Promise<void>((resolve) => { signalSnapshot = resolve; });
    const removal = new Promise<void>((resolve) => { signalRemoval = resolve; });
    const edit = prisma.$transaction(async (tx) => {
      await tx.photo.findUniqueOrThrow({ where: { id: s.id } });
      signalSnapshot();
      await removal;
      return tx.photo.update({ where: { id: s.id }, data: { caption: "" } });
    }, { isolationLevel: "RepeatableRead" }).then(() => ({ committed: true }), (error: unknown) => ({ committed: false, error }));
    await snapshot;
    try {
      await prisma.stampPhoto.update({ where: { id: s.photos[0]!.id }, data: { removedAt: new Date() } });
    } finally {
      signalRemoval();
    }
    expect(await edit).toMatchObject({ committed: false, error: { code: "P2034" } });
    expect((await getStamp(prisma, me, s.id)).stamp).toMatchObject({ caption: "words", photos: [] });
  });

  it("the database rejects whitespace-only song titles and artists on live stamps", async () => {
    const me = await makeActor();
    const venue = await makeVenue();
    for (const [songTitle, songArtist] of [["\t\n", "Artist"], ["Title", "\u00a0\u2003\ufeff"], ["\t", "\t"]]) {
      await expect(prisma.photo.create({ data: { userId: me.userId, venueId: venue.id, ...INSIDE, caption: "", songTitle, songArtist } })).rejects.toThrow(/photo_song_has_text/);
    }
  });

  it("creation with live photos succeeds, while a stale original storage key never counts as content", async () => {
    const me = await makeActor();
    const venue = await makeVenue();
    const s = await createStamp(prisma, me, venue.id, { photos: [pngBytes(), pngBytes()], meta: { ...INSIDE, caption: "" } });
    expect(s.photos).toHaveLength(2);
    for (const caption of [" \t\n", "\u00a0\u2003\ufeff"]) await expect(prisma.photo.create({ data: { userId: me.userId, venueId: venue.id, ...INSIDE, caption } })).rejects.toThrow(/photo_has_content/);
    await expect(prisma.photo.create({ data: { userId: me.userId, venueId: venue.id, ...INSIDE, caption: "", storageKey: "photos/stale.png", mimeType: "image/png" } })).rejects.toThrow(/photo_has_content/);
  });
});
