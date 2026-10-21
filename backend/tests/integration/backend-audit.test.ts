import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createStamp, listUserPlaces, removeStampPhoto } from "@/server/services/stamps";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, INSIDE, makeStamp, makeVenue, pngBytes } from "./factories";

installMemoryStorage();

describe("backend owner-only audit", () => {
  it("place summaries never return a URL for a removed only photo", async () => {
    const me = await makeActor();
    const stamp = await makeStamp(me, (await makeVenue()).id, { caption: "keeps stamp alive" });
    await removeStampPhoto(prisma, me, stamp.id, stamp.photos[0]!.id);
    expect((await listUserPlaces(prisma, me, me.handle)).places[0]!.latestStamp.photoUrl).toBeNull();
  });

  it("place summaries choose the first live photo in layout order", async () => {
    const me = await makeActor();
    const stamp = await createStamp(prisma, me, (await makeVenue()).id, {
      photos: [pngBytes(), pngBytes()],
      meta: { ...INSIDE, caption: "words" },
    });
    await removeStampPhoto(prisma, me, stamp.id, stamp.photos[0]!.id);
    const summary = (await listUserPlaces(prisma, me, me.handle)).places[0]!.latestStamp;
    expect(summary.photoUrl?.split("?")[0]).toBe(stamp.photos[1]!.url.split("?")[0]);
  });
});
