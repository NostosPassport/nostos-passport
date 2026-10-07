/** The pure parts of the stamp flow beyond the composer's rules: the photo cap, the place list, the calm "not there yet" state, the honesty note. */
import type { NearbyPlacesResponse } from "@/api/contracts";
import { formatDistance } from "@/lib/format";
import { placeDistanceLabel } from "./composer";

type Nearby = NearbyPlacesResponse["places"][number];

export const MAX_STAMP_PHOTOS = 6;

/**
 * What the app says about location, and it has to be true: the phone's position is checked by the server when you stamp and is saved
 * with the stamp (that is how the check can be audited); it is never shown in the app. Whether this wording is enough for a privacy
 * policy is a legal question (OPEN-QUESTIONS).
 */
export const HONESTY = {
  title: "Stamps only count where you really are",
  body: "When you stamp, our server checks where your phone is. That position is saved with the stamp and is never shown in the app.",
};

/** Add an approved photo, up to six. Past six the list is returned as it was. */
export const addPhoto = (uris: readonly string[], uri: string): string[] => (uris.length >= MAX_STAMP_PHOTOS ? [...uris] : [...uris, uri]);
export const removePhotoAt = (uris: readonly string[], index: number): string[] => uris.filter((_, i) => i !== index);
export const photosLeft = (uris: readonly string[]): number => Math.max(0, MAX_STAMP_PHOTOS - uris.length);

/** "n of 6" for the photo flow and strip. */
export const photoCount = (n: number): string => `${Math.min(n, MAX_STAMP_PHOTOS)} of ${MAX_STAMP_PHOTOS}`;

/** The places list split into "Here" (you're inside the geofence) and "Nearby" (close, not inside yet); empty groups are left out. */
export function placeSections(places: readonly Nearby[]): { title: string; places: Nearby[] }[] {
  const here = places.filter((p) => p.inside);
  const near = places.filter((p) => !p.inside);
  return [
    ...(here.length > 0 ? [{ title: "Here", places: here }] : []),
    ...(near.length > 0 ? [{ title: "Nearby", places: near }] : []),
  ];
}

/** One place row's lines: its name, then the neighborhood and how you stand. Distances over a kilometer are in km. */
export function placeRowText(p: Nearby): { title: string; subtitle: string; spoken: string } {
  const standing = placeDistanceLabel(p, formatDistance);
  return { title: p.name, subtitle: `${p.neighborhood} · ${standing}`, spoken: `${p.name}, ${standing}` };
}

/**
 * When the chosen place is outside its geofence the button is off, and the screen says so gently: no alarm, just how far you are
 * and what to do. Null when you're inside (or have chosen nothing).
 */
export function calmState(place: Nearby | null): { title: string; body: string } | null {
  if (!place || place.inside) return null;
  return {
    title: "Not quite there yet",
    body: `You're ${formatDistance(place.distanceM)} from ${place.name}. Stamping opens when you're within ${formatDistance(place.geofenceMeters)}.`,
  };
}

/** Whether the Stamp button is on, and if not, the one thing to say. The calm state wins over a missing caption: get there first. */
export function stampReadiness(input: { place: Nearby | null; problem: string | null; busy: boolean }): { ready: boolean; hint: string | null; calm: ReturnType<typeof calmState> } {
  const calm = calmState(input.place);
  if (input.busy) return { ready: false, hint: null, calm };
  if (calm) return { ready: false, hint: null, calm };
  if (input.problem) return { ready: false, hint: input.problem, calm: null };
  return { ready: true, hint: null, calm: null };
}
