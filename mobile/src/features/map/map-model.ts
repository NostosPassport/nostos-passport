import type { Place, UserPlacesResponse } from "@/api/contracts";
import { visaStamp } from "@/features/book/visa";
import { distanceMeters, type Coords } from "@/lib/geo";
import { localityLabel } from "@/lib/place";

export type MapRegion = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
export type PlaceStat = { stamps: number; latestAt: string; timeZone: string };

export function statsByPlace(userPlaces: UserPlacesResponse["places"]): Map<string, PlaceStat> {
  return new Map(userPlaces.map((u) => [u.place.id, { stamps: u.stamps, latestAt: u.latestStamp.visitedAt, timeZone: u.place.timeZone }]));
}

export type PinKind = "lit" | "dim";
export const pinKind = (placeId: string, stats: ReadonlyMap<string, PlaceStat>): PinKind => (stats.has(placeId) ? "lit" : "dim");
const MAX_PINS = 250;

export function visiblePlaces(places: readonly Place[], region: MapRegion, stats: ReadonlyMap<string, PlaceStat>, selectedId: string | null, max = MAX_PINS): Place[] {
  const padLat = region.latitudeDelta * 0.6;
  const padLng = region.longitudeDelta * 0.6;
  const inView = places.filter((p) => p.id === selectedId || (Math.abs(p.lat - region.latitude) <= padLat && Math.abs(p.lng - region.longitude) <= padLng));
  const centre = { lat: region.latitude, lng: region.longitude };
  const ranked = inView.map((p) => ({ p, lit: stats.has(p.id), selected: p.id === selectedId, d: distanceMeters(centre, { lat: p.lat, lng: p.lng }) })).sort((a, b) => Number(b.selected) - Number(a.selected) || Number(b.lit) - Number(a.lit) || a.d - b.d);
  return ranked.slice(0, max).map((r) => r.p);
}

export type SheetModel = {
  title: string;
  subtitle: string;
  status: string;
  distance: string | null;
  canVerify?: boolean;
  canStamp?: boolean;
};

export function sheetModel(place: Place, stat: PlaceStat | undefined, here: Coords | null, format: (m: number) => string): SheetModel {
  const meters = here ? distanceMeters(here, { lat: place.lat, lng: place.lng }) : null;
  const status = stat ? `Stamped ${stat.stamps === 1 ? "once" : `${stat.stamps} times`}. Last on ${visaStamp(stat.latestAt, stat.timeZone).date}.` : "Not stamped yet.";
  const cuisine = place.cuisines.slice(0, 2).join(" · ");
  return { title: place.name, subtitle: [cuisine, localityLabel(place), place.address].filter(Boolean).join(" · "), status, distance: meters === null ? null : `${format(meters)} away`, canVerify: meters !== null && meters <= place.geofenceMeters };
}

export function sheetShouldClose(translationY: number, velocityY: number, sheetHeight: number): boolean {
  return translationY > sheetHeight * 0.35 || velocityY > 800;
}
