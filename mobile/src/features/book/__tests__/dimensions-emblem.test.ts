import { BOOK_ASPECT, bookSize, openScale } from "../dimensions";
import { doorPath, emblem, starPath, ticksPath } from "../emblem";

describe("book size", () => {
  it("fits the screen with room for the counts, keeping the passport's proportions", () => {
    for (const [w, h] of [[390, 844], [430, 932], [375, 667], [320, 568]] as const) {
      const s = bookSize(w, h);
      expect(s.width).toBeLessThanOrEqual(w * 0.84);
      expect(s.height).toBeLessThanOrEqual(h * 0.62);
      expect(s.height / s.width).toBeCloseTo(BOOK_ASPECT, 1);
      expect(s.pageWidth).toBe(s.width);
    }
  });
  it("scales the open book down to fit, never up", () => {
    const s = bookSize(390, 844);
    expect(openScale(390, s, 8)).toBeLessThan(1);
    expect(openScale(2000, s, 8)).toBe(1);
  });
});

describe("emblem", () => {
  const nums = (d: string) => (d.match(/-?\d+\.?\d*/g) ?? []).map(Number);
  it("is deterministic and made of closed shapes inside the unit circle", () => {
    expect(emblem()).toEqual(emblem());
    const e = emblem();
    expect(e.rings).toHaveLength(2);
    for (const d of [...e.rings, e.star, e.door]) expect(d.trim().endsWith("Z")).toBe(true);
    for (const v of nums(e.star)) expect(Math.abs(v)).toBeLessThanOrEqual(1);
    for (const v of nums(ticksPath())) expect(Math.abs(v)).toBeLessThanOrEqual(1);
  });
  it("the star has eight points and the long ones point at north, east, south and west", () => {
    const d = starPath();
    expect((d.match(/L/g) ?? []).length).toBe(15);
    expect(d.startsWith("M 0 -0.8")).toBe(true);
  });
  it("has 48 ticks and a doorway", () => {
    expect((ticksPath().match(/M/g) ?? []).length).toBe(48);
    expect(doorPath()).toContain("A");
  });
});
