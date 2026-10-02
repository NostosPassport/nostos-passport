import { formatNy, fromHHMM, nextQuarterHour, toHHMM, toNyLocal } from "../ny-time";

describe("New York time", () => {
  it("formats an instant as New York wall clock, across DST", () => {
    expect(toNyLocal(new Date("2026-09-26T01:30:00Z"))).toBe("2026-09-25T21:30"); // EDT (UTC-4)
    expect(toNyLocal(new Date("2026-12-12T03:00:00Z"))).toBe("2026-12-11T22:00"); // EST (UTC-5)
  });
  it("round-trips picker times", () => {
    expect(toHHMM(fromHHMM("21:30"))).toBe("21:30");
    expect(toHHMM(fromHHMM("00:05"))).toBe("00:05");
  });
  it("rounds promo defaults to the picker's 15-minute steps", () => {
    expect(nextQuarterHour(new Date("2026-09-26T01:07:00Z")).toISOString()).toBe("2026-09-26T01:15:00.000Z");
    expect(nextQuarterHour(new Date("2026-09-26T01:15:00Z")).toISOString()).toBe("2026-09-26T01:15:00.000Z");
  });
  it("time-of-day values don't depend on the phone's DST (02:00 exists)", () => {
    expect(toHHMM(fromHHMM("02:00"))).toBe("02:00");
  });
  it("formats promo times for people", () => {
    expect(formatNy("2026-09-26T01:00:00Z")).toBe("Fri, Sep 25, 9 PM");
  });
});
