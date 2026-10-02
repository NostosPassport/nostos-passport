import { describe, expect, it } from "vitest";
import type { Vibe } from "@prisma/client";
import {
  clampReputation, coverConsensus, coverMismatch, coverVerdict, decayWeight, hasEnoughData, judgeReport, latestPerUser,
  lineConsensus, ordinalVerdict, reportWeight, reputationFromRecord, vibeConsensus, weightedMedian, weightedMode,
  HALF_LIFE_MS, MAX_AGE_MS, REPUTATION_MAX, REPUTATION_MIN, REPUTATION_NEW, VIBE_SCALE, LINE_SCALE,
  type ConsensusReport,
} from "@/lib/consensus";

const NOW = new Date("2026-09-26T03:30:00Z"); // Fri 11:30pm ET
const MIN = 60_000;
const at = (minAgo: number) => new Date(NOW.getTime() - minAgo * MIN);
const r = <T,>(userId: string, value: T, minAgo: number, reputation = 1): ConsensusReport<T> => ({ userId, value, createdAt: at(minAgo), reputation });

describe("time decay", () => {
  it("is 1 at age 0 and halves every 30 minutes", () => {
    expect(decayWeight(0)).toBe(1);
    expect(decayWeight(HALF_LIFE_MS)).toBeCloseTo(0.5, 12);
    expect(decayWeight(2 * HALF_LIFE_MS)).toBeCloseTo(0.25, 12);
    expect(decayWeight(15 * MIN)).toBeCloseTo(Math.SQRT1_2, 12);
  });
  it("is zero at exactly 3 hours and beyond (half-open live window)", () => {
    expect(decayWeight(MAX_AGE_MS - 1)).toBeGreaterThan(0);
    expect(decayWeight(MAX_AGE_MS - 1)).toBeCloseTo(1 / 64, 6);
    expect(decayWeight(MAX_AGE_MS)).toBe(0);
    expect(decayWeight(MAX_AGE_MS + 1)).toBe(0);
  });
  it("ignores future timestamps and garbage", () => {
    expect(decayWeight(-1)).toBe(0);
    expect(decayWeight(NaN)).toBe(0);
  });
  it("weight = reputation x decay", () => {
    expect(reportWeight({ createdAt: at(30), reputation: 1.5 }, NOW)).toBeCloseTo(0.75, 12);
    expect(reportWeight({ createdAt: at(0), reputation: 0.5 }, NOW)).toBe(0.5);
  });
});

describe("reputation bounds", () => {
  it("clamps to [0.2, 1.5] and treats non-finite as new", () => {
    expect(clampReputation(5)).toBe(1.5);
    expect(clampReputation(0)).toBe(0.2);
    expect(clampReputation(NaN)).toBe(0.5);
  });
  it("new accounts (no record) are exactly 0.5", () => {
    expect(reputationFromRecord(0, 0)).toBe(REPUTATION_NEW);
  });
  it("rises toward 1.5 with agreement, never reaching past it", () => {
    const a = reputationFromRecord(5, 0), b = reputationFromRecord(50, 0), c = reputationFromRecord(100_000, 0);
    expect(a).toBeGreaterThan(0.5);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeLessThanOrEqual(REPUTATION_MAX);
    expect(c).toBeCloseTo(REPUTATION_MAX, 3);
  });
  it("falls toward 0.2 with consistent disagreement", () => {
    const a = reputationFromRecord(0, 5), b = reputationFromRecord(1, 60), c = reputationFromRecord(0, 100_000);
    expect(a).toBeLessThan(0.5);
    expect(b).toBeLessThan(a);
    expect(c).toBeGreaterThanOrEqual(REPUTATION_MIN);
    expect(c).toBeCloseTo(REPUTATION_MIN, 3);
  });
  it("a mixed record stays near 0.5", () => {
    expect(reputationFromRecord(10, 10)).toBe(0.5);
  });
});

