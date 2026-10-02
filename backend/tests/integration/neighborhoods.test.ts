import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import { pointInRing } from "@/lib/geo";
import { overpassQuery, parseOverpass, placeKind, PLACE_KINDS, type OverpassElement } from "@/lib/osm";
import { assignNeighborhoods, importNeighborhoods, loadNeighborhoods, locate, MIN_SET, neighborhoodIndex } from "@/server/services/neighborhoods";
import { importOsmVenues } from "@/server/services/osm-import";
import { createStampWithProgress, removeStamp } from "@/server/services/stamps";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, pngBytes } from "./factories";

installMemoryStorage();

const square = (lng0: number, lat0: number, lng1: number, lat1: number): [number, number][] => [[lng0, lat0], [lng1, lat0], [lng1, lat1], [lng0, lat1], [lng0, lat0]];
const HOODS = [
  { code: "T001", name: "Testville", borough: "Manhattan", rings: [square(-74.0, 40.70, -73.96, 40.74)] },
  { code: "T002", name: "Otherton", borough: "Brooklyn", rings: [square(-73.96, 40.70, -73.92, 40.74)] },
];
const at = (i: number) => ({ lat: 40.71 + (i % 5) * 0.004, lng: -73.99 + Math.floor(i / 5) * 0.001 });

async function place(i: number, lat = at(i).lat, lng = at(i).lng) {
  const v = await prisma.venue.create({ data: { slug: `nb-${i}-${Math.random().toString(36).slice(2, 6)}`, name: `Place ${i}`, address: "", neighborhood: "x", lat, lng } });
  return v;
}
async function stamp(actor: Awaited<ReturnType<typeof makeActor>>, v: { id: string; lat: number; lng: number }, now = new Date()) {
  return createStampWithProgress(prisma, actor, v.id, { photos: [pngBytes()], meta: { caption: "x", lat: String(v.lat), lng: String(v.lng) } }, now);
}

describe("geometry", () => {
  it("point in ring", () => {
    const r = square(0, 0, 2, 2);
    expect(pointInRing({ lat: 1, lng: 1 }, r)).toBe(true);
    expect(pointInRing({ lat: 3, lng: 1 }, r)).toBe(false);
    expect(pointInRing({ lat: 1, lng: -0.1 }, r)).toBe(false);
  });
});

describe("the real NYC boundaries", () => {
  it("load, and the East Village's landmark parks fall where they should", async () => {
    const n = await importNeighborhoods(prisma);
    expect(n).toBeGreaterThan(150);
    expect(await importNeighborhoods(prisma)).toBe(n); // idempotent
    const list = await loadNeighborhoods(prisma);
    expect(locate(list, 40.72654, -73.98179)?.name).toBe("East Village"); // Tompkins Square Park
    expect(locate(list, 40.7185, -73.988)?.name).toBe("Lower East Side");
    expect(locate(list, 40.0, -70.0)).toBeNull(); // the ocean
    const file = JSON.parse(readFileSync("prisma/data/neighborhoods.json", "utf8")) as unknown[];
    expect(file.length).toBe(n);
    expect(readFileSync("prisma/data/neighborhoods.json").length).toBeLessThan(1_000_000);
  });

  it("files places under the neighborhood that contains them", async () => {
    await importNeighborhoods(prisma);
    const v = await place(1, 40.72654, -73.98179);
    expect(await assignNeighborhoods(prisma)).toBe(1);
    expect(await prisma.venue.findUniqueOrThrow({ where: { id: v.id } })).toMatchObject({ neighborhood: "East Village", neighborhoodId: expect.any(String) });
    expect(await assignNeighborhoods(prisma)).toBe(0);
  });
});

describe("the importer covers more than bars", () => {
  const el = (id: number, tags: Record<string, string>, lat = 40.72, lng = -73.98): OverpassElement => ({ type: "node", id, lat, lon: lng, tags: { name: `N${id}`, ...tags } });
  it("keeps restaurants, cafes, parks, museums and bookstores, and drops what it doesn't know", async () => {
    for (const [key, vals] of Object.entries(PLACE_KINDS)) {
      expect(overpassQuery()).toContain(`"${key}"`);
      expect(vals.length).toBeGreaterThan(0);
    }
    expect(overpassQuery()).toMatch(/restaurant/);
    expect(overpassQuery()).toMatch(/park/);
    await importNeighborhoods(prisma, HOODS);
    const hoods = await loadNeighborhoods(prisma);
    const parsed = parseOverpass(
      [el(1, { amenity: "bar" }), el(2, { amenity: "restaurant" }), el(3, { amenity: "cafe" }), el(4, { leisure: "park" }), el(5, { tourism: "museum" }), el(6, { shop: "books" }),
        el(7, { amenity: "parking" }), el(8, { shop: "convenience" }), el(9, { amenity: "bar" }, 41.9, -73.0) /* outside every neighborhood */],
      (lat, lng) => locate(hoods, lat, lng),
    );
    expect(parsed.map((p) => [p.osmId, p.kind, p.neighborhoodId])).toEqual([
      ["node/1", "bar", "T001"], ["node/2", "restaurant", "T001"], ["node/3", "cafe", "T001"], ["node/4", "park", "T001"], ["node/5", "museum", "T001"], ["node/6", "books", "T001"],
    ]);
    expect(placeKind({ amenity: "parking" })).toBeNull();
  });

  it("the import files each place under its neighborhood", async () => {
    await importNeighborhoods(prisma, HOODS);
    await importOsmVenues(prisma, [{ type: "node", id: 1, lat: 40.72, lon: -73.98, tags: { name: "Cafe One", amenity: "cafe" } }, { type: "node", id: 2, lat: 40.72, lon: -73.94, tags: { name: "Park Two", leisure: "park" } }]);
    const rows = await prisma.venue.findMany({ orderBy: { name: "asc" } });
    expect(rows.map((r) => [r.name, r.neighborhood, r.neighborhoodId])).toEqual([["Cafe One", "Testville", "T001"], ["Park Two", "Otherton", "T002"]]);
  });
});

