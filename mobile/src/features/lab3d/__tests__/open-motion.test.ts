import { FACE_BY, OPEN_SECONDS, READER_AT, SPREAD_FILL, SPREAD_WIDTH, cameraDistance, canRotate, chromeOpacity, facingAngle, isOpenSettled, motionShare, shadowSpread, stepOpen } from "../open-motion";

const FOV = 30;
const visibleWidth = (distance: number, aspect: number) => 2 * distance * Math.tan((FOV * Math.PI) / 360) * aspect;

describe("stepOpen", () => {
  it("takes OPEN_SECONDS to open at 60 fps and OPEN_SECONDS to close again", () => {
    let p = 0;
    let frames = 0;
    while (p < 1 && frames < 1000) {
      p = stepOpen(p, 1, 1 / 60, false);
      frames++;
    }
    expect(frames / 60).toBeCloseTo(OPEN_SECONDS, 1);
    frames = 0;
    while (p > 0 && frames < 1000) {
      p = stepOpen(p, 0, 1 / 60, false);
      frames++;
    }
    expect(frames / 60).toBeCloseTo(OPEN_SECONDS, 1);
  });
  it("never overshoots either end", () => {
    expect(stepOpen(0.99, 1, 0.1, false)).toBe(1);
    expect(stepOpen(0.01, 0, 0.1, false)).toBe(0);
  });
  it("a long hitch is one capped step, not a skipped animation", () => {
    expect(stepOpen(0, 1, 5, false)).toBeCloseTo(0.1 / OPEN_SECONDS, 6);
  });
  it("Reduce Motion jumps straight to the target both ways", () => {
    expect(stepOpen(0, 1, 0, true)).toBe(1);
    expect(stepOpen(1, 0, 0, true)).toBe(0);
  });
  it("is settled only when it equals the target", () => {
    expect(isOpenSettled(0.5, 1)).toBe(false);
    expect(isOpenSettled(1, 1)).toBe(true);
    expect(isOpenSettled(0, 0)).toBe(true);
  });
});

describe("cameraDistance", () => {
  it("stays at the closed distance while closed", () => {
    expect(cameraDistance(0, 0.85, FOV, 0.42)).toBeCloseTo(0.42, 6);
  });
  it.each([0.46, 0.85, 1.4])("fits the whole spread at the SPREAD_FILL share of the screen width (aspect %s)", (aspect) => {
    const d = cameraDistance(1, aspect, FOV, 0.42);
    expect(visibleWidth(d, aspect) * SPREAD_FILL).toBeCloseTo(SPREAD_WIDTH, 3);
  });
  it("moves monotonically between the two (no jerk back)", () => {
    const ds = [0, 0.2, 0.4, 0.6, 0.8, 1].map((o) => cameraDistance(o, 0.46, FOV, 0.42));
    for (let i = 1; i < ds.length; i++) expect(ds[i]).toBeGreaterThanOrEqual(ds[i - 1]!);
  });
});

describe("facingAngle", () => {
  it("leaves the spin alone while closed, modulo full turns", () => {
    expect(facingAngle(0.3, 0)).toBeCloseTo(0.3, 6);
    expect(facingAngle(2 * Math.PI + 0.3, 0)).toBeCloseTo(0.3, 6);
  });
  it("squares the book to the viewer by FACE_BY, from whichever side it was spinning", () => {
    for (const a of [0.3, -2.9, 3.0, 7, -11]) expect(facingAngle(a, FACE_BY)).toBeCloseTo(0, 6);
  });
  it("takes the short way round (a book at 3.0 rad goes to 0 through its small remainder, not a full turn)", () => {
    expect(Math.abs(facingAngle(3.0, 0.05))).toBeLessThanOrEqual(Math.PI);
  });
});

describe("the rest of the opening choreography", () => {
  it("only lets a closed, resting passport be rotated", () => {
    expect(canRotate(0, 0)).toBe(true);
    expect(canRotate(0, 1)).toBe(false); // opening has been requested
    expect(canRotate(0.5, 0)).toBe(false); // still closing
    expect(canRotate(1, 1)).toBe(false);
  });
  it("hands off to the reader when the cover is nearly flat", () => {
    expect(READER_AT).toBeGreaterThan(0.7);
    expect(READER_AT).toBeLessThan(1);
  });
  it("fades the home chrome out early and the idle motion out with the facing turn", () => {
    expect(chromeOpacity(0)).toBe(1);
    expect(chromeOpacity(0.33)).toBe(0);
    expect(motionShare(0)).toBe(1);
    expect(motionShare(FACE_BY)).toBe(0);
  });
  it("widens the shadow as the book becomes a spread", () => {
    expect(shadowSpread(0)).toBe(1);
    expect(shadowSpread(1)).toBeGreaterThan(2);
  });
});
