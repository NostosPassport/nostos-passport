import { describe, expect, it } from "vitest";
import { REGULAR_MIN_NIGHTS, REGULAR_WINDOW_DAYS, addNights, countVisits, regularPairs, regularWindowStart } from "@/lib/regulars";
import { DAY_MS, nightKey, zonedTimeToUtc } from "@/lib/time";

const NOW = new Date("2026-10-10T03:00:00Z"); // Friday 11pm in New York: night 2026-10-09
/** A post at `hour`:`minute` New York time on the night `daysAgo` nights before tonight (hours < 5 are the next morning). */
function at(daysAgo: number, hour = 23, minute = 0, userId = "u", venueId = "v") {
  const key = addNights(nightKey(NOW), -daysAgo);
  const [y, m, d] = (hour < 5 ? addNights(key, 1) : key).split("-").map(Number) as [number, number, number];
  const createdAt = zonedTimeToUtc(y, m, d, hour, minute);
  return { userId, venueId, night: nightKey(createdAt), createdAt };
}

describe("Regular status", () => {
  it("thresholds are 3 nights in 60 days", () => {
    expect([REGULAR_MIN_NIGHTS, REGULAR_WINDOW_DAYS]).toEqual([3, 60]);
  });

  it("3 different nights make a Regular; 2 don't", () => {
    expect(regularPairs([at(0), at(7), at(14)], NOW)).toEqual(new Set(["u:v"]));
    expect(regularPairs([at(0), at(7)], NOW).size).toBe(0);
  });

  it("several posts on one night count once", () => {
    expect(countVisits([at(0, 22), at(0, 23), at(0, 2), at(7), at(7, 1)], NOW)).toBe(2);
  });

  it("one visit across 5am is one night, not two (4:50am and 5:06am)", () => {
    const visit = [at(3, 4, 50), at(2, 5, 6)];
    expect(visit[0]!.night).not.toBe(visit[1]!.night);
    expect(countVisits(visit, NOW)).toBe(1);
    // Two such visits plus nothing else: still 2 nights, not 4.
    expect(countVisits([...visit, at(10, 4, 55), at(9, 5, 10)], NOW)).toBe(2);
    expect(regularPairs([...visit, at(10, 4, 55), at(9, 5, 10)], NOW).size).toBe(0);
  });

  it("the window is exactly 60 nights, tonight included", () => {
    expect(regularWindowStart(NOW)).toBe(addNights(nightKey(NOW), -59));
    expect(countVisits([at(59), at(30), at(1)], NOW)).toBe(3);
    expect(countVisits([at(60), at(30), at(1)], NOW)).toBe(2);
  });

  it("the window is by night key, so daylight saving time doesn't move it", () => {
    // 2026-11-01 is the fall-back day; 60 nights before 2026-12-15 at 5:30am is still 59 nights back by key.
    const dec = zonedTimeToUtc(2026, 12, 15, 5, 30);
    expect(regularWindowStart(dec)).toBe("2026-10-17");
    expect(regularWindowStart(new Date(dec.getTime() + 20 * 60_000))).toBe("2026-10-17");
    void DAY_MS;
  });

  it("is per person and per venue, and a person can be a Regular at several venues", () => {
    const rows = [
      at(1, 23, 0, "a", "x"), at(2, 23, 0, "a", "x"), at(3, 23, 0, "a", "x"),
      at(1, 23, 0, "a", "y"), at(2, 23, 0, "a", "y"), at(3, 23, 0, "a", "y"),
      at(1, 23, 0, "b", "x"), at(2, 23, 0, "b", "y"), at(3, 23, 0, "b", "x"),
    ];
    expect(regularPairs(rows, NOW)).toEqual(new Set(["a:x", "a:y"]));
  });

  it("ignores nights in the future (clock skew, bad data)", () => {
    expect(countVisits([at(0), at(1), { userId: "u", venueId: "v", night: "2030-01-01", createdAt: new Date("2030-01-01T23:00:00Z") }], NOW)).toBe(2);
  });
});
