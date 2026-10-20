/**
 * Places: Google-backed restaurant/bar discovery plus durable Nostos venue identities.
 * Google results are ephemeral until a user opens or stamps one; then the Google place_id is resolved into `venue`.
 */
import { createHash } from "node:crypto";
import { z } from "zod";

import type { Db } from "@/lib/db";
import { distanceMeters } from "@/lib/geo";
import { OSM_ATTRIBUTION, slugify } from "@/lib/osm";
import { notFound } from "@/server/errors";
import { cacheGooglePrice, cachedGooglePrice } from "@/server/services/google-price-cache";
import { googleNearby, googlePlaceDetails, googlePlacePriceLevel, googleTextSearch, type GooglePlace } from "@/server/services/google-places";

const placeSelect = {
  id: true,
  slug: true,
  name: true,
  address: true,
  area: true,
  city: true,
  region: true,
  country: true,
  countryCode: true,
  timeZone: true,
  lat: true,
  lng: true,
  geofenceMeters: true,
  osmId: true,
  googlePlaceId: true,
  googlePrimaryType: true,
  googleTypes: true,
  cuisines: true,
  category: true,
  googleBusinessStatus: true,
} as const;

type PlaceRow = {
  id: string;
  slug: string;
  name: string;
  address: string;
  area: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  timeZone: string;
  lat: number;
  lng: number;
  geofenceMeters: number;
  osmId: string | null;
  googlePlaceId: string | null;
  googlePrimaryType: string | null;
  googleTypes: string[];
  cuisines: string[];
  category: string | null;
  googleBusinessStatus: string | null;
};

export type PlaceView = {
  id: string;
  slug: string;
  name: string;
  address: string;
  area: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  timeZone: string;
  lat: number;
  lng: number;
  geofenceMeters: number;
  fromOsm: boolean;
  googlePlaceId: string | null;
  category: "restaurant" | "bar" | null;
  cuisines: string[];
  primaryType: string | null;
  businessStatus: string | null;
};

export const localityLabel = (place: Pick<PlaceView, "area" | "city" | "region" | "country">) =>
  place.area ?? place.city ?? place.region ?? place.country ?? "Unknown area";

const category = (value: string | null): "restaurant" | "bar" | null => value === "restaurant" || value === "bar" ? value : null;
const toView = ({ osmId, googlePrimaryType, googleBusinessStatus, ...p }: PlaceRow): PlaceView => ({
  ...p,
  fromOsm: osmId !== null,
  category: category(p.category),
  primaryType: googlePrimaryType,
  businessStatus: googleBusinessStatus,
});

/** Legacy ODbL attribution for stored OSM venues. New discovery comes from Google Places. */
export const attributionFor = (places: readonly { fromOsm: boolean }[]) => (places.some((p) => p.fromOsm) ? OSM_ATTRIBUTION : null);

export async function listPlaces(db: Db): Promise<PlaceView[]> {
  return (await db.venue.findMany({ orderBy: { name: "asc" }, select: placeSelect })).map(toView);
}

function discoveryView(place: GooglePlace, existing: PlaceRow | undefined): PlaceView {
  return {
    id: existing?.id ?? place.googlePlaceId,
    slug: existing?.slug ?? slugify(place.name),
    name: place.name,
    address: place.address,
    area: existing?.area ?? place.area,
    city: existing?.city ?? place.city,
    region: existing?.region ?? place.region,
    country: existing?.country ?? place.country,
    countryCode: existing?.countryCode ?? place.countryCode,
    timeZone: existing?.timeZone ?? place.timeZone,
    lat: place.lat,
    lng: place.lng,
    geofenceMeters: existing?.geofenceMeters ?? 100,
    fromOsm: existing?.osmId != null,
    googlePlaceId: place.googlePlaceId,
    category: place.category,
    cuisines: place.cuisines,
    primaryType: place.primaryType,
    businessStatus: place.businessStatus,
  };
}

async function discoveryViews(db: Db, google: GooglePlace[]) {
  if (!google.length) return [];
  const ids = google.map((place) => place.googlePlaceId);
  const stored = await db.venue.findMany({ where: { googlePlaceId: { in: ids } }, select: placeSelect });
  const byGoogle = new Map(stored.flatMap((row) => row.googlePlaceId ? [[row.googlePlaceId, row] as const] : []));
  return google.map((place) => discoveryView(place, byGoogle.get(place.googlePlaceId)));
}

/**
 * Nearby restaurants and bars come directly from Google Places, nearest first. The user's location is used only for
 * the request and distance calculation and is never stored. Verification is still recomputed when a stamp is posted.
 */
