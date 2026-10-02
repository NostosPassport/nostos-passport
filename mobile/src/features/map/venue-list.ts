/** Sorting and searching the map's venue list. Pure; the numbers come from the API. */
import type { MapVenue } from "@/api/contracts";
import { distanceMeters, type Coords } from "@/lib/geo";

export type ListMode = "live" | "going" | "nearby";

export const LIST_MODES: { key: ListMode; label: string }[] = [
  { key: "live", label: "Live now" },
  { key: "going", label: "Going tonight" },
  { key: "nearby", label: "Nearby" },
];

const byName = (a: MapVenue, b: MapVenue) => a.name.localeCompare(b.name);

/**
 * Live now: the API's `activity` key. Going tonight: `goingTonight`. Nearby: distance from the user.
 * `promoted` never affects the order.
 */
export function sortVenues(venues: readonly MapVenue[], mode: ListMode, from: Coords | null): MapVenue[] {
  const list = [...venues];
  if (mode === "live") return list.sort((a, b) => b.activity - a.activity || b.vibeReports - a.vibeReports || byName(a, b));
  if (mode === "going") return list.sort((a, b) => b.goingTonight - a.goingTonight || b.friendsGoing - a.friendsGoing || byName(a, b));
  if (!from) return list.sort(byName);
  const d = new Map(list.map((v) => [v.id, distanceMeters(from, { lat: v.lat, lng: v.lng })]));
  return list.sort((a, b) => d.get(a.id)! - d.get(b.id)! || byName(a, b));
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .trim();
}

/** Client-side search over name, address and neighborhood (API.md: there is no search endpoint). */
export function searchVenues(venues: readonly MapVenue[], query: string): MapVenue[] {
  const q = normalize(query);
  if (!q) return [...venues];
  const words = q.split(/\s+/);
  const scored: { v: MapVenue; score: number }[] = [];
  for (const v of venues) {
    const name = normalize(v.name);
    const hay = `${name} ${normalize(v.address)} ${normalize(v.neighborhood)}`;
    if (!words.every((w) => hay.includes(w))) continue;
    const score = name.startsWith(q) ? 0 : name.includes(q) ? 1 : 2;
    scored.push({ v, score });
  }
  return scored.sort((a, b) => a.score - b.score || byName(a.v, b.v)).map((s) => s.v);
}

/** Venues with enough recent reports to show a vibe. */
export function liveCount(venues: readonly MapVenue[]): number {
  return venues.reduce((n, v) => n + (v.vibe === "NO_DATA" ? 0 : 1), 0);
}

export function summaryLine(venues: readonly MapVenue[]): string {
  const n = liveCount(venues);
  if (n === 0) return "No live reports nearby yet";
  return `${n} ${n === 1 ? "spot" : "spots"} live nearby`;
}
