import type { UserPlacesResponse } from "@/api/contracts";

type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

/** Smallest span shown, so a single place isn't zoomed in to one building. */
const MIN_DELTA = 0.01;
/** Padding around the outermost places, as a share of the span. */
const PAD = 0.4;

/** A map region that frames every place (null when there are none). */
export function placesRegion(places: UserPlacesResponse["places"]): Region | null {
  if (places.length === 0) return null;
  const lats = places.map((p) => p.venue.lat);
  const lngs = places.map((p) => p.venue.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(MIN_DELTA, (maxLat - minLat) * (1 + PAD)),
    longitudeDelta: Math.max(MIN_DELTA, (maxLng - minLng) * (1 + PAD)),
  };
}
