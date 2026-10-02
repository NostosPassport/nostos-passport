import { coverInputToApi, formatAge, formatCents, formatClock, formatDistance, initial, nightDayIndex, plural, venueSummary } from "../format";

describe("formatCents", () => {
  it.each([
    [0, "Free"],
    [2000, "$20"],
    [1250, "$12.50"],
    [1205, "$12.05"],
    [50000, "$500"],
  ])("%i -> %s", (cents, out) => expect(formatCents(cents)).toBe(out));
});

describe("formatDistance", () => {
  it.each([
    [0, "0 m"],
    [140.4, "140 m"],
    [999, "999 m"],
    [1000, "1.0 km"],
    [1260, "1.3 km"],
    [12400, "12 km"],
    [-5, "0 m"],
  ])("%d -> %s", (m, out) => expect(formatDistance(m)).toBe(out));
});

describe("formatAge", () => {
  const now = "2026-09-24T03:00:00.000Z";
  it.each([
    ["2026-09-24T02:59:30.000Z", "just now"],
    ["2026-09-24T02:48:00.000Z", "12 min ago"],
    ["2026-09-24T01:00:00.000Z", "2 h ago"],
    ["2026-09-21T03:00:00.000Z", "3 d ago"],
    ["2026-09-24T03:05:00.000Z", "just now"],
  ])("%s -> %s", (iso, out) => expect(formatAge(iso, now)).toBe(out));
});

describe("formatClock", () => {
  it.each([
    ["21:30", "9:30 PM"],
    ["00:00", "12 AM"],
    ["12:00", "12 PM"],
    ["04:00", "4 AM"],
  ])("%s -> %s", (hhmm, out) => expect(formatClock(hhmm)).toBe(out));
});

describe("nightDayIndex (5am New York boundary)", () => {
  it("counts 1am Saturday as Friday night", () => {
    // 2026-09-26 01:00 EDT = 05:00Z, a Saturday
    expect(nightDayIndex(new Date("2026-09-26T05:00:00Z"))).toBe(5);
  });
  it("switches to the new day at 5am", () => {
    expect(nightDayIndex(new Date("2026-09-26T09:00:00Z"))).toBe(6);
  });
});

describe("coverInputToApi", () => {
  it.each([
    ["", ""],
    ["0", "free"],
    ["20", "20"],
    ["12.5", "12.50"],
    ["abc", ""],
  ])("%s -> %s", (input, out) => expect(coverInputToApi(input)).toBe(out));
});

describe("text helpers", () => {
  it("pluralizes", () => {
    expect(plural(1, "report")).toBe("1 report");
    expect(plural(4, "report")).toBe("4 reports");
  });
  it("summarizes a venue for the list", () => {
    expect(venueSummary({ vibe: "PACKED", hereNow: 4, goingTonight: 18 })).toBe("Packed · 4 here · 18 going");
    expect(venueSummary({ vibe: "NO_DATA", hereNow: 0, goingTonight: 0 })).toBe("No reports in the last hour");
  });
  it("builds avatar initials", () => {
    expect(initial("@maya")).toBe("M");
    expect(initial("")).toBe("?");
    expect(initial(null)).toBe("?");
  });
});

describe("monthName", () => {
  const { monthName, monthBest } = jest.requireActual("../format") as typeof import("../format");
  it("names a month, with the year only when it isn't this one", () => {
    expect(monthName("2026-10", 2026)).toBe("October");
    expect(monthName("2025-12", 2026)).toBe("December 2025");
    expect(monthBest("2026-09", 2026)).toBe("September's best");
  });
});
