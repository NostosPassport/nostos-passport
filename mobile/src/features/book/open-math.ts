"worklet";
/** Pure math for the cover swing. progress runs 0 (closed) to 1 (open); the cover turns on its left edge. */
export const OPEN_DEGREES = 180;
export const PERSPECTIVE = 1400;

export function coverAngle(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return -OPEN_DEGREES * p;
}

/** Past the halfway point the cover shows its inside face. */
export function showsInside(progress: number): boolean {
  return progress > 0.5;
}

/** Shade on the cover while it swings: darkest edge-on, clear when flat. 0 to 1. */
export function swingShade(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return Math.sin(p * Math.PI) * 0.7;
}

/** Shade the open cover casts on the page beneath it. It fades as the cover lies down. */
export function pageShadow(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return Math.sin(p * Math.PI) * 0.55;
}
