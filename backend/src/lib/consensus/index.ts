/**
 * Consensus engine. Pure functions only: no DB, no clock. Callers pass `now` and pre-filtered reports
 * (hidden/moderated reports are excluded by the caller).
 *
 * Model
 *   weight(report) = reputation(author) x decay(age)
 *   decay(age)     = 0.5 ^ (age / 30 min), and 0 once age >= 3 h (the live window is the half-open interval (now-3h, now])
 *   vibe, line     = weighted mode
 *   cover          = weighted median (cents)
 *   Only each user's newest report per metric counts, so one person re-reporting every 15 minutes
 *   cannot outvote a crowd. Reports stamped after `now` are ignored, which also lets the reputation job
 *   replay the past.
 *   A value is shown only if the last hour, (now-1h, now], holds >= 2 reports from >= 2 distinct users.
 */
import type { LineWait, Vibe } from "@prisma/client";

export const HALF_LIFE_MS = 30 * 60_000;
export const MAX_AGE_MS = 3 * 60 * 60_000;
export const MIN_DATA_WINDOW_MS = 60 * 60_000;
export const MIN_REPORTS = 2;
export const MIN_DISTINCT_USERS = 2;

export const REPUTATION_MIN = 0.2;
export const REPUTATION_MAX = 1.5;
export const REPUTATION_NEW = 0.5;

/** Ordered scales (most to least, and shortest to longest) used for tie-breaks and "adjacent" agreement. */
export const VIBE_SCALE: readonly Vibe[] = ["PACKED", "BUSY", "CHILL", "DEAD"];
export const LINE_SCALE: readonly LineWait[] = ["NONE", "UNDER_10", "TEN_TO_30", "OVER_30"];

export type ConsensusReport<T> = {
  userId: string;
  value: T;
  createdAt: Date;
  /** Author's reputation weight. Out-of-range values are clamped to [0.2, 1.5]. */
  reputation: number;
};

/** reportCount = live reports in the last 3h; userCount = distinct reporters (only their newest report is weighted). */
export type Consensus<T> =
  | { status: "ok"; value: T; reportCount: number; userCount: number; newestAt: Date; totalWeight: number }
  | { status: "insufficient"; reportCount: number; userCount: number; newestAt: Date | null };

export function clampReputation(r: number): number {
  if (!Number.isFinite(r)) return REPUTATION_NEW;
  return Math.min(REPUTATION_MAX, Math.max(REPUTATION_MIN, r));
}

/** Exponential decay with a 30-minute half-life; zero at 3 hours and beyond, and for future timestamps. */
export function decayWeight(ageMs: number): number {
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs >= MAX_AGE_MS) return 0;
  return Math.pow(0.5, ageMs / HALF_LIFE_MS);
}

export function reportWeight(r: { createdAt: Date; reputation: number }, now: Date): number {
  return clampReputation(r.reputation) * decayWeight(now.getTime() - r.createdAt.getTime());
}

/** Reports in the live window (now-3h, now]. */
export function liveReports<T>(reports: readonly ConsensusReport<T>[], now: Date): ConsensusReport<T>[] {
  const t = now.getTime();
  return reports.filter((r) => {
    const age = t - r.createdAt.getTime();
    return age >= 0 && age < MAX_AGE_MS;
  });
}

/** Each user's newest report. Ties on timestamp keep the later one in input order. */
export function latestPerUser<T>(reports: readonly ConsensusReport<T>[]): ConsensusReport<T>[] {
  const byUser = new Map<string, ConsensusReport<T>>();
  for (const r of reports) {
    const prev = byUser.get(r.userId);
    if (!prev || r.createdAt.getTime() >= prev.createdAt.getTime()) byUser.set(r.userId, r);
  }
  return [...byUser.values()];
}

