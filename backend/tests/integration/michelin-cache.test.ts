import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";
import { ensureMichelinForStamp } from "@/server/services/michelin";
import { createStamp } from "@/server/services/stamps";
import { makeActor, VENUE_POS } from "./factories";

const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("Michelin enrichment", () => {
  it("matches by name and location, caches once, and exposes the star count on stamp artwork", async () => {
    const venue = await prisma.venue.create({
      data: {
        slug: `michelin-${randomUUID()}`,
        name: "Test Osteria",
        address: "1 Test St",
        area: "West Village",
        city: "New York",
        region: "New York",
        country: "United States",
        countryCode: "US",
        timeZone: "America/New_York",
        lat: VENUE_POS.lat,
        lng: VENUE_POS.lng,
        category: "restaurant",
        cuisines: ["Italian"],
        googlePrimaryType: "italian_restaurant",
      },
    });
    const fetchMock = vi.fn(async () => response({
      results: [{
        hits: [{
          name: "Test Osteria",
          _geoloc: { lat: VENUE_POS.lat + 0.00005, lng: VENUE_POS.lng },
          michelin_award: "2 Stars",
        }],
      }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const place = { id: venue.id, name: venue.name, lat: venue.lat, lng: venue.lng, city: venue.city, country: venue.country, category: "restaurant" as const };
    await ensureMichelinForStamp(prisma, place);
    await ensureMichelinForStamp(prisma, place);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await prisma.venue.findUniqueOrThrow({ where: { id: venue.id }, select: { michelinStars: true, michelinCheckedAt: true } })).toMatchObject({
      michelinStars: 2,
      michelinCheckedAt: expect.any(Date),
    });

    const me = await makeActor();
    const stamp = await createStamp(prisma, me, venue.id, { meta: { caption: "dinner", mode: "now" } });
    expect(stamp.artwork).toMatchObject({ michelinStars: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never blocks stamping when Michelin is unavailable and leaves the venue eligible for a later retry", async () => {
    const venue = await prisma.venue.create({
      data: {
        slug: `michelin-down-${randomUUID()}`,
        name: "Offline Bistro",
        address: "2 Test St",
        city: "New York",
        country: "United States",
        timeZone: "America/New_York",
        lat: VENUE_POS.lat,
        lng: VENUE_POS.lng,
        category: "restaurant",
        cuisines: ["French"],
        googlePrimaryType: "french_restaurant",
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));

    await expect(ensureMichelinForStamp(prisma, {
      id: venue.id,
      name: venue.name,
      lat: venue.lat,
      lng: venue.lng,
      city: venue.city,
      country: venue.country,
      category: "restaurant",
    })).resolves.toBeUndefined();

    expect(await prisma.venue.findUniqueOrThrow({ where: { id: venue.id }, select: { michelinStars: true, michelinCheckedAt: true } })).toEqual({
      michelinStars: null,
      michelinCheckedAt: null,
    });

    const me = await makeActor();
    const stamp = await createStamp(prisma, me, venue.id, { meta: { caption: "still stamps", mode: "now" } });
    expect(stamp.artwork?.michelinStars ?? null).toBeNull();
  });
});