describe("data floor: >= 2 reports from >= 2 distinct users in the last hour", () => {
  it("fails with one user reporting twice", () => {
    expect(hasEnoughData([r("a", 1, 5), r("a", 1, 30)], NOW)).toBe(false);
  });
  it("passes with two users inside the hour", () => {
    expect(hasEnoughData([r("a", 1, 5), r("b", 1, 59)], NOW)).toBe(true);
  });
  it("excludes a report exactly 60 minutes old", () => {
    expect(hasEnoughData([r("a", 1, 5), r("b", 1, 60)], NOW)).toBe(false);
  });
  it("ignores future reports", () => {
    expect(hasEnoughData([r("a", 1, 5), r("b", 1, -5)], NOW)).toBe(false);
  });
  it("consensus reports insufficient when only old data exists", () => {
    const c = vibeConsensus([r("a", "PACKED", 70), r("b", "PACKED", 90), r("c", "PACKED", 100)], NOW);
    expect(c.status).toBe("insufficient");
    expect(c.reportCount).toBe(3);
    expect(c.newestAt?.toISOString()).toBe(at(70).toISOString());
  });
});

describe("latest report per user", () => {
  it("keeps only each user's newest report", () => {
    const out = latestPerUser([r("a", "DEAD", 40), r("a", "PACKED", 5), r("b", "BUSY", 10)]);
    expect(out.map((x) => `${x.userId}:${x.value}`).sort()).toEqual(["a:PACKED", "b:BUSY"]);
  });
  it("one spammer cannot outvote a crowd", () => {
    const spam = [0, 16, 32, 48, 64].map((m) => r<Vibe>("spam", "DEAD", m, 1.5));
    const c = vibeConsensus([...spam, r<Vibe>("a", "PACKED", 10), r<Vibe>("b", "PACKED", 12)], NOW);
    expect(c).toMatchObject({ status: "ok", value: "PACKED", reportCount: 7, userCount: 3 });
  });
});

describe("weighted mode", () => {
  it("picks the heaviest value, not the most frequent", () => {
    const c = vibeConsensus([r("a", "DEAD", 1, 0.2), r("b", "DEAD", 1, 0.2), r("c", "PACKED", 1, 1.5)], NOW);
    expect(c).toMatchObject({ status: "ok", value: "PACKED" });
  });
  it("recency matters: a fresh report beats two stale ones of equal reputation", () => {
    // 2 x 0.5^(90/30)=0.25 vs 1 x 1
    const c = lineConsensus([r("a", "OVER_30", 90), r("b", "OVER_30", 90), r("c", "NONE", 0), r("d", "NONE", 50)], NOW);
    expect(c).toMatchObject({ status: "ok", value: "NONE" });
  });
  it("breaks exact ties by most recent report, then by scale order", () => {
    const now = new Date(0);
    const d = (ms: number) => new Date(ms);
    expect(weightedMode([{ value: "DEAD", weight: 1, createdAt: d(5) }, { value: "BUSY", weight: 1, createdAt: d(3) }], VIBE_SCALE)).toBe("DEAD");
    expect(weightedMode([{ value: "DEAD", weight: 1, createdAt: now }, { value: "BUSY", weight: 1, createdAt: now }], VIBE_SCALE)).toBe("BUSY");
    expect(weightedMode([{ value: "OVER_30", weight: 1, createdAt: now }, { value: "NONE", weight: 1, createdAt: now }], LINE_SCALE)).toBe("NONE");
  });
  it("returns null for no positive weight", () => {
    expect(weightedMode([{ value: "DEAD", weight: 0, createdAt: NOW }], VIBE_SCALE)).toBeNull();
  });
  it("is independent of input order", () => {
    const rs = [r<Vibe>("a", "BUSY", 3), r<Vibe>("b", "CHILL", 4), r<Vibe>("c", "BUSY", 20), r<Vibe>("d", "CHILL", 1)];
    expect(vibeConsensus(rs, NOW)).toEqual(vibeConsensus([...rs].reverse(), NOW));
  });
});