/** The "not enough data" floor: >= 2 reports from >= 2 distinct users within (now-1h, now]. */
export function hasEnoughData(reports: readonly { userId: string; createdAt: Date }[], now: Date): boolean {
  const t = now.getTime();
  const recent = reports.filter((r) => {
    const age = t - r.createdAt.getTime();
    return age >= 0 && age < MIN_DATA_WINDOW_MS;
  });
  return recent.length >= MIN_REPORTS && new Set(recent.map((r) => r.userId)).size >= MIN_DISTINCT_USERS;
}

type Weighted<T> = { value: T; weight: number; createdAt: Date };

/**
 * Weighted mode. Tie-break: the tied value with the most recent report wins. If that also ties, the value
 * earlier in `scale` wins, so the result is deterministic.
 */
export function weightedMode<T>(items: readonly Weighted<T>[], scale: readonly T[]): T | null {
  const totals = new Map<T, { w: number; newest: number }>();
  for (const it of items) {
    if (!(it.weight > 0)) continue;
    const cur = totals.get(it.value) ?? { w: 0, newest: -Infinity };
    cur.w += it.weight;
    cur.newest = Math.max(cur.newest, it.createdAt.getTime());
    totals.set(it.value, cur);
  }
  let best: { value: T; w: number; newest: number } | null = null;
  const EPS = 1e-12;
  for (const [value, { w, newest }] of totals) {
    if (
      !best ||
      w > best.w + EPS ||
      (Math.abs(w - best.w) <= EPS &&
        (newest > best.newest || (newest === best.newest && scale.indexOf(value) < scale.indexOf(best.value))))
    ) {
      best = { value, w, newest };
    }
  }
  return best ? best.value : null;
}

/**
 * Weighted median of integer values. It is the smallest value whose cumulative weight reaches half the
 * total. When the cumulative weight lands exactly on the halfway point, it averages that value with the
 * next one (the textbook even-count median) and rounds to the cent.
 */
export function weightedMedian(items: readonly { value: number; weight: number }[]): number | null {
  const xs = items.filter((i) => i.weight > 0 && Number.isFinite(i.value)).sort((a, b) => a.value - b.value);
  if (!xs.length) return null;
  const total = xs.reduce((s, i) => s + i.weight, 0);
  const half = total / 2;
  const EPS = 1e-9 * total;
  let cum = 0;
  for (let i = 0; i < xs.length; i++) {
    cum += xs[i]!.weight;
    if (Math.abs(cum - half) <= EPS && i + 1 < xs.length) return Math.round((xs[i]!.value + xs[i + 1]!.value) / 2);
    if (cum > half) return xs[i]!.value;
  }
  return xs[xs.length - 1]!.value;
}

function summarize<T>(reports: readonly ConsensusReport<T>[], now: Date) {
  const live = liveReports(reports, now);
  // Canonical order so floating-point sums (and therefore the result) don't depend on input order.
  const counted = latestPerUser(live).sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));
  const newestAt = live.reduce<Date | null>((m, r) => (!m || r.createdAt > m ? r.createdAt : m), null);
  const weighted = counted.map((r) => ({ value: r.value, createdAt: r.createdAt, weight: reportWeight(r, now) }));
  return { live, counted, newestAt, weighted, enough: hasEnoughData(live, now) };
}

function categorical<T>(reports: readonly ConsensusReport<T>[], now: Date, scale: readonly T[]): Consensus<T> {
  const s = summarize(reports, now);
  const base = { reportCount: s.live.length, userCount: s.counted.length, newestAt: s.newestAt };
  const value = s.enough ? weightedMode(s.weighted, scale) : null;
  if (value === null || !s.newestAt) return { status: "insufficient", ...base };
  return { status: "ok", value, ...base, newestAt: s.newestAt, totalWeight: s.weighted.reduce((a, b) => a + b.weight, 0) };
}

export function vibeConsensus(reports: readonly ConsensusReport<Vibe>[], now: Date): Consensus<Vibe> {
  return categorical(reports, now, VIBE_SCALE);
}

export function lineConsensus(reports: readonly ConsensusReport<LineWait>[], now: Date): Consensus<LineWait> {
  return categorical(reports, now, LINE_SCALE);
}

