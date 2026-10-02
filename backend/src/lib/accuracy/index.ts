/**
 * Venue accuracy score. Pure: no DB, no clock.
 *
 * For each completed clock-hour window fully inside the last 30 days, a window qualifies when it holds cover
 * reports from >= 3 distinct users. Only each user's newest report in the window counts, so 3 distinct users is
 * the binding condition and also implies >= 3 reports. The window's user consensus is the reputation-weighted
 * median of those reports (the same median as the live consensus, without time decay).
 * The score only starts counting once the venue has stated a cover. Windows that end at or before the first
 * non-null official cover in the history are skipped, and a window straddling that moment is judged only on
 * the part after it. A venue that has never stated a cover gets status "no_official_cover", not a score.
 * From the first stated cover on, a window matches only when *every* official cover in effect during
 * that (part of the) hour is within $2 of the consensus. An unstated (null) or missing official cover never
 * matches. So a venue can't dodge the score: clearing its cover or changing it mid-hour can only count
 * against it, never remove the window.
 * Score = round(100 x matching / qualifying). Below 5 qualifying windows the score is "not enough data".
 *
 * Hour windows are aligned to UTC hours. America/New_York offsets are whole hours, so these are
 * also local clock hours.
 */
import { clampReputation, weightedMedian } from "@/lib/consensus";

export const ACCURACY_LOOKBACK_MS = 30 * 24 * 60 * 60_000;
export const ACCURACY_WINDOW_MS = 60 * 60_000;
export const ACCURACY_MIN_USERS = 3;
export const ACCURACY_MIN_REPORTS = 3;
export const ACCURACY_TOLERANCE_CENTS = 200;
export const ACCURACY_MIN_WINDOWS = 5;

export type CoverReportInput = { userId: string; coverCents: number; createdAt: Date; reputation: number };
export type CoverHistoryInput = { coverCents: number | null; effectiveFrom: Date };

export type AccuracyWindow = { start: Date; officialCents: (number | null)[]; consensusCents: number; users: number; match: boolean };

export type AccuracyResult =
  | { status: "ok"; scorePct: number; qualifyingWindows: number; matchingWindows: number; windows: AccuracyWindow[] }
  | { status: "insufficient"; qualifyingWindows: number; matchingWindows: number; windows: AccuracyWindow[] }
  | { status: "no_official_cover"; qualifyingWindows: 0; matchingWindows: 0; windows: [] };

/** When the venue first stated a (non-null) official cover, or null if it never has. */
export function firstStatedCoverAt(history: readonly CoverHistoryInput[]): number | null {
  let first: number | null = null;
  for (const h of history) {
    if (h.coverCents === null) continue;
    const ts = h.effectiveFrom.getTime();
    if (first === null || ts < first) first = ts;
  }
  return first;
}

/** Official cover in effect at instant t (the latest history row with effectiveFrom <= t). undefined = none yet. */
export function officialCoverAt(history: readonly CoverHistoryInput[], t: number): number | null | undefined {
  let best: CoverHistoryInput | undefined;
  for (const h of history) {
    const ts = h.effectiveFrom.getTime();
    if (ts <= t && (!best || ts >= best.effectiveFrom.getTime())) best = h;
  }
  return best ? best.coverCents : undefined;
}

/** Every official cover value in effect at some point during [start, end). */
export function officialCoversDuring(history: readonly CoverHistoryInput[], start: number, end: number): (number | null)[] {
  const values: (number | null)[] = [];
  const atStart = officialCoverAt(history, start);
  if (atStart !== undefined) values.push(atStart);
  for (const h of history) {
    const ts = h.effectiveFrom.getTime();
    if (ts > start && ts < end) values.push(h.coverCents);
  }
  return values;
}

export function computeAccuracy(input: {
  reports: readonly CoverReportInput[];
  history: readonly CoverHistoryInput[];
  now: Date;
}): AccuracyResult {
  const now = input.now.getTime();
  const since = now - ACCURACY_LOOKBACK_MS;
  const firstStated = firstStatedCoverAt(input.history);
  if (firstStated === null) return { status: "no_official_cover", qualifyingWindows: 0, matchingWindows: 0, windows: [] };

  // Bucket reports by clock hour; keep the newest report per user per bucket. Only completed hours that
  // start inside the lookback count, so a window can't qualify and then flip while the hour is still running.
  const buckets = new Map<number, Map<string, CoverReportInput>>();
  for (const r of input.reports) {
    const t = r.createdAt.getTime();
    const start = Math.floor(t / ACCURACY_WINDOW_MS) * ACCURACY_WINDOW_MS;
    if (start < since || start + ACCURACY_WINDOW_MS > now) continue;
    const bucket = buckets.get(start) ?? new Map<string, CoverReportInput>();
    const prev = bucket.get(r.userId);
    if (!prev || t >= prev.createdAt.getTime()) bucket.set(r.userId, r);
    buckets.set(start, bucket);
  }

  const windows: AccuracyWindow[] = [];
  for (const [start, byUser] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    if (byUser.size < ACCURACY_MIN_USERS || byUser.size < ACCURACY_MIN_REPORTS) continue;
    const end = start + ACCURACY_WINDOW_MS;
    if (end <= firstStated) continue; // before the venue ever posted a cover: nothing to be accurate about
    const officials = officialCoversDuring(input.history, Math.max(start, firstStated), end);
    const consensus = weightedMedian([...byUser.values()].map((r) => ({ value: r.coverCents, weight: clampReputation(r.reputation) })));
    if (consensus == null) continue;
    windows.push({
      start: new Date(start),
      officialCents: officials,
      consensusCents: consensus,
      users: byUser.size,
      match: officials.length > 0 && officials.every((o) => o != null && Math.abs(consensus - o) <= ACCURACY_TOLERANCE_CENTS),
    });
  }

  const matching = windows.filter((w) => w.match).length;
  if (windows.length < ACCURACY_MIN_WINDOWS) {
    return { status: "insufficient", qualifyingWindows: windows.length, matchingWindows: matching, windows };
  }
  return {
    status: "ok",
    scorePct: Math.round((100 * matching) / windows.length),
    qualifyingWindows: windows.length,
    matchingWindows: matching,
    windows,
  };
}
