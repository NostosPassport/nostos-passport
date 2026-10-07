/** One frame of the lab's motion model: spin, momentum, tilt and time. Pure; the view feeds it the finger and reads the pose. */
import { SPIN, type SpinState, smoothTo, stepSpin, tiltTarget } from "./rotation";

export type Sim = SpinState & { tiltX: number; tiltY: number; time: number };
export type SimInput = {
  dragging: boolean;
  /** Finger offset in px since the touch began. */
  offsetX: number;
  offsetY: number;
  /** Idle spin and bob allowed (off for Reduce Motion and Low Power Mode). */
  motion: boolean;
  /** The soak test spins the book on its own, whatever the motion settings. */
  soak: boolean;
};

/** Spin speed of the soak test, rad/s: fast enough to keep the reflections moving. */
export const SOAK_SPEED = 2.2;
/** Faster than the idle speed by this much counts as coasting (frame rate stays at the active cap). */
const COASTING = 0.5;
const LEVEL = 0.002;

export const createSim = (): Sim => ({ angle: 0, velocity: 0, tiltX: 0, tiltY: 0, time: 0 });

export const idleSpeedFor = (i: SimInput) => (i.soak ? SOAK_SPEED : i.motion ? SPIN.idleSpeed : 0);

export function advance(sim: Sim, dtSeconds: number, input: SimInput): Sim {
  const dt = Math.max(0, Math.min(dtSeconds, SPIN.maxStep));
  const spun = input.dragging ? { angle: sim.angle, velocity: sim.velocity } : stepSpin(sim, dt, idleSpeedFor(input));
  const target = input.dragging ? tiltTarget(input.offsetX, input.offsetY) : { x: 0, y: 0 };
  return {
    ...spun,
    tiltX: smoothTo(sim.tiltX, target.x, dt, SPIN.tiltRate),
    tiltY: smoothTo(sim.tiltY, target.y, dt, SPIN.tiltRate),
    time: sim.time + dt,
  };
}

/** True while the render loop should use the active (60 fps) cap. */
export const isActive = (sim: Sim, input: SimInput) => input.dragging || input.soak || Math.abs(sim.velocity - idleSpeedFor(input)) > COASTING;

/** True when nothing on screen would change, so the loop can skip drawing altogether. */
export const isSettled = (sim: Sim, input: SimInput) =>
  !input.dragging && !input.soak && !input.motion && sim.velocity === 0 && Math.abs(sim.tiltX) < LEVEL && Math.abs(sim.tiltY) < LEVEL;
