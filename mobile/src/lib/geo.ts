import type { Region } from "react-native-maps";

/**
 * Where the map opens when there is nothing better: no stamps and no location. Places are worldwide, so this is a
 * neutral wide view rather than any one city (P-058). The map prefers the visited places' region, then the user.
 */
export const DEFAULT_REGION: Region = {
  latitude: 30,
  longitude: -30,
  latitudeDelta: 90,
  longitudeDelta: 120,
};

/** A neighbourhood-sized span, framed for a portrait phone. Re-centring on the user never stays wider (P-055). */
export const NEIGHBOURHOOD_SPAN = { latitudeDelta: 0.026, longitudeDelta: 0.018 } as const;

export type Coords = { lat: number; lng: number };

/**
 * Great-circle distance in meters. Only used for "moved enough to re-ping presence" and the
 * Nearby sort; the geofence decision is always the server's.
 */
export function distanceMeters(a: Coords, b: Coords): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
