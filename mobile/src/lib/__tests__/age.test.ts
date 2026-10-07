import { ageOn, checkBirthdate, formatBirthdateInput, parseBirthdate, toApiDate, UNDERAGE_NOTICE } from "../age";

const NOW = new Date("2026-10-02T16:00:00Z");

describe("formatBirthdateInput", () => {
  it.each([
    ["", ""],
    ["0", "0"],
    ["05", "05"],
    ["050", "05/0"],
    ["0505", "05/05"],
    ["05051", "05/05/1"],
    ["05/05/1990", "05/05/1990"],
    ["0505199012345", "05/05/1990"],
    ["ab05-05x1990", "05/05/1990"],
  ])("%s -> %s", (raw, out) => expect(formatBirthdateInput(raw)).toBe(out));
});

describe("parseBirthdate and toApiDate", () => {
  it("accepts real dates and renders the API form", () => {
    expect(parseBirthdate("05/05/1990")).toEqual({ y: 1990, m: 5, d: 5 });
    expect(toApiDate({ y: 1990, m: 5, d: 5 })).toBe("1990-05-05");
    expect(parseBirthdate("02/29/2000")).toEqual({ y: 2000, m: 2, d: 29 });
  });

  it("rejects impossible dates and wrong shapes", () => {
    for (const bad of ["02/30/1990", "13/01/1990", "00/10/1990", "05/05/90", "5/5/1990", "1990-05-05", "", "02/29/2001"]) expect(parseBirthdate(bad)).toBeNull();
  });
});

describe("ageOn", () => {
  it("counts a birthday from its own date", () => {
    expect(ageOn({ y: 2013, m: 10, d: 2 }, { y: 2026, m: 10, d: 1 })).toBe(12);
    expect(ageOn({ y: 2013, m: 10, d: 2 }, { y: 2026, m: 10, d: 2 })).toBe(13);
  });
});

describe("checkBirthdate (13+)", () => {
  it("passes someone who turns 13 today, with the API's date form", () => {
    expect(checkBirthdate("10/02/2013", NOW)).toEqual({ ok: true, apiDate: "2013-10-02" });
    expect(checkBirthdate("05/05/1990", NOW)).toEqual({ ok: true, apiDate: "1990-05-05" });
  });

  it("turns away someone a day short, with one plain sentence, and no date to send", () => {
    const r = checkBirthdate("10/03/2013", NOW);
    expect(r).toEqual({ ok: false, reason: "underage", message: UNDERAGE_NOTICE });
    expect(JSON.stringify(r)).not.toMatch(/2013|10\/03/);
  });

  it("treats unfinished, impossible, ancient and future dates as a format problem, not an age", () => {
    for (const bad of ["", "10/0", "02/30/1990", "01/01/1850", "01/01/2031"]) expect(checkBirthdate(bad, NOW)).toMatchObject({ ok: false, reason: "format" });
  });
});
