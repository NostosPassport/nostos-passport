import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";
import { cacheMichelinPreviewForStamp, previewMichelinForPlace } from "@/server/services/michelin";
import { createStamp, getStamp } from "@/server/services/stamps";
import { makeActor, VENUE_POS } from "./factories";

const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("Michelin enrichment", () => {
  it("looks up on restaurant selection, leaves the venue untouched, then caches the signed result only after a stamp succeeds", async () => {
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
    const preview = await previewMichelinForPlace(prisma, place);

    expect(preview).toMatchObject({ venueId: venue.id, stars: 2, proof: expect.any(String) });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await prisma.venue.findUniqueOrThrow({ where: { id: venue.id }, select: { michelinStars: true, michelinCheckedAt: true } })).toEqual({
      michelinStars: null,
      michelinCheckedAt: null,
    });

    const me = await makeActor();
    const created = await createStamp(prisma, me, venue.id, { meta: { caption: "dinner", mode: "now" } });
    expect(created.artwork?.michelinStars ?? null).toBeNull();

    await cacheMichelinPreviewForStamp(prisma, place, preview.proof);
    await cacheMichelinPreviewForStamp(prisma, place, preview.proof);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await prisma.venue.findUniqueOrThrow({ where: { id: venue.id }, select: { michelinStars: true, michelinCheckedAt: true } })).toMatchObject({
      michelinStars: 2,
      michelinCheckedAt: expect.any(Date),
    });
    const refreshed = await getStamp(prisma, me, created.id);
    expect(refreshed.stamp.artwork).toMatchObject({ michelinStars: 2 });
  });

  it("does not cache a failed click-time lookup and still allows the stamp", async () => {
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
    const fetchMock = vi.fn(async () => { throw new Error("network down"); });
    vi.stubGlobal("fetch", fetchMock);

    const place = {
      id: venue.id,
      name: venue.name,
      lat: venue.lat,
      lng: venue.lng,
      city: venue.city,
      country: venue.country,
      category: "restaurant" as const,
    };
    const preview = await previewMichelinForPlace(prisma, place);
    expect(preview).toEqual({ venueId: venue.id, stars: null, proof: null });

    const me = await makeActor();
    const stamp = await createStamp(prisma, me, venue.id, { meta: { caption: "still stamps", mode: "now" } });
    await cacheMichelinPreviewForStamp(prisma, place, preview.proof);

    expect(await prisma.venue.findUniqueOrThrow({ where: { id: venue.id }, select: { michelinStars: true, michelinCheckedAt: true } })).toEqual({
      michelinStars: null,
      michelinCheckedAt: null,
    });
    expect(stamp.artwork?.michelinStars ?? null).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
