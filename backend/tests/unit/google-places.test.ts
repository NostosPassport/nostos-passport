import { afterEach, describe, expect, it } from "vitest";

import { cuisineTags, googleNearby, googlePlaceDetails, googleTextSearch, localityFromAddressComponents } from "@/server/services/google-places";

const originalKey = process.env.GOOGLE_PLACES_API_KEY;
afterEach(() => {
  if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
  else process.env.GOOGLE_PLACES_API_KEY = originalKey;
});

const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

describe("Google Places normalization", () => {
  it("turns Google restaurant types into durable cuisine labels", () => {
    expect(cuisineTags("italian_restaurant", ["italian_restaurant", "pizza_restaurant", "restaurant", "food"])).toEqual(["Italian", "Pizza"]);
    expect(cuisineTags("japanese_restaurant", ["japanese_restaurant", "sushi_restaurant", "restaurant"])).toEqual(["Japanese", "Sushi"]);
    expect(cuisineTags("cocktail_bar", ["cocktail_bar", "bar"])).toEqual(["Cocktail Bar"]);
  });

  it("normalizes worldwide locality from Google address components", () => {
    expect(localityFromAddressComponents([
      { longText: "Trastevere", shortText: "Trastevere", types: ["neighborhood"] },
      { longText: "Rome", shortText: "Rome", types: ["locality", "political"] },
      { longText: "Lazio", shortText: "Lazio", types: ["administrative_area_level_1", "political"] },
      { longText: "Italy", shortText: "IT", types: ["country", "political"] },
    ])).toEqual({ area: "Trastevere", city: "Rome", region: "Lazio", country: "Italy", countryCode: "IT" });
  });

  it("normalizes nearby restaurants and bars and excludes permanently closed results", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    const fetchImpl = (async () => response({ places: [
      {
        id: "open",
        displayName: { text: "Open Sushi" },
        formattedAddress: "1 Test St",
        location: { latitude: 40.7, longitude: -73.9 },
        addressComponents: [
          { longText: "Queens", shortText: "Queens", types: ["sublocality_level_1", "political"] },
          { longText: "New York", shortText: "New York", types: ["locality", "political"] },
          { longText: "New York", shortText: "NY", types: ["administrative_area_level_1", "political"] },
          { longText: "United States", shortText: "US", types: ["country", "political"] },
        ],
        primaryType: "sushi_restaurant",
        types: ["sushi_restaurant", "restaurant"],
        businessStatus: "OPERATIONAL",
      },
      { id: "closed", displayName: { text: "Closed Bar" }, formattedAddress: "2 Test St", location: { latitude: 40.71, longitude: -73.91 }, primaryType: "bar", types: ["bar"], businessStatus: "CLOSED_PERMANENTLY" },
    ] })) as unknown as typeof fetch;

    const places = await googleNearby({ lat: 40.7, lng: -73.9 }, 750, fetchImpl);
    expect(places).toEqual([expect.objectContaining({
      googlePlaceId: "open",
      name: "Open Sushi",
      category: "restaurant",
      cuisines: ["Sushi"],
      area: "Queens",
      city: "New York",
      region: "New York",
      country: "United States",
      countryCode: "US",
    })]);
  });

  it("does not force an un-biased text search into the US or New York", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    let body: Record<string, unknown> = {};
    const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
      body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return response({ places: [] });
    }) as unknown as typeof fetch;

    await googleTextSearch("Roscioli Rome", null, fetchImpl);
    expect(body).toMatchObject({ textQuery: "Roscioli Rome", maxResultCount: 20, languageCode: "en" });
    expect(body).not.toHaveProperty("regionCode");
    expect(body).not.toHaveProperty("locationBias");
  });

  it("loads a bar detail by Google place id", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    let seen = "";
    const fetchImpl = (async (input: string | URL | Request) => {
      seen = String(input);
      return response({
        id: "abc/123",
        displayName: { text: "Test Wine Bar" },
        location: { latitude: 41.89, longitude: 12.47 },
        addressComponents: [
          { longText: "Rome", shortText: "Rome", types: ["locality", "political"] },
          { longText: "Italy", shortText: "IT", types: ["country", "political"] },
        ],
        primaryType: "wine_bar",
        types: ["wine_bar", "bar"],
        businessStatus: "OPERATIONAL",
      });
    }) as unknown as typeof fetch;

    const place = await googlePlaceDetails("abc/123", fetchImpl);
    expect(seen).toContain("abc%2F123");
    expect(place).toMatchObject({ category: "bar", cuisines: ["Wine Bar"], city: "Rome", country: "Italy", countryCode: "IT" });
  });
});
