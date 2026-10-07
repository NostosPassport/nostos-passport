/** Pure motion math for the 3D passport lab: drag to spin, momentum, tilt, bob and the fake shadow. No React, no three. */

export const SPIN = {
  /** Radians of spin per pixel of horizontal drag. */
  radPerPx: 0.012,
  /** Fastest spin a fling can give, rad/s. */
  maxVelocity: 14,
  /** Momentum decay rate (1/s): the spin falls to a fraction e^-k per second. */
  friction: 2.6,
  /** Slow idle rotation, rad/s. */
  idleSpeed: 0.35,
  /** Below this gap to the target speed the spin snaps to it (rad/s). */
  snap: 0.02,
  /** Longest frame treated as one step, in seconds (a hitch must not fling the book). */
  maxStep: 0.1,
  /** Pointer samples older than this do not count toward the release velocity, ms. */
  releaseWindowMs: 100,
  /** Largest tilt in radians, reached asymptotically; the finger offset (px) at which it is about 76 percent there. */
  tiltMax: 0.35,
  tiltPx: 120,
  /** How quickly the tilt follows its target (1/s). */
  tiltRate: 10,
  /** Hover bob: amplitude in scene units (meters) and frequency in Hz. */
  bobAmp: 0.004,
  bobHz: 0.35,
} as const;

/** Book size in meters, for the shadow footprint (width, height and thickness). */
export const BOOK = { wide: 0.088, tall: 0.125, thick: 0.005 } as const;

export type SpinState = { angle: number; velocity: number };
export type PointerSample = { dx: number; dt: number; age: number };

export const dragAngle = (angle: number, dxPx: number) => angle + dxPx * SPIN.radPerPx;

/** Velocity in rad/s from the pointer samples of the last 100 ms (dx in px, dt and age in ms). */
export function releaseVelocity(samples: readonly PointerSample[]): number {
  let dx = 0;
  let dt = 0;
  for (const s of samples) {
    if (s.age > SPIN.releaseWindowMs) continue;
    dx += s.dx;
    dt += s.dt;
  }
  if (dt <= 0 || dx === 0) return 0;
  const v = (dx * SPIN.radPerPx) / (dt / 1000);
  return Math.max(-SPIN.maxVelocity, Math.min(SPIN.maxVelocity, v));
}

/** One frame of momentum: the speed relaxes exponentially toward `idle` (0 when idle motion is off). Exact in dt. */
export function stepSpin(state: SpinState, dtSeconds: number, idle: number): SpinState {
  const dt = Math.max(0, Math.min(dtSeconds, SPIN.maxStep));
  const decay = Math.exp(-SPIN.friction * dt);
  const gap = state.velocity - idle;
  const angle = state.angle + idle * dt + (gap * (1 - decay)) / SPIN.friction;
  const nextGap = gap * decay;
  return { angle, velocity: Math.abs(nextGap) < SPIN.snap ? idle : idle + nextGap };
}

/** Tilt target in radians from the finger's offset in px since the touch began: x is pitch (vertical), y is roll (horizontal). */
export function tiltTarget(offsetX: number, offsetY: number): { x: number; y: number } {
  return {
    x: SPIN.tiltMax * Math.tanh(offsetY / SPIN.tiltPx) + 0,
    y: SPIN.tiltMax * Math.tanh(offsetX / SPIN.tiltPx) + 0,
  };
}

/** Move `current` toward `target` at `rate` (1/s) without overshoot. Exact in dt. */
export const smoothTo = (current: number, target: number, dtSeconds: number, rate: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dtSeconds));

/** Gentle vertical hover, in scene units. Zero when motion is off. */
export const bobOffset = (tSeconds: number, enabled: boolean) => (enabled ? SPIN.bobAmp * Math.sin(2 * Math.PI * SPIN.bobHz * tSeconds) : 0);

/** Width of the shadow ellipse as a share of its full width: the book's footprint turned by `angle` about the vertical axis. */
export const shadowWidthRatio = (angle: number) => (BOOK.wide * Math.abs(Math.cos(angle)) + BOOK.thick * Math.abs(Math.sin(angle))) / BOOK.wide;
