/**
 * Pure math for the passport's opening: how far open it is (0 closed .. 1 flat spread), how fast it moves, where the
 * camera has to be so the two-page spread fits the screen, and how the idle spin eases to face the viewer. No React,
 * no three, so all of it is unit tested. The Blender clip `open` itself carries the cover swing; this file only decides
 * *where in the clip* we are and how the stage frames it.
 */

/** Seconds for the full swing (the clip is 2.0 s; we scrub it, so this is also the playback speed). */
export const OPEN_SECONDS = 2;
/** The 2D reader fades in once the cover is this far open (the spread is nearly flat by then). */
export const READER_AT = 0.82;
/** Two 88 mm pages side by side, in meters (matches the Blender model). */
export const SPREAD_WIDTH = 0.176;
/** How much of the canvas width the opened spread should fill. */
export const SPREAD_FILL = 0.86;
/** The cover has finished turning to face the viewer after this share of the opening. */
export const FACE_BY = 0.35;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smoothstep = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Moves `progress` toward `target` (0 or 1) at a constant rate. With Reduce Motion it jumps, so the reader appears at
 * once and nothing swings.
 */
export function stepOpen(progress: number, target: 0 | 1, dtSeconds: number, reduceMotion: boolean): number {
  if (reduceMotion) return target;
  const dt = Math.max(0, Math.min(dtSeconds, 0.1)); // a hitch must not skip the animation
  const step = dt / OPEN_SECONDS;
  return target === 1 ? Math.min(1, progress + step) : Math.max(0, progress - step);
}

export const isOpenSettled = (progress: number, target: 0 | 1) => progress === target;

/** Camera distance that keeps the whole spread on screen: eases from the closed distance to the spread-fitting one. */
export function cameraDistance(open: number, aspect: number, fovDegrees: number, closedDistance: number): number {
  const half = Math.tan((fovDegrees * Math.PI) / 360);
  const fit = SPREAD_WIDTH / (SPREAD_FILL * 2 * half * Math.max(0.2, aspect));
  const spread = Math.min(1.4, Math.max(0.2, fit));
  return lerp(closedDistance, spread, smoothstep(open));
}

/** The idle/drag spin, eased to the nearest front-facing angle as the cover starts to open (so it never opens sideways). */
export function facingAngle(angle: number, open: number): number {
  const wrapped = angle - 2 * Math.PI * Math.round(angle / (2 * Math.PI));
  return wrapped * (1 - smoothstep(open / FACE_BY));
}

/** Tilt and idle motion fade out with the same curve; 1 = full, 0 = none. */
export const motionShare = (open: number) => 1 - smoothstep(open / FACE_BY);

/** Whether touches may rotate the book: only while it is (nearly) closed. */
export const canRotate = (open: number, target: 0 | 1) => target === 0 && open < 0.02;

/** The shadow under the book widens as the book opens into a spread. */
export const shadowSpread = (open: number) => lerp(1, 2.1, smoothstep(open));

/** Home-screen chrome (counts, Index) fades out over the first third of the opening and back in over the last third of closing. */
export const chromeOpacity = (open: number) => 1 - smoothstep(open / 0.33);
