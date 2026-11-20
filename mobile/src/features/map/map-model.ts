import type { Place, UserPlacesResponse } from "@/api/contracts";
import { visaStamp } from "@/features/book/visa";
import { distanceMeters, NEIGHBOURHOOD_SPAN, type Coords } from "@/lib/geo";
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

/**
 * The region for "show me where I am": centred on the user, keeping the current zoom only when it is already tighter
 * than a neighbourhood, so re-centring after a country-wide fit doesn't stay zoomed out (P-055).
 */
export function userRegion(here: Coords, current: MapRegion | null): MapRegion {
  return {
    latitude: here.lat,
    longitude: here.lng,
    latitudeDelta: Math.min(current?.latitudeDelta ?? Infinity, NEIGHBOURHOOD_SPAN.latitudeDelta),
    longitudeDelta: Math.min(current?.longitudeDelta ?? Infinity, NEIGHBOURHOOD_SPAN.longitudeDelta),
  };
}

type VisitedRow = UserPlacesResponse["places"][number];
export type PinGroup<Row extends VisitedRow = VisitedRow> = { key: string; latitude: number; longitude: number; members: Row[] };

/** Members closer than this (about 30 m) share a spot: zooming in will never pull them apart. */
const SAME_SPOT_DEGREES = 0.0003;

/**
 * A light, dependency-free stand-in for clustering (P-052). Pins whose markers would overlap at the current zoom
 * (closer than `markerPt` on screen) merge into one pin with a count. Grouping is greedy in a stable order, and a
 * group's key is its members' ids, so markers remount only when the grouping itself changes. Before the frame has a
 * size, only pins on the same spot are merged.
 */
export function groupPins<Row extends VisitedRow>(rows: readonly Row[], region: MapRegion, frame: { width: number; height: number }, markerPt: number): PinGroup<Row>[] {
  const latStep = frame.height > 0 ? (region.latitudeDelta * markerPt) / frame.height : SAME_SPOT_DEGREES;
  const lngStep = frame.width > 0 ? (region.longitudeDelta * markerPt) / frame.width : SAME_SPOT_DEGREES;
  const sorted = [...rows].sort((a, b) => (a.place.id < b.place.id ? -1 : a.place.id > b.place.id ? 1 : 0));
  const groups: { latitude: number; longitude: number; members: Row[] }[] = [];
  for (const row of sorted) {
    const { lat, lng } = row.place;
    const near = groups.find((g) => Math.abs(g.latitude - lat) <= latStep && Math.abs(g.longitude - lng) <= lngStep);
    if (near) near.members.push(row);
    else groups.push({ latitude: lat, longitude: lng, members: [row] });
  }
  return groups.map((g) => ({
    key: g.members.map((m) => m.place.id).join("+"),
    latitude: g.members.reduce((sum, m) => sum + m.place.lat, 0) / g.members.length,
    longitude: g.members.reduce((sum, m) => sum + m.place.lng, 0) / g.members.length,
    members: g.members,
  }));
}

/** True when a group's places sit on (practically) one spot, so a tap should list them instead of zooming. */
export function isSameSpot(members: readonly VisitedRow[]): boolean {
  const lats = members.map((m) => m.place.lat);
  const lngs = members.map((m) => m.place.lng);
  return Math.max(...lats) - Math.min(...lats) <= SAME_SPOT_DEGREES && Math.max(...lngs) - Math.min(...lngs) <= SAME_SPOT_DEGREES;
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
