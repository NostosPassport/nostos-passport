/**
 * "Regular at ___": a person is a Regular at a venue when they have posts there on at least 3 different nights
 * within the last 60 days (tonight and the 59 before it). Computed from posts every time (never stored or
 * editable), like the accuracy score. Only posts count (rated photos), and only visible ones: hidden, removed and
 * App Review posts don't.
 *
 * A "night" is a separate visit: a post only opens a new night if it's on a different night *and* at least 12 hours
 * after the last counted one. Otherwise one visit spanning 5am (a post at 4:50am and another at 5:06am, 16 minutes
 * apart) would count as two nights.
 */
import { addNights, HOUR_MS, nightKey } from "@/lib/time";

export { addNights };

export const REGULAR_MIN_NIGHTS = 3;
export const REGULAR_WINDOW_DAYS = 60;
/** Two counted nights must be at least this far apart (one visit can't straddle 5am into two nights). */
export const REGULAR_MIN_GAP_MS = 12 * HOUR_MS;

/** The earliest night in the window ending tonight: exactly 60 nights, tonight included. */
export function regularWindowStart(now: Date): string {
  return addNights(nightKey(now), -(REGULAR_WINDOW_DAYS - 1));
}

type PostRow = { userId: string; venueId: string; night: string; createdAt: Date };

/** Separate nights (visits) among one person's posts at one venue, inside the window. */
export function countVisits(rows: readonly PostRow[], now: Date): number {
  const from = regularWindowStart(now);
  const today = nightKey(now);
  const inWindow = rows.filter((r) => r.night >= from && r.night <= today).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const nights = new Set<string>();
  let last: Date | null = null;
  for (const r of inWindow) {
    if (nights.has(r.night)) continue;
    if (last && r.createdAt.getTime() - last.getTime() < REGULAR_MIN_GAP_MS) continue;
    nights.add(r.night);
    last = r.createdAt;
  }
  return nights.size;
}

/** "userId:venueId" for every Regular pair among the rows. */
export function regularPairs(rows: readonly PostRow[], now: Date): Set<string> {
  const groups = new Map<string, PostRow[]>();
  for (const r of rows) {
    const key = `${r.userId}:${r.venueId}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return new Set([...groups].filter(([, g]) => countVisits(g, now) >= REGULAR_MIN_NIGHTS).map(([k]) => k));
}
