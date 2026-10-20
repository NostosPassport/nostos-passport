import "./env";
import { afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { distanceMeters } from "@/lib/geo";

const TABLES = [
  "rate_event",
  "login_attempt",
  "collection_share",
  "collection_stamp",
  "collection",
  "pinned_stamp",
  "stamp_photo",
  "photo",
  "venue",
  "session",
  "email_challenge",
  "app_user",
];

const nativeFetch = globalThis.fetch;
process.env.GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? "integration-test-key";
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input);
  if (url === "https://places.googleapis.com/v1/places:searchNearby") {
    const body = JSON.parse(String(init?.body ?? "{}")) as { locationRestriction?: { circle?: { center?: { latitude?: number; longitude?: number }; radius?: number } } };
    const center = body.locationRestriction?.circle?.center;
    const radius = body.locationRestriction?.circle?.radius ?? 750;
    const origin = { lat: center?.latitude ?? 0, lng: center?.longitude ?? 0 };
    const venues = await prisma.venue.findMany();
    const places = venues
      .filter((venue) => distanceMeters(origin, venue) <= radius)
      .map((venue) => ({
        id: `integration-${venue.id}`,
        displayName: { text: venue.slug },
        formattedAddress: venue.address,
        location: { latitude: venue.lat, longitude: venue.lng },
        addressComponents: [
          ...(venue.area ? [{ longText: venue.area, shortText: venue.area, types: ["neighborhood"] }] : []),
          ...(venue.city ? [{ longText: venue.city, shortText: venue.city, types: ["locality", "political"] }] : []),
          ...(venue.region ? [{ longText: venue.region, shortText: venue.region, types: ["administrative_area_level_1", "political"] }] : []),
          ...(venue.country ? [{ longText: venue.country, shortText: venue.countryCode ?? venue.country, types: ["country", "political"] }] : []),
        ],
        timeZone: { id: venue.timeZone },
        primaryType: "restaurant",
        types: ["restaurant"],
        businessStatus: "OPERATIONAL",
      }));
    return new Response(JSON.stringify({ places }), { status: 200, headers: { "content-type": "application/json" } });
  }
  return nativeFetch(input, init);
}) as typeof fetch;

beforeEach(async () => {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  globalThis.fetch = nativeFetch;
  await prisma.$disconnect();
});
