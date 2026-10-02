type Sortable = { activity: number; goingTonight: number; name: string; lat: number; lng: number };

export type SortKey = "activity" | "going" | "distance";

/** Sorting for the bottom sheet. Ties fall back to name so the order is stable. Promotion is never a key. */
export function sortVenues<T extends Sortable>(
  venues: readonly T[],
  key: SortKey,
  from?: { lat: number; lng: number } | null,
  distance?: (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => number,
): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  const list = [...venues];
  if (key === "activity") return list.sort((a, b) => b.activity - a.activity || byName(a, b));
  if (key === "going") return list.sort((a, b) => b.goingTonight - a.goingTonight || byName(a, b));
  if (!from || !distance) return list.sort(byName);
  return list.sort((a, b) => distance(from, a) - distance(from, b) || byName(a, b));
}