export function coverConsensus(reports: readonly ConsensusReport<number>[], now: Date): Consensus<number> {
  const s = summarize(reports, now);
  const base = { reportCount: s.live.length, userCount: s.counted.length, newestAt: s.newestAt };
  const value = s.enough ? weightedMedian(s.weighted) : null;
  if (value === null || !s.newestAt) return { status: "insufficient", ...base };
  return { status: "ok", value, ...base, newestAt: s.newestAt, totalWeight: s.weighted.reduce((a, b) => a + b.weight, 0) };
}

/** Users and venue disagree on cover when the consensus differs from the official cover by more than this. */
export const COVER_MISMATCH_TOLERANCE_CENTS = 200;

export function coverMismatch(officialCents: number | null, consensus: Consensus<number>): boolean {
  return officialCents !== null && consensus.status === "ok" && Math.abs(consensus.value - officialCents) > COVER_MISMATCH_TOLERANCE_CENTS;
}

// ---------------------------------------------------------------------------------------------
// Reputation
// ---------------------------------------------------------------------------------------------

/** How long after a report we wait for the consensus "around it" to form before judging it. */
export const REPUTATION_SETTLE_MS = 30 * 60_000;
/** Shrinkage: with k=4, a user needs a real track record to move far from 0.5. */
export const REPUTATION_PRIOR_K = 4;

export type Verdict = "agree" | "disagree" | "neutral";

/**
 * Reputation from a track record. s = (agree - disagree) / (agree + disagree + k) lies in (-1, 1).
 * s >= 0 moves from 0.5 toward 1.5; s < 0 moves from 0.5 toward 0.2. No history gives exactly 0.5.
 */
export function reputationFromRecord(agree: number, disagree: number): number {
  const s = (agree - disagree) / (agree + disagree + REPUTATION_PRIOR_K);
  const r = s >= 0 ? REPUTATION_NEW + s * (REPUTATION_MAX - REPUTATION_NEW) : REPUTATION_NEW + s * (REPUTATION_NEW - REPUTATION_MIN);
  return clampReputation(r);
}

/** Ordinal agreement for vibe/line: same bucket agrees, a neighbouring bucket is neutral, and further apart disagrees. */
export function ordinalVerdict<T>(scale: readonly T[], mine: T, consensus: T): Verdict {
  const d = Math.abs(scale.indexOf(mine) - scale.indexOf(consensus));
  return d === 0 ? "agree" : d === 1 ? "neutral" : "disagree";
}

/** Cover agreement: within $2 agrees, more than $5 off disagrees, and anything between is neutral. */
export function coverVerdict(mine: number, consensus: number): Verdict {
  const d = Math.abs(mine - consensus);
  return d <= 200 ? "agree" : d > 500 ? "disagree" : "neutral";
}

/**
 * Judges one report against the consensus that formed *after* it: other users' reports made in
 * (t, t + 30 min], evaluated at t + 30 min. Copying a consensus that was already on screen therefore earns
 * nothing unless later, independent reporters confirm it.
 * Returns null when those later peers don't meet the data floor (no verdict, so it doesn't count either way).
 */
export function judgeReport<T>(
  kind: "VIBE" | "LINE" | "COVER",
  report: ConsensusReport<T>,
  others: readonly ConsensusReport<T>[],
): Verdict | null {
  const t = report.createdAt.getTime();
  const at = new Date(t + REPUTATION_SETTLE_MS);
  const peers = others.filter((o) => o.userId !== report.userId && o.createdAt.getTime() > t);
  if (kind === "COVER") {
    const c = coverConsensus(peers as ConsensusReport<number>[], at);
    return c.status === "ok" ? coverVerdict(report.value as number, c.value) : null;
  }
  const scale = (kind === "VIBE" ? VIBE_SCALE : LINE_SCALE) as readonly T[];
  const c = categorical(peers, at, scale);
  return c.status === "ok" ? ordinalVerdict(scale, report.value, c.value) : null;
}