describe("collections", () => {
  it("counts visited places over total, earns a completion once, and never takes it back", async () => {
    await importNeighborhoods(prisma, HOODS);
    const me = await makeActor();
    const places = [];
    for (let i = 0; i < 4; i++) places.push(await place(i));
    await place(20, 40.72, -73.94); // in the other neighborhood
    await assignNeighborhoods(prisma);
    const t0 = Date.now() - 5 * 3600_000;
    const first = await stamp(me, places[0]!, new Date(t0));
    expect(first.progress).toMatchObject({ neighborhoodId: "T001", visited: 1, total: 4, complete: false, justCompleted: false, newPlace: true });
    // A second stamp at the same place later doesn't add a place.
    expect((await stamp(me, places[0]!, new Date(t0 + 3600_000))).progress).toMatchObject({ visited: 1, newPlace: false });
    await stamp(me, places[1]!, new Date(t0 + 2 * 3600_000));
    expect((await stamp(me, places[2]!, new Date(t0 + 3 * 3600_000))).progress).toMatchObject({ visited: 3, total: 4, complete: false });
    const done = await stamp(me, places[3]!, new Date(t0 + 4 * 3600_000));
    expect(done.progress).toMatchObject({ visited: 4, total: 4, complete: true, justCompleted: true });
    expect(await prisma.neighborhoodCompletion.count({ where: { userId: me.userId } })).toBe(1);
    // A new place opens in the neighborhood: the earned marker stays.
    await place(5);
    await assignNeighborhoods(prisma);
    const idx = await neighborhoodIndex(prisma, me);
    expect(idx.neighborhoods.find((n) => n.neighborhoodId === "T001")).toMatchObject({ visited: 4, total: 5, complete: true, percent: 80, completedAt: expect.any(Date) });
    expect(idx.totals).toEqual({ neighborhoodsStarted: 1, neighborhoodsComplete: 1 });
    // Removing a stamp lowers visited but the marker is earned for good.
    await removeStamp(prisma, me, done.stamp.id);
    expect((await neighborhoodIndex(prisma, me)).neighborhoods.find((n) => n.neighborhoodId === "T001")).toMatchObject({ visited: 3, complete: true });
  });

  it("a set needs at least 3 places, the index lists started neighborhoods first, and it is owner only", async () => {
    await importNeighborhoods(prisma, HOODS);
    expect(MIN_SET).toBe(3);
    const me = await makeActor();
    const other = await makeActor();
    const a = await place(0), b = await place(1);
    const c = await place(30, 40.72, -73.94);
    await assignNeighborhoods(prisma);
    const r = await stamp(me, a);
    expect(r.progress).toMatchObject({ visited: 1, total: 2, complete: false });
    await stamp(me, b, new Date(Date.now() + 3600_000));
    const two = (await neighborhoodIndex(prisma, me)).neighborhoods;
    expect(two.map((n) => n.neighborhoodId)).toEqual(["T001", "T002"]);
    expect(two[0]).toMatchObject({ visited: 2, total: 2, complete: false }); // 2 places is not a set
    expect((await neighborhoodIndex(prisma, other)).neighborhoods.every((n) => n.visited === 0)).toBe(true);
    expect(c.neighborhoodId).toBeNull();
  });

  it("App Review stamps never count, and a place with no neighborhood has no progress", async () => {
    await importNeighborhoods(prisma, HOODS);
    const reviewer = await makeActor();
    await prisma.user.update({ where: { id: reviewer.userId }, data: { geofenceExempt: true } });
    const v = await place(0);
    const lone = await place(40, 10, 10);
    await assignNeighborhoods(prisma);
    const out = await createStampWithProgress(prisma, { ...reviewer, geofenceExempt: true }, v.id, { photos: [pngBytes()], meta: { caption: "x", lat: "0", lng: "0" } });
    expect(out.progress).toBeNull();
    expect((await neighborhoodIndex(prisma, reviewer)).neighborhoods.every((n) => n.visited === 0)).toBe(true);
    const me = await makeActor();
    expect((await stamp(me, lone)).progress).toBeNull();
    expect((await stamp(me, v)).stamp.place.neighborhoodId).toBe("T001");
  });
});
