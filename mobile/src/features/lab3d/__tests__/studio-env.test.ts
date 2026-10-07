import { buildCubeFace, buildEquirect, directionOf, envColor } from "../studio-env";

/** Brightest color channel (alpha excluded). */
const max = (a: Uint8Array) => a.reduce((m, v, i) => (i % 4 === 3 ? m : Math.max(m, v)), 0);

describe("procedural studio environment", () => {
  it("is deterministic and the right size", () => {
    const a = buildEquirect(64, 32);
    expect(a.length).toBe(64 * 32 * 4);
    expect(Array.from(buildEquirect(64, 32))).toEqual(Array.from(a));
  });

  it("has nothing pure white: no color channel reaches 245", () => {
    expect(max(buildEquirect(128, 64))).toBeLessThan(245);
    for (let f = 0; f < 6; f++) expect(max(buildCubeFace(f, 32))).toBeLessThan(245);
  });

  it("is opaque everywhere", () => {
    const a = buildEquirect(32, 16);
    for (let i = 3; i < a.length; i += 4) expect(a[i]).toBe(255);
  });

  it("has an overhead softbox: looking up is far brighter than looking at the floor", () => {
    const sum = (c: readonly number[]) => c[0]! + c[1]! + c[2]!;
    expect(sum(envColor([0, 1, 0]))).toBeGreaterThan(sum(envColor([0, -1, 0])) * 3);
  });

  it("has two vertical strips left and right of the viewer and a warm rim behind", () => {
    const sum = (c: readonly number[]) => c[0]! + c[1]! + c[2]!;
    const dark = sum(envColor([0, 0, 1]));
    expect(sum(envColor(directionOf(Math.PI / 2 - 0.1, 0.05)))).toBeGreaterThan(dark);
    expect(sum(envColor(directionOf(-Math.PI / 2 + 0.1, 0.05)))).toBeGreaterThan(dark);
    const rim = envColor(directionOf(Math.PI, 0.05));
    expect(rim[0]).toBeGreaterThan(rim[2]!); // warm: red above blue
  });

  it("directionOf returns unit vectors", () => {
    const [x, y, z] = directionOf(0.7, 0.3);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1);
  });
});
