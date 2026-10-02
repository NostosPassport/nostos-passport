import { describe, expect, it } from "vitest";
import { completedNights, featuringCutoff } from "@/server/services/featuring";
import { zonedTimeToUtc } from "@/lib/time";

describe("which nights a run processes", () => {
  it("never skips the night of spring-forward (2026-03-08)", () => {
    const seen = new Set<string>();
    for (const day of [8, 9, 10]) for (const n of completedNights(zonedTimeToUtc(2026, 3, day, 5, 5))) seen.add(n);
    for (const n of ["2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09"]) expect(seen.has(n), n).toBe(true);
  });

  it("covers fall-back (2026-11-01) too", () => {
    expect(completedNights(zonedTimeToUtc(2026, 11, 2, 5, 5))).toContain("2026-11-01");
    expect(completedNights(zonedTimeToUtc(2026, 11, 1, 5, 5))).toContain("2026-10-31");
  });

  it("is the last 7 completed nights, oldest first, never tonight", () => {
    const at = zonedTimeToUtc(2026, 10, 10, 5, 5); // just after night 2026-10-09 ended
    expect(completedNights(at)).toEqual(["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]);
    expect(completedNights(zonedTimeToUtc(2026, 10, 10, 4, 59))).not.toContain("2026-10-09");
  });

  it("the cutoff is 5:05am the morning the night ends", () => {
    expect(featuringCutoff("2026-10-09")).toEqual(zonedTimeToUtc(2026, 10, 10, 5, 5));
  });
});
