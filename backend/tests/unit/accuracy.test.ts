import { describe, expect, it } from "vitest";
import { computeAccuracy, officialCoverAt, type CoverReportInput } from "@/lib/accuracy";

const NOW = new Date("2026-09-26T03:30:00Z");
const H = 3600_000;
const DAY = 24 * H;
// Hour window k hours back from the start of NOW's hour.
const hourStart = (k: number) => Math.floor(NOW.getTime() / H) * H - k * H;
const history = [{ coverCents: 1000, effectiveFrom: new Date(NOW.getTime() - 90 * DAY) }];

function windowReports(k: number, values: number[], opts: { users?: string[]; rep?: number } = {}): CoverReportInput[] {
  return values.map((v, i) => ({
    userId: opts.users?.[i] ?? `u${i}`,
    coverCents: v,
    createdAt: new Date(hourStart(k) + (i + 1) * 60_000),
    reputation: opts.rep ?? 1,
  }));
}

describe("accuracy score", () => {
  it("needs >= 3 distinct users per window", () => {
    const reports = [
      ...windowReports(1, [1000, 1000], {}),
      ...windowReports(2, [1000, 1000, 1000], { users: ["a", "a", "b"] }),
    ];
    expect(computeAccuracy({ reports, history, now: NOW }).qualifyingWindows).toBe(0);
  });

  it("is 'not enough data' below 5 qualifying windows, and scored at exactly 5", () => {
    const four = [1, 2, 3, 4].flatMap((k) => windowReports(k, [1000, 1000, 1000]));
    expect(computeAccuracy({ reports: four, history, now: NOW })).toMatchObject({ status: "insufficient", qualifyingWindows: 4 });
    const five = [...four, ...windowReports(5, [3000, 3000, 3000])];
    expect(computeAccuracy({ reports: five, history, now: NOW })).toMatchObject({ status: "ok", qualifyingWindows: 5, matchingWindows: 4, scorePct: 80 });
  });

  it("uses a $2 tolerance, inclusive", () => {
    const reports = [
      ...windowReports(1, [1200, 1200, 1200]), // +$2: match
      ...windowReports(2, [1201, 1201, 1201]), // +$2.01: no match
      ...windowReports(3, [800, 800, 800]), // -$2: match
      ...windowReports(4, [1000, 1000, 1000]),
      ...windowReports(5, [2000, 2000, 2000]),
    ];
    const res = computeAccuracy({ reports, history, now: NOW });
    expect(res.windows.map((w) => w.match)).toEqual([false, true, true, false, true]); // oldest first
    expect(res).toMatchObject({ status: "ok", scorePct: 60 });
  });

  it("only looks back 30 days", () => {
    const old = [0, 1, 2, 3, 4].map((i) => windowReports(0, [2000, 2000, 2000]).map((r) => ({ ...r, createdAt: new Date(r.createdAt.getTime() - 31 * DAY - i * H) }))).flat();
    expect(computeAccuracy({ reports: old, history, now: NOW }).qualifyingWindows).toBe(0);
  });

  it("compares against every official cover in effect during the hour; a mid-hour change can't dodge the score", () => {
    const changeAt = hourStart(2) + 30 * 60_000; // mid-window 2
    const h = [...history, { coverCents: 2000, effectiveFrom: new Date(changeAt) }];
    const reports = [...windowReports(1, [2000, 2000, 2000]), ...windowReports(2, [2000, 2000, 2000]), ...windowReports(3, [1000, 1000, 1000])];
    const res = computeAccuracy({ reports, history: h, now: NOW });
    expect(res.windows.map((w) => [w.officialCents, w.match])).toEqual([[[1000], true], [[1000, 2000], false], [[2000], true]]);
    expect(officialCoverAt(h, changeAt - 1)).toBe(1000);
    expect(officialCoverAt(h, changeAt)).toBe(2000);
  });

  it("a venue that has never stated a cover gets no_official_cover, not a score", () => {
    const reports = [1, 2, 3, 4, 5, 6].flatMap((k) => windowReports(k, [0, 0, 0]));
    expect(computeAccuracy({ reports, history: [], now: NOW })).toMatchObject({ status: "no_official_cover", qualifyingWindows: 0 });
    const unclaimed = [{ coverCents: null, effectiveFrom: new Date(0) }];
    expect(computeAccuracy({ reports, history: unclaimed, now: NOW })).toMatchObject({ status: "no_official_cover" });
  });

  it("skips windows that end before the first stated cover, and judges a straddling window only after it", () => {
    const firstStated = hourStart(3) + 30 * 60_000; // mid-window 3
    const h = [{ coverCents: null, effectiveFrom: new Date(0) }, { coverCents: 1000, effectiveFrom: new Date(firstStated) }];
    const reports = [4, 3, 2].flatMap((k) => windowReports(k, [1000, 1000, 1000]));
    const res = computeAccuracy({ reports, history: h, now: NOW });
    // window 4 ends before the first cover: skipped. Window 3 straddles it: judged on [firstStated, end) only.
    expect(res.windows.map((w) => [w.start.getTime(), w.officialCents, w.match])).toEqual([
      [hourStart(3), [1000], true],
      [hourStart(2), [1000], true],
    ]);
    // A window ending exactly at the first cover is also skipped.
    const exact = [{ coverCents: 1000, effectiveFrom: new Date(hourStart(2)) }];
    expect(computeAccuracy({ reports: windowReports(3, [1000, 1000, 1000]), history: exact, now: NOW }).qualifyingWindows).toBe(0);
  });

  it("after a cover was stated, clearing it counts as a mismatch (it can't be dodged)", () => {
    const h = [
      { coverCents: 1000, effectiveFrom: new Date(NOW.getTime() - 60 * DAY) },
      { coverCents: null, effectiveFrom: new Date(hourStart(3)) },
    ];
    const reports = [1, 2, 3, 4, 5].flatMap((k) => windowReports(k, [1000, 1000, 1000]));
    const res = computeAccuracy({ reports, history: h, now: NOW });
    expect(res).toMatchObject({ status: "ok", qualifyingWindows: 5, matchingWindows: 2, scorePct: 40 });
  });

  it("ignores the hour still in progress", () => {
    const res = computeAccuracy({ reports: windowReports(0, [1000, 1000, 1000]).map((r) => ({ ...r, createdAt: new Date(Math.min(r.createdAt.getTime(), NOW.getTime())) })), history, now: NOW });
    expect(res.qualifyingWindows).toBe(0);
  });

  it("uses each user's newest report per window and a reputation-weighted median", () => {
    const reports: CoverReportInput[] = [
      { userId: "a", coverCents: 2000, createdAt: new Date(hourStart(1) + 60_000), reputation: 1 },
      { userId: "a", coverCents: 1000, createdAt: new Date(hourStart(1) + 120_000), reputation: 1 },
      { userId: "b", coverCents: 1000, createdAt: new Date(hourStart(1) + 180_000), reputation: 1.5 },
      { userId: "troll", coverCents: 0, createdAt: new Date(hourStart(1) + 240_000), reputation: 0.2 },
    ];
    const [w] = computeAccuracy({ reports, history, now: NOW }).windows;
    expect(w).toMatchObject({ users: 3, consensusCents: 1000, match: true });
  });

  it("ignores reports after now", () => {
    const future = windowReports(-2, [2000, 2000, 2000]);
    expect(computeAccuracy({ reports: future, history, now: NOW }).qualifyingWindows).toBe(0);
  });
});
