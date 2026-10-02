import { describe, expect, it } from "vitest";
import { nightBounds, nightKey, zonedTimeToUtc } from "@/lib/time";

describe("night rollover in America/New_York (5:00am)", () => {
  it("assigns late-night hours to the previous evening's night", () => {
    // Sat 2026-09-26 02:30 EDT = 06:30Z -> Friday's night
    expect(nightKey(new Date("2026-09-26T06:30:00Z"))).toBe("2026-09-25");
    // Sat 04:59:59 EDT still Friday night
    expect(nightKey(new Date("2026-09-26T08:59:59Z"))).toBe("2026-09-25");
    // Sat 05:00:00 EDT starts Saturday's night
    expect(nightKey(new Date("2026-09-26T09:00:00Z"))).toBe("2026-09-26");
  });

  it("uses local wall time, not UTC date", () => {
    // Fri 23:00 EDT = Sat 03:00Z; UTC date is Saturday but the night is Friday.
    expect(nightKey(new Date("2026-09-26T03:00:00Z"))).toBe("2026-09-25");
  });

  it("rolls at 5am local across DST changes", () => {
    // Spring forward: Sun 2026-03-08. 04:59 EDT = 08:59Z -> night of Sat 03-07. 05:00 EDT = 09:00Z -> 03-08.
    expect(nightKey(new Date("2026-03-08T08:59:00Z"))).toBe("2026-03-07");
    expect(nightKey(new Date("2026-03-08T09:00:00Z"))).toBe("2026-03-08");
    // Fall back: Sun 2026-11-01. 04:59 EST = 09:59Z -> 10-31. 05:00 EST = 10:00Z -> 11-01.
    expect(nightKey(new Date("2026-11-01T09:59:00Z"))).toBe("2026-10-31");
    expect(nightKey(new Date("2026-11-01T10:00:00Z"))).toBe("2026-11-01");
  });

  it("computes night bounds, including the 23h/25h DST nights", () => {
    const fri = nightBounds("2026-09-25");
    expect(fri.start.toISOString()).toBe("2026-09-25T09:00:00.000Z");
    expect(fri.end.toISOString()).toBe("2026-09-26T09:00:00.000Z");
    const spring = nightBounds("2026-03-07");
    expect(spring.end.getTime() - spring.start.getTime()).toBe(23 * 3600_000);
    const fall = nightBounds("2026-10-31");
    expect(fall.end.getTime() - fall.start.getTime()).toBe(25 * 3600_000);
  });

  it("zonedTimeToUtc handles EST and EDT", () => {
    expect(zonedTimeToUtc(2026, 1, 15, 22).toISOString()).toBe("2026-01-16T03:00:00.000Z");
    expect(zonedTimeToUtc(2026, 7, 15, 22).toISOString()).toBe("2026-07-16T02:00:00.000Z");
  });
});