export async function nearbyPlaces(db: Db, pos: { lat: number; lng: number }, radiusM = 750, limit = 20) {
  const places = await discoveryViews(db, await googleNearby(pos, radiusM));
  return places
    .map((place) => ({ ...place, distanceM: Math.round(distanceMeters(pos, place)) }))
    .sort((a, b) => a.distanceM - b.distanceM || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((place) => ({ ...place, inside: place.distanceM <= place.geofenceMeters }));
}

const searchSchema = z.string().trim().min(2, "Type at least 2 characters").max(100, "Search is limited to 100 characters");
export async function searchPlaces(db: Db, rawQuery: unknown, bias: { lat: number; lng: number } | null) {
  const term = searchSchema.parse(rawQuery ?? "");
  return discoveryViews(db, await googleTextSearch(term, bias));
}

async function uniqueSlug(db: Db, name: string, googlePlaceId: string) {
  const base = slugify(name);
  if (!(await db.venue.findUnique({ where: { slug: base }, select: { id: true } }))) return base;
  const suffix = createHash("sha256").update(googlePlaceId).digest("hex").slice(0, 8);
  return `${base.slice(0, 50)}-g${suffix}`;
}

/** Link an old OSM/mock row to Google instead of splitting historical stamps into a duplicate venue. */
async function legacyMatch(db: Db, place: GooglePlace) {
  const latPad = 0.001;
  const lngPad = 0.0015;
  const candidates = await db.venue.findMany({
    where: {
      googlePlaceId: null,
      lat: { gte: place.lat - latPad, lte: place.lat + latPad },
      lng: { gte: place.lng - lngPad, lte: place.lng + lngPad },
    },
    select: placeSelect,
  });
  const normalized = slugify(place.name);
  return candidates
    .filter((candidate) => slugify(candidate.name) === normalized && distanceMeters(place, candidate) <= 80)
    .sort((a, b) => distanceMeters(place, a) - distanceMeters(place, b))[0] ?? null;
}

/**
 * One-time price enrichment used by stamp creation. The venue row lock makes concurrent first stamps serialize, so once a
 * cached row exists neither another stamp nor any stamp-viewing path makes another paid Details request for price.
 */
export async function ensureGooglePriceForStamp(db: Db, place: Pick<PlaceView, "id" | "googlePlaceId">) {
  if (!place.googlePlaceId) return;
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM venue WHERE id = ${place.id} FOR UPDATE`;
    if ((await cachedGooglePrice(tx, place.id)).cached) return;
    const priceLevel = await googlePlacePriceLevel(place.googlePlaceId!);
    await cacheGooglePrice(tx, place.id, priceLevel);
  });
}

/**
 * Beli-style get-or-create: a Google place_id becomes a durable Nostos venue only when the user actually uses it.
 * Cuisine/category and locality are snapshotted from Google's place data at that point. A newly resolved venue also caches
 * price from that same Details response, so no second request is needed when its first stamp is created.
 */
export async function resolveGoogleVenue(db: Db, googlePlaceId: string): Promise<PlaceView> {
  const already = await db.venue.findUnique({ where: { googlePlaceId }, select: placeSelect });
  if (already) return toView(already);

  const google = await googlePlaceDetails(googlePlaceId);
  const old = await legacyMatch(db, google);
  const data = {
    name: google.name,
    address: google.address,
    area: google.area,
    city: google.city,
    region: google.region,
    country: google.country,
    countryCode: google.countryCode,
    timeZone: google.timeZone,
    lat: google.lat,
    lng: google.lng,
    googlePlaceId: google.googlePlaceId,
    googlePrimaryType: google.primaryType,
    googleTypes: google.types,
    cuisines: google.cuisines,
    category: google.category,
    googleBusinessStatus: google.businessStatus,
    googleSyncedAt: new Date(),
  };

  if (old) {
    const row = await db.venue.update({ where: { id: old.id }, data, select: placeSelect });
    await cacheGooglePrice(db, row.id, google.priceLevel);
    return toView(row);
  }
  const slug = await uniqueSlug(db, google.name, google.googlePlaceId);
  try {
    const row = await db.venue.create({ data: { ...data, slug, geofenceMeters: 100 }, select: placeSelect });
    await cacheGooglePrice(db, row.id, google.priceLevel);
    return toView(row);
  } catch (error) {
    const raced = await db.venue.findUnique({ where: { googlePlaceId }, select: placeSelect });
    if (raced) {
      const cached = await cachedGooglePrice(db, raced.id);
      if (!cached.cached) await cacheGooglePrice(db, raced.id, google.priceLevel);
      return toView(raced);
    }
    throw error;
  }
}

/** A durable place by Nostos id/slug, or a Google place_id that should be resolved on demand. */
export async function getPlace(db: Db, key: string): Promise<PlaceView> {
  const stored = await db.venue.findFirst({ where: { OR: [{ id: key }, { slug: key }, { googlePlaceId: key }] }, select: placeSelect });
  if (stored) return toView(stored);
  if (!key.trim()) throw notFound("Place not found");
  return resolveGoogleVenue(db, key);
}
