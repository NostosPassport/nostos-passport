import { describe, expect, it } from "vitest";

import { calendarDayKey } from "@/lib/time";

describe("calendarDayKey", () => {
  it("uses the venue's local calendar day", () => {
    const instant = new Date("2026-10-20T22:30:00.000Z");
    expect(calendarDayKey(instant, "America/New_York")).toBe("2026-10-20");
    expect(calendarDayKey(instant, "Europe/Rome")).toBe("2026-10-21");
    expect(calendarDayKey(instant, "Asia/Tokyo")).toBe("2026-10-21");
  });

  it("falls back safely when a time zone is absent or invalid", () => {
    const instant = new Date("2026-10-20T23:30:00.000Z");
    expect(calendarDayKey(instant, null)).toBe("2026-10-20");
    expect(calendarDayKey(instant, "not-a-time-zone")).toBe("2026-10-20");
  });
});
