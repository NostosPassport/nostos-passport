import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createCollection } from "@/server/services/collections";
import { disableCollectionShare, enableCollectionShare, getCollectionShareStatus, resolveCollectionShare } from "@/server/services/collection-sharing";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeStamp, makeVenue } from "./factories";

installMemoryStorage();
process.env.SHARE_TOKEN_SECRET = "integration-test-collection-share-secret-123456";

function tokenFromUrl(url: string) {
  const token = new URL(url).pathname.split("/").filter(Boolean).at(-1);
  if (!token) throw new Error("Share URL did not include a token");
  return decodeURIComponent(token);
}

describe("collection sharing", () => {
  it("shares only stamps explicitly in the collection and revokes immediately", async () => {
    const me = await makeActor();
    const first = await makeStamp(me, (await makeVenue()).id, { caption: "shared" });
    const masterOnly = await makeStamp(me, (await makeVenue()).id, { caption: "master only" });
    const created = await createCollection(prisma, me, { name: "Date Nights", color: "blue", stampIds: [first.id] });

    const enabled = await enableCollectionShare(prisma, me, created.collection.id);
    expect(enabled.share.enabled).toBe(true);
    if (!enabled.share.enabled) throw new Error("Expected sharing to be enabled");

    const shared = await resolveCollectionShare(prisma, tokenFromUrl(enabled.share.url));
    expect(shared.collection.name).toBe("Date Nights");
    expect(shared.collection.stamps.map((stamp) => stamp.id)).toEqual([first.id]);
    expect(shared.collection.stamps.some((stamp) => stamp.id === masterOnly.id)).toBe(false);

    await disableCollectionShare(prisma, me, created.collection.id);
    await expect(resolveCollectionShare(prisma, tokenFromUrl(enabled.share.url))).rejects.toMatchObject({ status: 404 });
  });

  it("does not let another account inspect, enable, or disable a collection share", async () => {
    const me = await makeActor();
    const other = await makeActor();
    const stamp = await makeStamp(me, (await makeVenue()).id);
    const created = await createCollection(prisma, me, { name: "Mine", color: "green", stampIds: [stamp.id] });

    await expect(getCollectionShareStatus(prisma, other, created.collection.id)).rejects.toMatchObject({ status: 404 });
    await expect(enableCollectionShare(prisma, other, created.collection.id)).rejects.toMatchObject({ status: 404 });
    await expect(disableCollectionShare(prisma, other, created.collection.id)).rejects.toMatchObject({ status: 404 });
  });

  it("keeps an enabled link stable and rejects tampering", async () => {
    const me = await makeActor();
    const created = await createCollection(prisma, me, { name: "Favorites", color: "plum", stampIds: [] });
    const first = await enableCollectionShare(prisma, me, created.collection.id);
    const second = await enableCollectionShare(prisma, me, created.collection.id);
    expect(second).toEqual(first);
    if (!first.share.enabled) throw new Error("Expected sharing to be enabled");

    const token = tokenFromUrl(first.share.url);
    const last = token.endsWith("A") ? "B" : "A";
    await expect(resolveCollectionShare(prisma, `${token.slice(0, -1)}${last}`)).rejects.toMatchObject({ status: 404 });
  });

  it("stops exposing a shared collection when its owner is deleted", async () => {
    const me = await makeActor();
    const created = await createCollection(prisma, me, { name: "Old", color: "sand", stampIds: [] });
    const enabled = await enableCollectionShare(prisma, me, created.collection.id);
    if (!enabled.share.enabled) throw new Error("Expected sharing to be enabled");

    await prisma.user.update({ where: { id: me.userId }, data: { deletedAt: new Date() } });
    await expect(resolveCollectionShare(prisma, tokenFromUrl(enabled.share.url))).rejects.toMatchObject({ status: 404 });
  });
});
