import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { getBookLayout, getStampMembership, setStampInPassport, setStampPlacement } from "@/server/services/books";
import { createCollection, getCollection, setStampCollections, updateCollection } from "@/server/services/collections";
import { getStamp, listUserStamps, removeStamp } from "@/server/services/stamps";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeStamp, makeVenue } from "./factories";

installMemoryStorage();

async function stamps(me: Awaited<ReturnType<typeof makeActor>>, n: number) {
  const t = Date.now() - 10 * 3600_000;
  const ids: string[] = [];
  for (let i = 0; i < n; i++) ids.push((await makeStamp(me, (await makeVenue()).id, { caption: `n${i}`, now: new Date(t + i * 3600_000) })).id);
  return ids;
}

const SPOT = { x: 0.25, y: 0.6, scale: 1.4, rotation: -8 };

describe("main passport membership", () => {
  it("takes a stamp out of the passport without removing it, closes the gap, and puts it back in visit order", async () => {
    const me = await makeActor();
    const ids = await stamps(me, 4);

    expect(await getStampMembership(prisma, me, ids[1]!)).toEqual({ inPassport: true, collectionIds: [] });
    expect(await setStampInPassport(prisma, me, ids[1]!, { inPassport: false })).toEqual({ inPassport: false, collectionIds: [] });

    const grid = await listUserStamps(prisma, me, me.handle);
    expect(grid.stamps.map((s) => s.id)).toEqual(ids);
    expect(grid.stamps.map((s) => (s.page === null ? "out" : `${s.page}.${s.slot}`))).toEqual(["1.1", "out", "1.2", "1.3"]);
    expect((await getStamp(prisma, me, ids[1]!)).stamp).toMatchObject({ page: null, slot: null });

    await setStampInPassport(prisma, me, ids[1]!, { inPassport: true });
    expect((await listUserStamps(prisma, me, me.handle)).stamps.map((s) => `${s.page}.${s.slot}`)).toEqual(["1.1", "1.2", "1.3", "2.1"]);
  });

  it("keeps a stamp out of the passport in its collections", async () => {
    const me = await makeActor();
    const [a, b] = await stamps(me, 2);
    const c = await createCollection(prisma, me, { name: "Bars", color: "blue", stampIds: [a!, b!] });
    await setStampInPassport(prisma, me, a!, { inPassport: false });

    const view = await getCollection(prisma, me, c.collection.id);
    expect(view.collection.stamps.map((s) => [s.id, s.page, s.slot])).toEqual([[a, 1, 1], [b, 1, 2]]);
    expect(await getStampMembership(prisma, me, a!)).toEqual({ inPassport: false, collectionIds: [c.collection.id] });
  });

  it("refuses another account's stamp and removed stamps", async () => {
    const me = await makeActor();
    const other = await makeActor();
    const [a, b] = await stamps(me, 2);
    await expect(setStampInPassport(prisma, other, a!, { inPassport: false })).rejects.toMatchObject({ status: 404 });
    await expect(getStampMembership(prisma, other, a!)).rejects.toMatchObject({ status: 404 });
    await removeStamp(prisma, me, b!);
    await expect(setStampInPassport(prisma, me, b!, { inPassport: true })).rejects.toMatchObject({ status: 404 });
  });
});

describe("per-book placement", () => {
  it("keeps a separate placement for the same stamp in the passport and in each collection", async () => {
    const me = await makeActor();
    const [a, b] = await stamps(me, 2);
    const one = await createCollection(prisma, me, { name: "One", color: "blue", stampIds: [a!, b!] });
    const two = await createCollection(prisma, me, { name: "Two", color: "plum", stampIds: [a!] });

    expect(await getBookLayout(prisma, me, "passport")).toEqual({ placements: [] });
    expect(await setStampPlacement(prisma, me, "passport", a!, SPOT)).toEqual({ placements: [{ stampId: a, ...SPOT }] });
    await setStampPlacement(prisma, me, one.collection.id, a!, { x: 0.8, y: 0.2, scale: 0.6, rotation: 12 });

    expect((await getBookLayout(prisma, me, "passport")).placements).toEqual([{ stampId: a, ...SPOT }]);
    expect((await getBookLayout(prisma, me, one.collection.id)).placements).toEqual([{ stampId: a, x: 0.8, y: 0.2, scale: 0.6, rotation: 12 }]);
    expect((await getBookLayout(prisma, me, two.collection.id)).placements).toEqual([]);

    expect(await setStampPlacement(prisma, me, "passport", a!, { reset: true })).toEqual({ placements: [] });
  });

  it("validates placements and refuses books the stamp is not in", async () => {
    const me = await makeActor();
    const other = await makeActor();
    const [a, b] = await stamps(me, 2);
    const c = await createCollection(prisma, me, { name: "Only A", color: "blue", stampIds: [a!] });

    await expect(setStampPlacement(prisma, me, "passport", a!, { ...SPOT, scale: 9 })).rejects.toBeTruthy();
    await expect(setStampPlacement(prisma, me, "passport", a!, { ...SPOT, x: -0.1 })).rejects.toBeTruthy();
    await expect(setStampPlacement(prisma, me, "passport", a!, { ...SPOT, extra: 1 })).rejects.toBeTruthy();
    await expect(setStampPlacement(prisma, me, c.collection.id, b!, SPOT)).rejects.toMatchObject({ status: 400 });
    await expect(setStampPlacement(prisma, other, "passport", a!, SPOT)).rejects.toMatchObject({ status: 404 });
    await expect(getBookLayout(prisma, other, c.collection.id)).rejects.toMatchObject({ status: 404 });

    await setStampInPassport(prisma, me, b!, { inPassport: false });
    await expect(setStampPlacement(prisma, me, "passport", b!, SPOT)).rejects.toMatchObject({ status: 400 });
  });

  it("discards a placement when the stamp leaves that book, and keeps it when a collection is reordered", async () => {
    const me = await makeActor();
    const [a, b, c] = await stamps(me, 3);
    const col = await createCollection(prisma, me, { name: "Trip", color: "green", stampIds: [a!, b!] });
    await setStampPlacement(prisma, me, col.collection.id, a!, SPOT);
    await setStampPlacement(prisma, me, "passport", a!, SPOT);

    await updateCollection(prisma, me, col.collection.id, { stampIds: [b!, a!, c!] });
    expect((await getBookLayout(prisma, me, col.collection.id)).placements).toEqual([{ stampId: a, ...SPOT }]);
    expect((await getCollection(prisma, me, col.collection.id)).collection.stamps.map((s) => s.id)).toEqual([b, a, c]);

    await setStampCollections(prisma, me, a!, { collectionIds: [] });
    await setStampCollections(prisma, me, a!, { collectionIds: [col.collection.id] });
    expect((await getBookLayout(prisma, me, col.collection.id)).placements).toEqual([]);

    await setStampInPassport(prisma, me, a!, { inPassport: false });
    await setStampInPassport(prisma, me, a!, { inPassport: true });
    expect((await getBookLayout(prisma, me, "passport")).placements).toEqual([]);
  });
});
