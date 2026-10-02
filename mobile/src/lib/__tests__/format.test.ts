import { formatAge, formatDistance, initial, plural } from "../format";

describe("formatDistance", () => {
  it.each([
    [0, "0 m"],
    [140.4, "140 m"],
    [999, "999 m"],
    [1000, "1.0 km"],
    [1260, "1.3 km"],
    [1815, "1.8 km"],
    [12400, "12 km"],
    [-5, "0 m"],
  ])("%d -> %s", (m, out) => expect(formatDistance(m)).toBe(out));

  it("never shows meters from 1000 up (a known device bug: '1815 m')", () => {
    for (const m of [1000, 1001, 1815, 5000, 9999, 20000]) expect(formatDistance(m)).toMatch(/ km$/);
  });
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

describe("plural", () => {
  it("handles one and many", () => {
    expect(plural(1, "stamp")).toBe("1 stamp");
    expect(plural(4, "stamp")).toBe("4 stamps");
    expect(plural(0, "place")).toBe("0 places");
    expect(plural(2, "person", "people")).toBe("2 people");
  });
});

describe("initial", () => {
  it.each([
    ["maya", "M"],
    ["@maya", "M"],
    ["  zed", "Z"],
    ["", "?"],
    [null, "?"],
  ])("%s -> %s", (name, out) => expect(initial(name)).toBe(out));
});
