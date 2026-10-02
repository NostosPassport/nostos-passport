import { hashString, seeded } from "../rng";

describe("seeded randomness", () => {
  it("hashes strings the same way every time, and differently for different strings", () => {
    expect(hashString("place_1")).toBe(hashString("place_1"));
    expect(hashString("place_1")).not.toBe(hashString("place_2"));
    expect(hashString("")).toBe(0x811c9dc5);
  });
  it("gives the same sequence for the same seed", () => {
    const a = seeded("x"), b = seeded("x"), c = seeded("y");
    const seq = (r: ReturnType<typeof seeded>) => Array.from({ length: 5 }, () => r.next());
    expect(seq(a)).toEqual(seq(b));
    expect(seq(seeded("x"))).not.toEqual(seq(c));
  });
  it("stays in range", () => {
    const r = seeded(7);
    for (let i = 0; i < 500; i++) {
      const n = r.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      expect(r.int(6)).toBeLessThan(6);
      const x = r.range(-3, 3);
      expect(x).toBeGreaterThanOrEqual(-3);
      expect(x).toBeLessThan(3);
    }
  });
});
