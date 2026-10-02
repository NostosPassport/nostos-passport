import { castShade, clamp, dragPos, flipAngle, flipShade, settleTarget, showsBack, stepTarget, turnProgress, zoneAt } from "../flip-math";

const PW = 300;

describe("turn progress", () => {
  it("is each turn's share of the way, so only the turn in flight is partway", () => {
    expect(turnProgress(2.37, 1)).toBe(1);
    expect(turnProgress(2.37, 2)).toBeCloseTo(0.37);
    expect(turnProgress(2.37, 3)).toBe(0);
    expect(turnProgress(0, 0)).toBe(0);
  });
  it("turns about the spine from 0 to minus 180 and shows the back past halfway", () => {
    expect(flipAngle(0)).toBe(0);
    expect(flipAngle(0.5)).toBe(-90);
    expect(flipAngle(1)).toBe(-180);
    expect(flipAngle(9)).toBe(-180);
    expect(showsBack(0.49)).toBe(false);
    expect(showsBack(0.5)).toBe(true);
  });
  it("shades live: nothing when flat, darkest edge-on, mirrored either side", () => {
    expect(flipShade(0)).toBeCloseTo(0);
    expect(flipShade(1)).toBeCloseTo(0);
    expect(flipShade(0.5)).toBeCloseTo(0.65);
    expect(flipShade(0.25)).toBeCloseTo(flipShade(0.75));
    expect(castShade(0.5)).toBeCloseTo(0.45);
    expect(castShade(0)).toBeCloseTo(0);
  });
});

describe("edges", () => {
  it("finds the outer edges and nothing in the middle", () => {
    expect(zoneAt(PW * 2 - 10, PW, 0.3)).toBe("next");
    expect(zoneAt(10, PW, 0.3)).toBe("prev");
    expect(zoneAt(PW, PW, 0.3)).toBeNull();
    expect(zoneAt(PW * 2 - PW * 0.3 - 1, PW, 0.3)).toBeNull();
    expect(zoneAt(-5, PW, 0.3)).toBeNull();
    expect(zoneAt(PW * 2 + 5, PW, 0.3)).toBeNull();
  });
});

describe("dragging", () => {
  it("follows the finger one to one and stops where the finger stops", () => {
    const x0 = PW * 2 - 20;
    const half = dragPos(2, x0, x0 - PW * 1.7 * 0.5, PW, "next", 6);
    expect(half).toBeCloseTo(2.5);
    expect(dragPos(2, x0, x0 - PW * 1.7 * 0.5, PW, "next", 6)).toBeCloseTo(half); // holding still changes nothing
  });
  it("only moves the way the edge turns, one spread at a time, inside the book", () => {
    const x0 = PW * 2 - 20;
    expect(dragPos(2, x0, x0 + 200, PW, "next", 6)).toBe(2); // dragging the wrong way
    expect(dragPos(2, x0, -9999, PW, "next", 6)).toBe(3); // a long drag is still one spread
    expect(dragPos(5, x0, -9999, PW, "next", 6)).toBe(5); // nothing after the last spread
    expect(dragPos(2, 20, 20 + PW * 1.7 * 0.25, PW, "prev", 6)).toBeCloseTo(1.75);
    expect(dragPos(0, 20, 9999, PW, "prev", 6)).toBe(0); // nothing before the first
  });
});

describe("letting go", () => {
  it("settles on the nearest spread", () => {
    expect(settleTarget(2.4, 2, 0, PW, 6)).toBe(2);
    expect(settleTarget(2.6, 2, 0, PW, 6)).toBe(3);
    expect(settleTarget(1.4, 2, 0, PW, 6)).toBe(1);
  });
  it("lets a flick carry it over, but only one spread", () => {
    expect(settleTarget(2.2, 2, -1500, PW, 6)).toBe(3);
    expect(settleTarget(2.8, 2, 1500, PW, 6)).toBe(2);
    expect(settleTarget(2.2, 2, -90000, PW, 6)).toBe(3);
    expect(settleTarget(2.45, 2, -100, PW, 6)).toBe(2);
  });
  it("never leaves the book", () => {
    expect(settleTarget(5.4, 5, -9999, PW, 6)).toBe(5);
    expect(settleTarget(0.3, 0, 9999, PW, 6)).toBe(0);
    expect(stepTarget(0, -1, 6)).toBe(0);
    expect(stepTarget(5, 1, 6)).toBe(5);
    expect(stepTarget(2, 1, 6)).toBe(3);
    expect(clamp(5, 0, 3)).toBe(3);
  });
});
