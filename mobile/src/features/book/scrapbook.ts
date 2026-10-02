/** The scrapbook page of a visa spread: up to six photos, laid out by default and rearranged by the owner. */
import type { PhotoLayoutRequest, StampPhotoView } from "@/api/contracts";
import { seeded } from "@/lib/rng";

export type PhotoSpot = { x: number; y: number; rotation: number };

/** Centers as shares of the page, by how many photos there are. */
const BASE: Record<number, readonly (readonly [number, number])[]> = {
  0: [],
  1: [[0.5, 0.5]],
  2: [[0.5, 0.3], [0.5, 0.7]],
  3: [[0.5, 0.22], [0.5, 0.5], [0.5, 0.78]],
  4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
  5: [[0.3, 0.22], [0.7, 0.22], [0.5, 0.5], [0.3, 0.78], [0.7, 0.78]],
  6: [[0.3, 0.2], [0.7, 0.2], [0.3, 0.5], [0.7, 0.5], [0.3, 0.8], [0.7, 0.8]],
};

/** Edge length of one photo, as a share of the page width. */
export function photoShare(count: number): number {
  return [0, 0.66, 0.5, 0.4, 0.4, 0.34, 0.34][Math.max(0, Math.min(6, count))] ?? 0.34;
}

/** Where `count` photos go before anyone has moved them. A little jitter, the same every time for the same seed. */
export function defaultScrapbook(count: number, seed: string): PhotoSpot[] {
  const n = Math.max(0, Math.min(6, count));
  const rng = seeded(`scrapbook:${seed}`);
  return BASE[n]!.map(([x, y]) => ({ x: x + rng.range(-0.02, 0.02), y: y + rng.range(-0.015, 0.015), rotation: rng.range(-6, 6) }));
}

/** Each photo's place: where the owner left it, or the default for photos never moved. In page order (position). */
export function resolveLayout(photos: readonly StampPhotoView[], seed: string): { photo: StampPhotoView; spot: PhotoSpot }[] {
  const ordered = [...photos].sort((a, b) => a.position - b.position);
  const defaults = defaultScrapbook(ordered.length, seed);
  return ordered.map((photo, i) => ({
    photo,
    spot: photo.x !== null && photo.y !== null ? { x: photo.x, y: photo.y, rotation: photo.rotation ?? defaults[i]!.rotation } : defaults[i]!,
  }));
}

/** Drag a photo to the top: it gets the last position and the others close ranks. */
export function bringToFront<T extends { id: string }>(items: readonly T[], id: string): T[] {
  const rest = items.filter((p) => p.id !== id);
  const moved = items.find((p) => p.id === id);
  return moved ? [...rest, moved] : [...items];
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const unit = (n: number) => Math.min(1, Math.max(0, n));

/** The PATCH body that saves a layout: position is the order in the list, x and y are shares of the page. */
export function layoutRequest(items: readonly { id: string; spot: PhotoSpot }[]): PhotoLayoutRequest {
  return { photos: items.map((it, position) => ({ id: it.id, position, x: r3(unit(it.spot.x)), y: r3(unit(it.spot.y)), rotation: r3(Math.min(45, Math.max(-45, it.spot.rotation))) })) };
}