describe("weighted median (cover)", () => {
  it("equal weights: odd count = middle value", () => {
    expect(weightedMedian([1000, 2000, 3000].map((value) => ({ value, weight: 1 })))).toBe(2000);
  });
  it("equal weights: even count = mean of the middle two", () => {
    expect(weightedMedian([1000, 2000].map((value) => ({ value, weight: 1 })))).toBe(1500);
    expect(weightedMedian([0, 1000, 2000, 3000].map((value) => ({ value, weight: 1 })))).toBe(1500);
  });
  it("heavy weight pulls the median", () => {
    expect(weightedMedian([{ value: 0, weight: 0.2 }, { value: 2000, weight: 1.5 }, { value: 500, weight: 0.2 }])).toBe(2000);
  });
  it("is robust to one outlier", () => {
    expect(weightedMedian([2000, 2000, 2000, 0].map((value) => ({ value, weight: 1 })))).toBe(2000);
  });
  it("handles empty / zero weights", () => {
    expect(weightedMedian([])).toBeNull();
    expect(weightedMedian([{ value: 5, weight: 0 }])).toBeNull();
  });
  it("cover consensus uses the median in cents and reports counts/age", () => {
    const c = coverConsensus([r("a", 2000, 5), r("b", 2000, 10), r("c", 1000, 50), r("d", 0, 179, 1.5)], NOW);
    expect(c).toMatchObject({ status: "ok", value: 2000, reportCount: 4 });
    if (c.status === "ok") expect(c.newestAt.toISOString()).toBe(at(5).toISOString());
  });
  it("reports older than 3h are excluded from the count", () => {
    const c = coverConsensus([r("a", 2000, 5), r("b", 2000, 10), r("z", 0, 180)], NOW);
    expect(c.reportCount).toBe(2);
  });
});

describe("cover mismatch callout", () => {
  const ok = (value: number) => ({ status: "ok" as const, value, reportCount: 3, userCount: 3, newestAt: NOW, totalWeight: 1 });
  it("fires when users differ from official by more than $2", () => {
    expect(coverMismatch(1000, ok(2000))).toBe(true);
    expect(coverMismatch(1000, ok(1200))).toBe(false);
    expect(coverMismatch(1000, ok(1201))).toBe(true);
  });
  it("never fires without data or without an official cover", () => {
    expect(coverMismatch(null, ok(2000))).toBe(false);
    expect(coverMismatch(1000, { status: "insufficient", reportCount: 1, userCount: 1, newestAt: NOW })).toBe(false);
  });
});

describe("agreement verdicts", () => {
  it("ordinal: same agrees, adjacent neutral, far disagrees", () => {
    expect(ordinalVerdict(VIBE_SCALE, "PACKED", "PACKED")).toBe("agree");
    expect(ordinalVerdict(VIBE_SCALE, "PACKED", "BUSY")).toBe("neutral");
    expect(ordinalVerdict(VIBE_SCALE, "DEAD", "PACKED")).toBe("disagree");
  });
  it("cover: within $2 agrees, over $5 disagrees", () => {
    expect(coverVerdict(1000, 1200)).toBe("agree");
    expect(coverVerdict(1000, 1400)).toBe("neutral");
    expect(coverVerdict(0, 2000)).toBe("disagree");
  });
  it("judges against others' consensus 30 minutes after the report, excluding the author", () => {
    const mine = r("me", "DEAD", 60);
    const others = [r("a", "PACKED", 55), r("b", "PACKED", 40), r("me", "DEAD", 35)];
    expect(judgeReport("VIBE", mine, others)).toBe("disagree");
  });
  it("gives no verdict when peers lack enough data", () => {
    expect(judgeReport("VIBE", r("me", "DEAD", 60), [r("a", "PACKED", 55)])).toBeNull();
  });
  it("only counts peers who reported after the report (copying an existing consensus earns nothing)", () => {
    expect(judgeReport("VIBE", r("me", "PACKED", 60), [r("a", "PACKED", 90), r("b", "PACKED", 70)])).toBeNull();
  });
  it("ignores peer reports made more than 30 minutes after", () => {
    expect(judgeReport("VIBE", r("me", "DEAD", 60), [r("a", "PACKED", 20), r("b", "PACKED", 10)])).toBeNull();
  });
});
