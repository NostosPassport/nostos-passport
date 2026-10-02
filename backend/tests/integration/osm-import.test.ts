import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import type { OverpassElement } from "@/lib/osm";
import { importOsmVenues } from "@/server/services/osm-import";
import { getVenuePage, venueAccuracy } from "@/server/services/venues";
import { GET as venuesRoute } from "@/app/api/venues/route";
import { makeOwner } from "./factories";

const sample = (JSON.parse(readFileSync("tests/fixtures/overpass-sample.json", "utf8")) as { elements: OverpassElement[] }).elements;

describe("venues:import", () => {
  it("creates unclaimed venues with no official cover or hours, and is idempotent", async () => {
    expect(await importOsmVenues(prisma, sample)).toMatchObject({ fetched: 4, created: 4, updated: 0 });
    expect(await importOsmVenues(prisma, sample)).toMatchObject({ created: 0, updated: 0, unchanged: 4 });
    const v = await prisma.venue.findUniqueOrThrow({ where: { osmId: "node/1001" } });
    expect(v).toMatchObject({ slug: "test-tavern-n1001", officialCoverCents: null, hours: [] });
    expect((await prisma.venue.findUniqueOrThrow({ where: { osmId: "way/2001" } })).slug).toBe("test-tavern-w2001");
    expect(await prisma.venueClaim.count()).toBe(0);
    expect(await venueAccuracy(prisma, v.id)).toMatchObject({ status: "no_official_cover" });
  });

  it("slugs don't change on re-import even if names change; claimed venues keep their name, coordinates always follow OSM", async () => {
    await importOsmVenues(prisma, sample);
    const v = await prisma.venue.findUniqueOrThrow({ where: { osmId: "node/1001" } });
    await makeOwner(v.id);
    const renamed = sample.map((e) => (e.id === 1001 ? { ...e, lat: 40.7266, tags: { ...e.tags, name: "Renamed In OSM" } } : e.id === 1002 ? { ...e, tags: { ...e.tags, name: "Basement Club NYC" } } : e));
    const r = await importOsmVenues(prisma, renamed);
    expect(r).toMatchObject({ updated: 2, skippedClaimed: 1 });
    const after = await prisma.venue.findUniqueOrThrow({ where: { osmId: "node/1001" } });
    expect(after).toMatchObject({ name: "Test Tavern", slug: "test-tavern-n1001", lat: 40.7266 });
    expect(await prisma.venue.findUniqueOrThrow({ where: { osmId: "node/1002" } })).toMatchObject({ name: "Basement Club NYC", slug: "basement-club" });
  });

  it("adds ODbL attribution to the venue API and the venue page", async () => {
    await importOsmVenues(prisma, sample);
    const body = await (await venuesRoute(new Request("http://localhost/api/venues"), undefined as never)).json();
    expect(body.attribution).toEqual({ text: "© OpenStreetMap contributors", url: "https://www.openstreetmap.org/copyright", license: "ODbL-1.0" });
    expect(body.venues.every((v: { fromOsm: boolean }) => v.fromOsm)).toBe(true);
    expect((await getVenuePage(prisma, "test-tavern-n1001", null)).official.attribution).toMatchObject({ text: "© OpenStreetMap contributors" });
  });

  it("recomputes the neighborhood when coordinates move, even for claimed venues, and rolls back on failure", async () => {
    await importOsmVenues(prisma, sample);
    const v = await prisma.venue.findUniqueOrThrow({ where: { osmId: "node/1001" } });
    await makeOwner(v.id);
    const moved = sample.map((e) => (e.id === 1001 ? { ...e, lat: 40.7185, lon: -73.988 } : e));
    await importOsmVenues(prisma, moved);
    expect((await prisma.venue.findUniqueOrThrow({ where: { osmId: "node/1001" } })).neighborhood).toBe("Lower East Side");
    // A slug clash with an existing venue makes the whole import fail with nothing written.
    await prisma.venue.create({ data: { slug: "new-bar-n7777", name: "Squatter", address: "", neighborhood: "East Village", lat: 40.72, lng: -73.98, hours: [] } });
    const before = await prisma.venue.count();
    const clash: OverpassElement[] = [...sample, { type: "node", id: 7777, lat: 40.7262, lon: -73.9848, tags: { amenity: "bar", name: "New Bar" } }, { type: "node", id: 7778, lat: 40.7263, lon: -73.9849, tags: { amenity: "pub", name: "Brand New" } }, { type: "node", id: 7779, lat: 40.7201, lon: -73.9880, tags: { amenity: "bar", name: "New Bar" } }];
    await expect(importOsmVenues(prisma, clash)).rejects.toThrow(/Slug collision/);
    expect(await prisma.venue.count()).toBe(before);
  });

  it("no attribution when no venue came from OSM", async () => {
    await prisma.venue.create({ data: { slug: "manual", name: "Manual", address: "1 St", neighborhood: "East Village", lat: 40.72, lng: -73.98, hours: [] } });
    const body = await (await venuesRoute(new Request("http://localhost/api/venues"), undefined as never)).json();
    expect(body.attribution).toBeNull();
    expect((await getVenuePage(prisma, "manual", null)).official.attribution).toBeNull();
  });
});
