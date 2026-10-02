/** The foil highlight: where the bright band sits across the cover (0 = left edge, 1 = right edge), from a drag and from tilt. */
export const SWEEP_REST = 0.5;
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** A drag of `dx` points across a cover `width` wide moves the band across the whole cover. */
export const sweepFromDrag = (base: number, dx: number, width: number) => clamp(base + (dx / width) * 1.4, -0.4, 1.4);

/** Device roll (radians, from DeviceMotion) to a sweep offset: tilting about 25 degrees sweeps the band across. */
export const sweepFromTilt = (rollRadians: number) => clamp(SWEEP_REST + (rollRadians / (Math.PI / 7)) * 0.5, -0.4, 1.4);

/** The slow idle shimmer: a small band travel so the foil is alive without being busy. */
export const idleSweep = (t: number) => SWEEP_REST + Math.sin(t * Math.PI * 2) * 0.55;

/** Letters of a wordmark with tracking: x offsets given each letter's measured width. */
export function trackedOffsets(widths: readonly number[], tracking: number): { xs: number[]; total: number } {
  const xs: number[] = [];
  let x = 0;
  for (const w of widths) {
    xs.push(x);
    x += w + tracking;
  }
  return { xs, total: Math.max(0, x - tracking) };
}
