import { describe, expect, it } from "vitest";
import { ageOn, isOldEnough, parseBirthdate } from "@/lib/age";

// 2026-10-02 12:00 in New York is 16:00Z.
const NOW = new Date("2026-10-02T16:00:00Z");

describe("parseBirthdate", () => {
  it("accepts real dates only", () => {
    expect(parseBirthdate("1990-05-05")).toEqual({ y: 1990, m: 5, d: 5 });
    expect(parseBirthdate("2000-02-29")).toEqual({ y: 2000, m: 2, d: 29 });
    for (const bad of ["2001-02-29", "2001-13-01", "2001-00-10", "2001-04-31", "05/05/1990", "1990-5-5", "", "yesterday", "1990-05-05T00:00:00Z"]) {
      expect(parseBirthdate(bad), bad).toBeNull();
    }
  });
});

describe("ageOn", () => {
  it("counts a birthday from its own date", () => {
    const birth = { y: 2005, m: 10, d: 2 };
    expect(ageOn(birth, { y: 2026, m: 10, d: 1 })).toBe(20);
    expect(ageOn(birth, { y: 2026, m: 10, d: 2 })).toBe(21);
    expect(ageOn(birth, { y: 2026, m: 10, d: 3 })).toBe(21);
  });
});

describe("isOldEnough (21+, New York today)", () => {
  it("is true on the 21st birthday and false the day before", () => {
    expect(isOldEnough("2005-10-02", NOW)).toBe(true);
    expect(isOldEnough("2005-10-03", NOW)).toBe(false);
    expect(isOldEnough("2005-10-01", NOW)).toBe(true);
  });
  it("handles leap-day birthdays", () => {
    expect(isOldEnough("2004-02-29", new Date("2025-03-01T17:00:00Z"))).toBe(true);
    expect(isOldEnough("2008-02-29", new Date("2029-02-28T17:00:00Z"))).toBe(false);
  });
  it("uses the New York date, not UTC: 11pm in New York is already the next day in UTC", () => {
    // 2026-10-02 23:30 in New York (EDT) is 2026-10-03 03:30Z. The 21st birthday on the 3rd is not here yet.
    expect(isOldEnough("2005-10-03", new Date("2026-10-03T03:30:00Z"))).toBe(false);
    expect(isOldEnough("2005-10-02", new Date("2026-10-03T03:30:00Z"))).toBe(true);
  });
  it("refuses future dates, nonsense and absurd ages", () => {
    expect(isOldEnough("2030-01-01", NOW)).toBe(false);
    expect(isOldEnough("1800-01-01", NOW)).toBe(false);
    expect(isOldEnough("nope", NOW)).toBe(false);
  });
});
