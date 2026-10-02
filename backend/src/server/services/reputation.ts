/**
 * Reputation job. Runs on a schedule (every 10 minutes from src/instrumentation.ts, plus
 * `pnpm job:reputation` and the seed). It does not run on read. See DECISIONS.md, "Reputation".
 *
 * Each run judges every report from the last 90 days that is at least 30 minutes old against the
 * consensus that formed *after* it (see judgeReport). A user gets at most one verdict per venue, metric
 * and clock hour, so re-reporting every 15 minutes can't farm agreement. The job tallies agree/disagree
 * per user and writes reputationFromRecord(agree, disagree). Users with no verdicts in the lookback keep
 * their current reputation, so a pause doesn't reset a troll to newcomer weight.
 * Peers are weighted by their *current* reputation, so one run is one step of a fixed-point iteration.
 * Hidden (moderated) reports are ignored on both sides.
 *
 * Reads and computation happen outside any transaction. The write is one short transaction that takes a
 * transaction-scoped advisory lock (so concurrent runs never interleave writes) and issues a single
 * batched UPDATE.
 */
import type { ReportType } from "@prisma/client";
import type { Db } from "@/lib/db";
import { judgeReport, MAX_AGE_MS, REPUTATION_SETTLE_MS, reputationFromRecord, type ConsensusReport, type Verdict } from "@/lib/consensus";
import { DAY_MS, HOUR_MS } from "@/lib/time";

export const REPUTATION_LOOKBACK_MS = 90 * DAY_MS;
const JOB_LOCK_KEY = 815_2026;

type Row = { userId: string; venueId: string; type: ReportType; value: string | number; createdAt: Date };

export async function recomputeAllReputations(db: Db, now = new Date()): Promise<{ updated: number; judged: number; skipped: boolean }> {
  const { next, judged } = await computeReputations(db, now);
  const ids = [...next.keys()];
  const reps = ids.map((id) => next.get(id)!);
  if (!ids.length) return { updated: 0, judged, skipped: false };
  const updated = await db.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${JOB_LOCK_KEY}) AS locked`;
    if (!row?.locked) return null; // another run holds the lock
    return tx.$executeRaw`
      UPDATE app_user AS u SET reputation = v.rep, reputation_updated_at = ${now}
      FROM (SELECT unnest(${ids}::text[]) AS id, unnest(${reps}::float8[]) AS rep) AS v
      WHERE u.id = v.id AND u.reputation IS DISTINCT FROM v.rep`;
  });
  return updated === null ? { updated: 0, judged, skipped: true } : { updated, judged, skipped: false };
}

/** Pure-ish computation (reads only): new reputation for every user who has at least one verdict. */
export async function computeReputations(db: Db, now: Date) {
  const since = new Date(now.getTime() - REPUTATION_LOOKBACK_MS);
  const [raw, users] = await Promise.all([
    db.report.findMany({
      // Exempt (App Review / QA) accounts' reports never count, on either side of a verdict.
      where: { hiddenAt: null, countable: true, createdAt: { gt: since, lte: now } },
      select: { userId: true, venueId: true, type: true, vibe: true, line: true, coverCents: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.user.findMany({ select: { id: true, reputation: true } }),
  ]);
  const rep = new Map(users.map((u) => [u.id, u.reputation]));
  const toInput = (x: Row): ConsensusReport<string | number> => ({
    userId: x.userId, value: x.value, createdAt: x.createdAt, reputation: rep.get(x.userId) ?? 0.5,
  });

  const groups = new Map<string, Row[]>();
  for (const r of raw) {
    const value = r.type === "VIBE" ? r.vibe : r.type === "LINE" ? r.line : r.coverCents;
    if (value == null) continue;
    const key = `${r.venueId}:${r.type}`;
    const list = groups.get(key) ?? [];
    list.push({ userId: r.userId, venueId: r.venueId, type: r.type, value, createdAt: r.createdAt });
    groups.set(key, list);
  }

  const judgeUntil = now.getTime() - REPUTATION_SETTLE_MS;
  // One verdict per user / venue / metric / clock hour: the first judged report in that hour.
  const verdicts = new Map<string, { userId: string; v: Verdict }>();
  let judged = 0;
  for (const rows of groups.values()) {
    let lo = 0;
    let hi = 0;
    for (const r of rows) {
      const t = r.createdAt.getTime();
      if (t > judgeUntil) break;
      // peers in the live window at t+30min: (t + 30min - 3h, t + 30min]
      while (lo < rows.length && rows[lo]!.createdAt.getTime() <= t + REPUTATION_SETTLE_MS - MAX_AGE_MS) lo++;
      while (hi < rows.length && rows[hi]!.createdAt.getTime() <= t + REPUTATION_SETTLE_MS) hi++;
      const slot = `${r.userId}:${r.venueId}:${r.type}:${Math.floor(t / HOUR_MS)}`;
      if (verdicts.has(slot)) continue;
      const v = judgeReport(r.type, toInput(r), rows.slice(lo, hi).map(toInput));
      if (!v) continue;
      judged++;
      verdicts.set(slot, { userId: r.userId, v });
    }
  }

  const tally = new Map<string, { agree: number; disagree: number }>();
  for (const { userId, v } of verdicts.values()) {
    const t = tally.get(userId) ?? { agree: 0, disagree: 0 };
    if (v === "agree") t.agree++;
    else if (v === "disagree") t.disagree++;
    tally.set(userId, t);
  }
  const next = new Map<string, number>();
  for (const [userId, t] of tally) next.set(userId, Math.round(reputationFromRecord(t.agree, t.disagree) * 1000) / 1000);
  return { next, judged };
}
