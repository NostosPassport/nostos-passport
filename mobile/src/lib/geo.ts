import type { Region } from "react-native-maps";

/** East Village and Lower East Side, framed for a portrait phone. */
export const HOME_REGION: Region = {
  latitude: 40.7222,
  longitude: -73.9855,
  latitudeDelta: 0.026,
  longitudeDelta: 0.018,
};

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
