import { SPIN, bobOffset, dragAngle, releaseVelocity, shadowWidthRatio, smoothTo, stepSpin, tiltTarget } from "../rotation";

describe("drag to spin", () => {
  it("turns the book by a fixed angle per pixel", () => {
    expect(dragAngle(0, 100)).toBeCloseTo(100 * SPIN.radPerPx);
    expect(dragAngle(1, -50)).toBeCloseTo(1 - 50 * SPIN.radPerPx);
  });

  it("release velocity comes from the last 100 ms of pointer samples only", () => {
    const old = { dx: 500, dt: 16, age: 400 };
    const recent = [{ dx: 10, dt: 16, age: 80 }, { dx: 10, dt: 16, age: 48 }, { dx: 10, dt: 16, age: 16 }];
    const v = releaseVelocity([old, ...recent]);
    expect(v).toBeCloseTo((30 * SPIN.radPerPx) / 0.048, 5);
  });

  it("no samples or a stopped finger release at zero, and velocity is clamped", () => {
    expect(releaseVelocity([])).toBe(0);
    expect(releaseVelocity([{ dx: 0, dt: 16, age: 10 }])).toBe(0);
    expect(releaseVelocity([{ dx: 9999, dt: 16, age: 10 }])).toBe(SPIN.maxVelocity);
    expect(releaseVelocity([{ dx: -9999, dt: 16, age: 10 }])).toBe(-SPIN.maxVelocity);
  });
});

describe("momentum", () => {
  it("decays smoothly toward the idle speed and never reverses", () => {
    let s = { angle: 0, velocity: 6 };
    let prev = s.velocity;
    for (let i = 0; i < 600; i++) {
      s = stepSpin(s, 1 / 60, SPIN.idleSpeed);
      expect(s.velocity).toBeLessThanOrEqual(prev + 1e-9);
      expect(s.velocity).toBeGreaterThanOrEqual(SPIN.idleSpeed - 1e-9);
      prev = s.velocity;
    }
    expect(s.velocity).toBeCloseTo(SPIN.idleSpeed, 2);
  });

  it("with idle off (Reduce Motion, Low Power) it comes to a full stop", () => {
    let s = { angle: 0, velocity: -4 };
    for (let i = 0; i < 900; i++) s = stepSpin(s, 1 / 60, 0);
    expect(s.velocity).toBe(0);
    const stopped = s.angle;
    expect(stepSpin(s, 1 / 60, 0).angle).toBe(stopped);
  });

  it("is frame rate independent: one 1/30 step equals two 1/60 steps", () => {
    const a = stepSpin({ angle: 0, velocity: 5 }, 1 / 30, 0.1);
    const b = stepSpin(stepSpin({ angle: 0, velocity: 5 }, 1 / 60, 0.1), 1 / 60, 0.1);
    expect(a.velocity).toBeCloseTo(b.velocity, 6);
    expect(Math.abs(a.angle - b.angle)).toBeLessThan(0.01);
  });

  it("clamps a long frame so a hitch cannot fling the book", () => {
    const s = stepSpin({ angle: 0, velocity: 5 }, 5, 0);
    expect(s.angle).toBeLessThan(5 * SPIN.maxStep);
  });
});

describe("tilt, bob and shadow", () => {
  it("tilt follows the finger and is clamped", () => {
    expect(tiltTarget(0, 0)).toEqual({ x: 0, y: 0 });
    expect(tiltTarget(1000, 1000).x).toBeCloseTo(SPIN.tiltMax);
    expect(tiltTarget(-1000, -1000).y).toBeCloseTo(-SPIN.tiltMax);
    const t = tiltTarget(40, 40);
    expect(Math.abs(t.x)).toBeLessThan(SPIN.tiltMax);
  });

  it("smoothTo moves toward the target and never overshoots", () => {
    let v = 0;
    for (let i = 0; i < 20; i++) {
      const next = smoothTo(v, 1, 1 / 60, SPIN.tiltRate);
      expect(next).toBeGreaterThanOrEqual(v);
      expect(next).toBeLessThanOrEqual(1);
      v = next;
    }
    expect(smoothTo(1, 1, 1 / 60, 8)).toBe(1);
  });

  it("the hover bob is a gentle sine, and zero when motion is off", () => {
    expect(bobOffset(0, true)).toBeCloseTo(0);
    const peak = Math.max(...Array.from({ length: 400 }, (_, i) => Math.abs(bobOffset(i / 100, true))));
    expect(peak).toBeGreaterThan(SPIN.bobAmp * 0.99);
    expect(peak).toBeLessThanOrEqual(SPIN.bobAmp);
    expect(bobOffset(1.234, false)).toBe(0);
  });

  it("the shadow is widest facing the viewer and narrowest edge-on, never zero", () => {
    expect(shadowWidthRatio(0)).toBeCloseTo(1);
    expect(shadowWidthRatio(Math.PI)).toBeCloseTo(1);
    const edge = shadowWidthRatio(Math.PI / 2);
    expect(edge).toBeLessThan(0.1);
    expect(edge).toBeGreaterThan(0);
    expect(shadowWidthRatio(Math.PI / 4)).toBeGreaterThan(edge);
    expect(shadowWidthRatio(-Math.PI / 2)).toBeCloseTo(edge);
  });
});
