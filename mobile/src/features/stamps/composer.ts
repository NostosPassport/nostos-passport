import type { NearbyPlacesResponse, Song, StampEditRequest, StampView } from "@/api/contracts";
import { michelinPreviewDraft } from "@/features/stamps/michelin-preview";
import type { Coords } from "@/lib/geo";

export const CAPTION_MAX = 280;
export type StampMode = "now" | "past";
export type Draft = { photoUris: readonly string[]; caption: string; song: Song | null };

export function hasContent(d: Draft): boolean {
  return d.photoUris.length > 0 || d.caption.trim() !== "" || d.song !== null;
}

export function stampProblem(d: Draft, placeId: string | null): string | null {
  if (!placeId) return "Choose a place.";
  if (!hasContent(d)) return "Add a photo, a caption or a song.";
  if (d.caption.length > CAPTION_MAX) return `Keep the caption to ${CAPTION_MAX} characters.`;
  return null;
}

export function stampFields(
  d: Pick<Draft, "caption" | "song">,
  mode: StampMode,
  visitedAt: Date,
  coords: Coords | null,
): [string, string][] {
  const fields: [string, string][] = [["mode", mode]];
  if (mode === "past") fields.push(["visitedAt", visitedAt.toISOString()]);
  if (mode === "now" && coords) fields.push(["lat", String(coords.lat)], ["lng", String(coords.lng)]);
  if (d.caption.trim() !== "") fields.push(["caption", d.caption.trim()]);
  if (d.song) {
    fields.push(["songTitle", d.song.title], ["songArtist", d.song.artist]);
    if (d.song.artUrl) fields.push(["songArtUrl", d.song.artUrl]);
    if (d.song.sourceId) fields.push(["songSourceId", d.song.sourceId]);
  }
  const michelinProof = michelinPreviewDraft.proof();
  if (michelinProof) fields.push(["michelinProof", michelinProof]);
  return fields;
}

type Nearby = NearbyPlacesResponse["places"][number];
export function orderPlaces(places: readonly Nearby[]): Nearby[] {
  return [...places].sort((a, b) => Number(b.inside) - Number(a.inside) || a.distanceM - b.distanceM);
}
export function placeDistanceLabel(p: Pick<Nearby, "inside" | "distanceM">, format: (m: number) => string): string {
  return p.inside ? "Visit can be verified" : `${format(p.distanceM)} away`;
}

export function stampChanges(initial: Pick<StampView, "caption" | "song" | "visitedAt">, caption: string, song: Song | null, visitedAt: Date): StampEditRequest {
  const out: StampEditRequest = {};
  if (caption.trim() !== initial.caption.trim()) out.caption = caption.trim();
  const before = initial.song;
  const same = (before === null && song === null) || (before !== null && song !== null && before.title === song.title && before.artist === song.artist && before.sourceId === song.sourceId);
  if (!same) out.song = song ? { title: song.title, artist: song.artist, artUrl: song.artUrl, sourceId: song.sourceId } : null;
  if (new Date(initial.visitedAt).getTime() !== visitedAt.getTime()) out.visitedAt = visitedAt.toISOString();
  return out;
}
