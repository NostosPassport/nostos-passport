import type { UserPlacesResponse } from "@/api/contracts";

type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

const MIN_DELTA = 0.01;
const PAD = 0.4;

export function placesRegion(places: UserPlacesResponse["places"]): Region | null {
  if (places.length === 0) return null;
  const lats = places.map((p) => p.place.lat);
  const lngs = places.map((p) => p.place.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(MIN_DELTA, (maxLat - minLat) * (1 + PAD)),
    longitudeDelta: Math.max(MIN_DELTA, (maxLng - minLng) * (1 + PAD)),
  };
}
