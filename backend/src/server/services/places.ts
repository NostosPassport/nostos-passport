/**
 * Places: Google-backed restaurant/bar discovery plus durable Nostos venue identities.
 * Google results are ephemeral until a user opens or stamps one; then the Google place_id is resolved into `venue`.
 */
import { createHash } from "node:crypto";
import { z } from "zod";

import type { Db } from "@/lib/db";
import { distanceMeters } from "@/lib/geo";
import { OSM_ATTRIBUTION, slugify } from "@/lib/osm";
import { badRequest, notFound } from "@/server/errors";
import { googleNearby, googlePlaceDetails, googleTextSearch, type GooglePlace } from "@/server/services/google-places";
import { loadNeighborhoods, locate } from "@/server/services/neighborhoods";

const placeSelect = {
  id: true,
  slug: true,
  name: true,
  address: true,
  neighborhood: true,
  lat: true,
  lng: true,
  geofenceMeters: true,
  neighborhoodId: true,
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
  neighborhood: string;
  lat: number;
  lng: number;
  geofenceMeters: number;
  neighborhoodId: string | null;
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
  neighborhood: string;
  lat: number;
  lng: number;
  geofenceMeters: number;
  neighborhoodId: string | null;
  fromOsm: boolean;
  googlePlaceId: string | null;
  category: "restaurant" | "bar" | null;
  cuisines: string[];
  primaryType: string | null;
  businessStatus: string | null;
};

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

function discoveryView(
  place: GooglePlace,
  hood: { id: string; name: string },
  existing: PlaceRow | undefined,
): PlaceView {
  return {
    id: existing?.id ?? place.googlePlaceId,
    slug: existing?.slug ?? slugify(place.name),
    name: place.name,
    address: place.address,
    neighborhood: hood.name,
    lat: place.lat,
    lng: place.lng,
    geofenceMeters: existing?.geofenceMeters ?? 100,
    neighborhoodId: hood.id,
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
  const hoods = await loadNeighborhoods(db);
  const ids = google.map((place) => place.googlePlaceId);
  const stored = await db.venue.findMany({ where: { googlePlaceId: { in: ids } }, select: placeSelect });
  const byGoogle = new Map(stored.flatMap((row) => row.googlePlaceId ? [[row.googlePlaceId, row] as const] : []));
  return google.flatMap((place) => {
    const hood = locate(hoods, place.lat, place.lng);
    if (!hood) return [];
    return [discoveryView(place, hood, byGoogle.get(place.googlePlaceId))];
  });
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
 * Beli-style get-or-create: a Google place_id becomes a durable Nostos venue only when the user actually uses it.
 * Cuisine/category are snapshotted from Google's type data at that point.
 */
export async function resolveGoogleVenue(db: Db, googlePlaceId: string): Promise<PlaceView> {
  const already = await db.venue.findUnique({ where: { googlePlaceId }, select: placeSelect });
  if (already) return toView(already);

  const google = await googlePlaceDetails(googlePlaceId);
  const hood = locate(await loadNeighborhoods(db), google.lat, google.lng);
  if (!hood) throw badRequest("Nostos currently supports New York City restaurants and bars.", "unsupported_place");

  const old = await legacyMatch(db, google);
  const data = {
    name: google.name,
    address: google.address,
    neighborhood: hood.name,
    neighborhoodId: hood.id,
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

  if (old) return toView(await db.venue.update({ where: { id: old.id }, data, select: placeSelect }));
  const slug = await uniqueSlug(db, google.name, google.googlePlaceId);
  try {
    return toView(await db.venue.create({ data: { ...data, slug, geofenceMeters: 100 }, select: placeSelect }));
  } catch (error) {
    const raced = await db.venue.findUnique({ where: { googlePlaceId }, select: placeSelect });
    if (raced) return toView(raced);
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
