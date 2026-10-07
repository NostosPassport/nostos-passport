import { createFinger, grab, move, release } from "../finger";
import { SPIN } from "../rotation";

describe("finger", () => {
  it("tracks the offset from the touch point and returns each step", () => {
    const f = createFinger();
    grab(f, 100, 200, 0);
    expect(move(f, 110, 195, 16)).toBe(10);
    expect(move(f, 135, 190, 32)).toBe(25);
    expect([f.offsetX, f.offsetY]).toEqual([35, -10]);
  });

  it("a fast flick releases with velocity, a held-then-released finger releases at rest", () => {
    const f = createFinger();
    grab(f, 0, 0, 0);
    for (let i = 1; i <= 5; i++) move(f, i * 10, 0, i * 16);
    expect(release(f, 90)).toBeCloseTo((50 * SPIN.radPerPx) / 0.08, 4);
    expect(f.dragging).toBe(false);
    expect([f.offsetX, f.offsetY]).toEqual([0, 0]);

    grab(f, 0, 0, 1000);
    move(f, 50, 0, 1016);
    expect(release(f, 1500)).toBe(0); // the move was long ago: the finger had stopped
  });
});
