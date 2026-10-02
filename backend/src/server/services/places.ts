/**
 * Places: name, location and geofence. No live data of any kind (no crowd, no reports, no counts of who is there).
 */
import type { Db } from "@/lib/db";
import { distanceMeters } from "@/lib/geo";
import { notFound } from "@/server/errors";
import { OSM_ATTRIBUTION } from "@/lib/osm";

const placeSelect = { id: true, slug: true, name: true, address: true, neighborhood: true, lat: true, lng: true, geofenceMeters: true, neighborhoodId: true, osmId: true } as const;
type PlaceRow = { id: string; slug: string; name: string; address: string; neighborhood: string; lat: number; lng: number; geofenceMeters: number; neighborhoodId: string | null; osmId: string | null };

export type PlaceView = {
  id: string;
  slug: string;
  name: string;
  address: string;
  neighborhood: string;
  lat: number;
  lng: number;
  geofenceMeters: number;
  /** The NYC neighborhood this place is in, when known. */
  neighborhoodId: string | null;
  /** Imported from OpenStreetMap (show "© OpenStreetMap contributors"). */
  fromOsm: boolean;
};

const toView = ({ osmId, ...p }: PlaceRow): PlaceView => ({ ...p, fromOsm: osmId !== null });

/** ODbL attribution to show with a place list, when any place in it came from OpenStreetMap. */
export const attributionFor = (places: readonly { fromOsm: boolean }[]) => (places.some((p) => p.fromOsm) ? OSM_ATTRIBUTION : null);

export async function listPlaces(db: Db): Promise<PlaceView[]> {
  return (await db.venue.findMany({ orderBy: { name: "asc" }, select: placeSelect })).map(toView);
}

/**
 * Places near a position, nearest first, within `radiusM` (default 300 m: inside or close to the geofence). The server
 * recomputes the geofence again when a stamp is submitted; this list is only a convenience. The caller's own
 * position is used for the distance and never stored.
 */
export async function nearbyPlaces(db: Db, pos: { lat: number; lng: number }, radiusM = 300, limit = 20) {
  const all = await db.venue.findMany({ select: placeSelect });
  return all
    .map((p) => ({ ...toView(p), distanceM: Math.round(distanceMeters(pos, p)) }))
    .filter((p) => p.distanceM <= Math.max(radiusM, p.geofenceMeters))
    .sort((a, b) => a.distanceM - b.distanceM || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((p) => ({ ...p, inside: p.distanceM <= p.geofenceMeters }));
}

/** A place by id or slug. */
export async function getPlace(db: Db, key: string): Promise<PlaceView> {
  const p = await db.venue.findFirst({ where: { OR: [{ id: key }, { slug: key }] }, select: placeSelect });
  if (!p) throw notFound("Place not found");
  return toView(p);
}
