import { clamp, idleSweep, SWEEP_REST, sweepFromDrag, sweepFromTilt, trackedOffsets } from "../foil";

describe("foil highlight", () => {
  it("follows a drag across the cover and stays in range", () => {
    expect(sweepFromDrag(0.5, 0, 300)).toBe(0.5);
    expect(sweepFromDrag(0.5, 150, 300)).toBeGreaterThan(0.5);
    expect(sweepFromDrag(0.5, -150, 300)).toBeLessThan(0.5);
    expect(sweepFromDrag(0.5, 100000, 300)).toBe(1.4);
    expect(sweepFromDrag(0.5, -100000, 300)).toBe(-0.4);
  });
  it("follows tilt: flat is the rest position, tilting right or left moves the band", () => {
    expect(sweepFromTilt(0)).toBe(SWEEP_REST);
    expect(sweepFromTilt(0.3)).toBeGreaterThan(SWEEP_REST);
    expect(sweepFromTilt(-0.3)).toBeLessThan(SWEEP_REST);
    expect(sweepFromTilt(10)).toBe(1.4);
  });
  it("the idle shimmer travels both ways around the rest position", () => {
    const vals = [0, 0.25, 0.5, 0.75].map(idleSweep);
    expect(Math.max(...vals)).toBeGreaterThan(SWEEP_REST);
    expect(Math.min(...vals)).toBeLessThan(SWEEP_REST);
  });
  it("tracks wordmark letters out evenly", () => {
    expect(trackedOffsets([10, 20, 10], 5)).toEqual({ xs: [0, 15, 40], total: 50 });
    expect(trackedOffsets([], 5).total).toBe(0);
    expect(clamp(5, 0, 1)).toBe(1);
  });
});
