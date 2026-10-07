import { SOAK_SPEED, advance, createSim, idleSpeedFor, isActive, isSettled } from "../sim";
import { SPIN } from "../rotation";

const rest = { dragging: false, offsetX: 0, offsetY: 0, motion: true, soak: false };

describe("sim step", () => {
  it("idles slowly when motion is allowed, and not at all when it is off", () => {
    expect(idleSpeedFor(rest)).toBe(SPIN.idleSpeed);
    expect(idleSpeedFor({ ...rest, motion: false })).toBe(0);
    expect(idleSpeedFor({ ...rest, soak: true })).toBe(SOAK_SPEED);
    expect(idleSpeedFor({ ...rest, soak: true, motion: false })).toBe(SOAK_SPEED);
  });

  it("a finger holds the book: no momentum is applied while dragging, and the tilt follows", () => {
    const s = { ...createSim(), angle: 1, velocity: 3 };
    const n = advance(s, 1 / 60, { ...rest, dragging: true, offsetX: 200, offsetY: 200 });
    expect(n.angle).toBe(1);
    expect(n.tiltX).toBeGreaterThan(0);
    expect(n.tiltY).toBeGreaterThan(0);
  });

  it("after release the tilt returns to level and the spin coasts", () => {
    let s = { ...createSim(), velocity: 5, tiltX: 0.3, tiltY: 0.3 };
    for (let i = 0; i < 180; i++) s = advance(s, 1 / 60, rest);
    expect(Math.abs(s.tiltX)).toBeLessThan(0.01);
    expect(s.angle).toBeGreaterThan(1);
  });

  it("is active while dragging, soaking or coasting fast, and calm at idle", () => {
    expect(isActive(createSim(), { ...rest, dragging: true })).toBe(true);
    expect(isActive(createSim(), { ...rest, soak: true })).toBe(true);
    expect(isActive({ ...createSim(), velocity: 4 }, rest)).toBe(true);
    expect(isActive({ ...createSim(), velocity: SPIN.idleSpeed }, rest)).toBe(false);
  });

  it("is settled (nothing to draw) only with motion off, no finger, no spin and level", () => {
    const off = { ...rest, motion: false };
    expect(isSettled(createSim(), off)).toBe(true);
    expect(isSettled(createSim(), rest)).toBe(false);
    expect(isSettled({ ...createSim(), velocity: 1 }, off)).toBe(false);
    expect(isSettled(createSim(), { ...off, dragging: true })).toBe(false);
    expect(isSettled({ ...createSim(), tiltX: 0.2 }, off)).toBe(false);
  });
});
