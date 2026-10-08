import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { createStamp, listUserPlaces, removeStampPhoto } from "@/server/services/stamps";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, INSIDE, makeStamp, makeVenue, pngBytes } from "./factories";
import * as pins from "@/app/api/me/pins/route";

installMemoryStorage();

describe("backend owner-only audit", () => {
  it("pin replacement gives the same error for foreign, removed and missing stamps", async () => {
    const me = await makeActor();
    const other = await makeActor();
    const foreign = await makeStamp(other, (await makeVenue()).id);
    const removed = await makeStamp(me, (await makeVenue()).id);
    await prisma.photo.update({ where: { id: removed.id }, data: { removedAt: new Date() } });
    const token = (await createSession(prisma, me.userId, { client: "IOS" })).token;

    const responses = [];
    for (const id of ["missing", foreign.id, removed.id]) {
      const res = await pins.PUT(
        new Request("http://localhost/api/me/pins", {
          method: "PUT",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({ stampIds: [id] }),
        }),
        undefined as never,
      );
      responses.push({ status: res.status, body: await res.text() });
    }

    expect(responses[0]!.status).toBe(400);
    for (const res of responses.slice(1)) expect(res).toEqual(responses[0]);
  });

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
