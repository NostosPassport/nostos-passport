import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";
import { cachedGooglePrice } from "@/server/services/google-price-cache";
import { ensureGooglePriceForStamp } from "@/server/services/places";
import { createStamp } from "@/server/services/stamps";
import { makeActor, VENUE_POS } from "./factories";

const originalKey = process.env.GOOGLE_PLACES_API_KEY;
afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
  else process.env.GOOGLE_PLACES_API_KEY = originalKey;
});

const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

describe("Google price cache", () => {
  it("fetches price once, caches no-repeat state, and renders later stamps from the cache", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    const googlePlaceId = `google-${randomUUID()}`;
    const venue = await prisma.venue.create({
      data: {
        slug: `priced-${randomUUID()}`,
        name: "Priced Bistro",
        address: "1 Price St",
        area: "West Village",
        city: "New York",
        region: "New York",
        country: "United States",
        countryCode: "US",
        timeZone: "America/New_York",
        lat: VENUE_POS.lat,
        lng: VENUE_POS.lng,
        googlePlaceId,
        googlePrimaryType: "italian_restaurant",
        googleTypes: ["italian_restaurant", "restaurant"],
        cuisines: ["Italian"],
        category: "restaurant",
        googleBusinessStatus: "OPERATIONAL",
      },
    });

    let fieldMask = "";
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      fieldMask = new Headers(init?.headers).get("X-Goog-FieldMask") ?? "";
      return response({ priceLevel: "PRICE_LEVEL_MODERATE" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const place = { id: venue.id, googlePlaceId };
    await ensureGooglePriceForStamp(prisma, place);
    await ensureGooglePriceForStamp(prisma, place);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fieldMask).toBe("priceLevel");
    expect(await cachedGooglePrice(prisma, venue.id)).toEqual({ cached: true, priceTier: "$$" });

    const me = await makeActor();
    const stamp = await createStamp(prisma, me, venue.id, { meta: { caption: "priced", mode: "now" } });
    expect(stamp.artwork).toMatchObject({ priceTier: "$$" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caches an unspecified result so Google is not asked again", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    const googlePlaceId = `google-${randomUUID()}`;
    const venue = await prisma.venue.create({
      data: {
        slug: `unpriced-${randomUUID()}`,
        name: "Unpriced Cafe",
        address: "2 Price St",
        area: "West Village",
        city: "New York",
        region: "New York",
        country: "United States",
        countryCode: "US",
        timeZone: "America/New_York",
        lat: VENUE_POS.lat,
        lng: VENUE_POS.lng,
        googlePlaceId,
        googlePrimaryType: "cafe",
        googleTypes: ["cafe", "restaurant"],
        cuisines: ["Café"],
        category: "restaurant",
        googleBusinessStatus: "OPERATIONAL",
      },
    });

    const fetchMock = vi.fn(async () => response({}));
    vi.stubGlobal("fetch", fetchMock);

    const place = { id: venue.id, googlePlaceId };
    await ensureGooglePriceForStamp(prisma, place);
    await ensureGooglePriceForStamp(prisma, place);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await cachedGooglePrice(prisma, venue.id)).toEqual({ cached: true, priceTier: null });
  });
});
