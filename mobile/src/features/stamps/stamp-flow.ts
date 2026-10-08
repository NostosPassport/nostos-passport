/** Shared stamp-flow helpers. Verification is a positive signal, never a gate to creating a memory. */
import type { NearbyPlacesResponse } from "@/api/contracts";
import { formatDistance } from "@/lib/format";
import { placeDistanceLabel } from "./composer";

type Nearby = NearbyPlacesResponse["places"][number];
export const MAX_STAMP_PHOTOS = 6;

export const HONESTY = {
  title: "Verification is optional",
  body: "If you add a stamp while you're at the place and share your location, Nostos can mark that visit verified. You can always stamp without location.",
};

export const addPhoto = (uris: readonly string[], uri: string): string[] => (uris.length >= MAX_STAMP_PHOTOS ? [...uris] : [...uris, uri]);
export const removePhotoAt = (uris: readonly string[], index: number): string[] => uris.filter((_, i) => i !== index);
export const photosLeft = (uris: readonly string[]): number => Math.max(0, MAX_STAMP_PHOTOS - uris.length);
export const photoCount = (n: number): string => `${Math.min(n, MAX_STAMP_PHOTOS)} of ${MAX_STAMP_PHOTOS}`;

export function placeSections(places: readonly Nearby[]): { title: string; places: Nearby[] }[] {
  const here = places.filter((p) => p.inside);
  const near = places.filter((p) => !p.inside);
  return [
    ...(here.length > 0 ? [{ title: "Nearby · verified", places: here }] : []),
    ...(near.length > 0 ? [{ title: "Nearby", places: near }] : []),
  ];
}

export function placeRowText(p: Nearby): { title: string; subtitle: string; spoken: string } {
  const standing = placeDistanceLabel(p, formatDistance);
  return { title: p.name, subtitle: `${p.neighborhood} · ${standing}`, spoken: `${p.name}, ${standing}` };
}

export function stampReadiness(input: { problem: string | null; busy: boolean }): { ready: boolean; hint: string | null } {
  if (input.busy) return { ready: false, hint: null };
  if (input.problem) return { ready: false, hint: input.problem };
  return { ready: true, hint: null };
}
