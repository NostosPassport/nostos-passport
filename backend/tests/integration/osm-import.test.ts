import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import type { OverpassElement } from "@/lib/osm";
import { importOsmVenues } from "@/server/services/osm-import";
import { GET as placesRoute } from "@/app/api/places/route";

const sample = (JSON.parse(readFileSync("tests/fixtures/overpass-sample.json", "utf8")) as { elements: OverpassElement[] }).elements;

describe("venues:import", () => {
  it("creates places with the default geofence, and is idempotent", async () => {
    expect(await importOsmVenues(prisma, sample)).toMatchObject({ fetched: 6, created: 6, updated: 0 });
    expect(await importOsmVenues(prisma, sample)).toMatchObject({ created: 0, updated: 0, unchanged: 6 });
    const v = await prisma.venue.findUniqueOrThrow({ where: { osmId: "node/1001" } });
    expect(v).toMatchObject({ slug: "test-tavern-n1001", geofenceMeters: 100, city: "New York", countryCode: "US", timeZone: "America/New_York" });
    expect((await prisma.venue.findUniqueOrThrow({ where: { osmId: "way/2001" } })).slug).toBe("test-tavern-w2001");
  });

  it("slugs don't change on re-import even if names change; coordinates and names follow OSM", async () => {
    await importOsmVenues(prisma, sample);
    const renamed = sample.map((e) => (e.id === 1001 ? { ...e, lat: 40.7266, tags: { ...e.tags, name: "Renamed In OSM" } } : e.id === 1002 ? { ...e, tags: { ...e.tags, name: "Basement Club NYC" } } : e));
    const r = await importOsmVenues(prisma, renamed);
    expect(r).toMatchObject({ updated: 2 });
    expect(await prisma.venue.findUniqueOrThrow({ where: { osmId: "node/1001" } })).toMatchObject({ name: "Renamed In OSM", slug: "test-tavern-n1001", lat: 40.7266 });
    expect(await prisma.venue.findUniqueOrThrow({ where: { osmId: "node/1002" } })).toMatchObject({ name: "Basement Club NYC", slug: "basement-club" });
  });

  it("adds ODbL attribution to the places API", async () => {
    await importOsmVenues(prisma, sample);
    const body = await (await placesRoute(new Request("http://localhost/api/places"), undefined as never)).json();
    expect(body.attribution).toEqual({ text: "© OpenStreetMap contributors", url: "https://www.openstreetmap.org/copyright", license: "ODbL-1.0" });
    expect(body.places.every((v: { fromOsm: boolean }) => v.fromOsm)).toBe(true);
  });

  it("updates coordinates atomically and rolls back on slug collision", async () => {
    await importOsmVenues(prisma, sample);
    const moved = sample.map((e) => (e.id === 1001 ? { ...e, lat: 40.7185, lon: -73.988 } : e));
    await importOsmVenues(prisma, moved);
    expect((await prisma.venue.findUniqueOrThrow({ where: { osmId: "node/1001" } })).lat).toBe(40.7185);
    await prisma.venue.create({ data: { slug: "new-bar-n7777", name: "Squatter", address: "", area: "East Village", city: "New York", region: "New York", country: "United States", countryCode: "US", timeZone: "America/New_York", lat: 40.72, lng: -73.98 } });
    const before = await prisma.venue.count();
    const clash: OverpassElement[] = [...sample, { type: "node", id: 7777, lat: 40.7262, lon: -73.9848, tags: { amenity: "bar", name: "New Bar" } }, { type: "node", id: 7778, lat: 40.7263, lon: -73.9849, tags: { amenity: "pub", name: "Brand New" } }, { type: "node", id: 7779, lat: 40.7201, lon: -73.9880, tags: { amenity: "bar", name: "New Bar" } }];
    await expect(importOsmVenues(prisma, clash)).rejects.toThrow(/Slug collision/);
    expect(await prisma.venue.count()).toBe(before);
  });

  it("no attribution when no place came from OSM", async () => {
    await prisma.venue.create({ data: { slug: "manual", name: "Manual", address: "1 St", area: "East Village", city: "New York", region: "New York", country: "United States", countryCode: "US", timeZone: "America/New_York", lat: 40.72, lng: -73.98 } });
    const body = await (await placesRoute(new Request("http://localhost/api/places"), undefined as never)).json();
    expect(body.attribution).toBeNull();
  });
});
