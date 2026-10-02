/** The pure parts of the stamp composer: what's required, what's sent, what to say. The server decides everything else. */
import type { NearbyPlacesResponse, Song, StampEditRequest, StampView } from "@/api/contracts";
import type { Coords } from "@/lib/geo";

export const CAPTION_MAX = 280;

export type Draft = { photoUris: readonly string[]; caption: string; song: Song | null };

/** A stamp needs at least one of a photo, a caption (not just spaces) or a song. */
export function hasContent(d: Draft): boolean {
  return d.photoUris.length > 0 || d.caption.trim() !== "" || d.song !== null;
}

/** Why the Stamp button is off, or null when it's ready. `placeId` is the chosen place. */
export function stampProblem(d: Draft, placeId: string | null): string | null {
  if (!placeId) return "Choose where you are.";
  if (!hasContent(d)) return "Add a photo, a caption or a song.";
  if (d.caption.length > CAPTION_MAX) return `Keep the caption to ${CAPTION_MAX} characters.`;
  return null;
}

/** The multipart text fields for a stamp (the server reads numbers as strings). Empty parts are left out. */
export function stampFields(d: Pick<Draft, "caption" | "song">, coords: Coords): [string, string][] {
  const fields: [string, string][] = [
    ["lat", String(coords.lat)],
    ["lng", String(coords.lng)],
  ];
  if (d.caption.trim() !== "") fields.push(["caption", d.caption.trim()]);
  if (d.song) {
    fields.push(["songTitle", d.song.title], ["songArtist", d.song.artist]);
    if (d.song.artUrl) fields.push(["songArtUrl", d.song.artUrl]);
    if (d.song.sourceId) fields.push(["songSourceId", d.song.sourceId]);
  }
  return fields;
}

type Nearby = NearbyPlacesResponse["places"][number];

/** The place to pick without asking: exactly one place has you inside its geofence. */
export function autoPlace(places: readonly Nearby[]): Nearby | null {
  const inside = places.filter((p) => p.inside);
  return inside.length === 1 ? inside[0]! : null;
}

/** Inside places first (nearest first), then the ones close by. The list from the server is already nearest first. */
export function orderPlaces(places: readonly Nearby[]): Nearby[] {
  return [...places].sort((a, b) => Number(b.inside) - Number(a.inside) || a.distanceM - b.distanceM);
}

/** A place row's second line: "Inside" or the distance, via the shared formatter. */
export function placeDistanceLabel(p: Pick<Nearby, "inside" | "distanceM" | "geofenceMeters">, format: (m: number) => string): string {
  return p.inside ? "You're here" : `${format(p.distanceM)} away, need to be within ${format(p.geofenceMeters)}`;
}

/** The edit screen sends only the fields that changed (the server takes a partial update). A removed song is `null`. */
export function stampChanges(initial: Pick<StampView, "caption" | "song">, caption: string, song: Song | null): StampEditRequest {
  const out: StampEditRequest = {};
  if (caption.trim() !== initial.caption.trim()) out.caption = caption.trim();
  const before = initial.song;
  const same = (before === null && song === null) || (before !== null && song !== null && before.title === song.title && before.artist === song.artist && before.sourceId === song.sourceId);
  if (!same) out.song = song ? { title: song.title, artist: song.artist, artUrl: song.artUrl, sourceId: song.sourceId } : null;
  return out;
}

