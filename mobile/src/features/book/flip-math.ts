/**
 * Pure math for turning pages. The book keeps ONE number, `pos`, the position between spreads (2.37 is 37 percent of the way
 * from spread 2 to spread 3). Turn k (between spread k and k+1) has progress clamp(pos - k, 0, 1), so every page in flight
 * is a function of that number, and a finger, a tap and a spring all just move it.
 */
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Finger travel for one full turn, in page widths. */
export const SPAN = 1.7;
/** A drag may begin this close to the outer edge, as a share of a page width. */
export const DRAG_ZONE = 0.3;
/** A tap turns the page this close to the outer edge. */
export const TAP_ZONE = 0.16;
/** Release speed (px/s) that counts as a flick. */
export const FLICK = 450;

export type Zone = "next" | "prev" | null;

/** Which outer edge a point is on: the right page's outer edge turns forward, the left page's turns back. `x` runs 0 to 2 pages. */
export function zoneAt(x: number, pageWidth: number, share: number): Zone {
  if (x >= pageWidth * 2 - pageWidth * share && x <= pageWidth * 2) return "next";
  if (x >= 0 && x <= pageWidth * share) return "prev";
  return null;
}

/** Progress of the turn between spread k and k+1: 0 flat on the right, 1 flat on the left. */
export const turnProgress = (pos: number, k: number) => clamp(pos - k, 0, 1);

/** Degrees the page has turned about the spine. Negative: right to left. */
export const flipAngle = (progress: number) => 0 - 180 * clamp(progress, 0, 1);

/** The inside face of a turning page shows past halfway. */
export const showsBack = (progress: number) => progress >= 0.5;

/** Shade on the turning page: none when flat, darkest edge-on. */
export const flipShade = (progress: number) => Math.sin(clamp(progress, 0, 1) * Math.PI) * 0.65;

/** Shade the turning page casts on the page it is leaving or arriving on. */
export const castShade = (progress: number) => Math.sin(clamp(progress, 0, 1) * Math.PI) * 0.45;

/**
 * Where the book is while a finger drags from an edge. The page follows the finger one to one and stays wherever the
 * finger stops, so holding it halfway holds it halfway. It can only move the way the edge turns, and one spread at a time.
 */
export function dragPos(startPos: number, startX: number, x: number, pageWidth: number, zone: Exclude<Zone, null>, total: number): number {
  const last = Math.max(0, total - 1);
  if (zone === "next") return clamp(startPos + (startX - x) / (pageWidth * SPAN), startPos, Math.min(startPos + 1, last));
  return clamp(startPos - (x - startX) / (pageWidth * SPAN), Math.max(startPos - 1, 0), startPos);
}

/** The spread to settle on after a release: the nearest one, nudged along by the flick, never more than one away. */
export function settleTarget(pos: number, from: number, velocityX: number, pageWidth: number, total: number): number {
  const last = Math.max(0, total - 1);
  const ahead = pos - (velocityX / (pageWidth * SPAN)) * 0.2;
  return clamp(Math.round(ahead), Math.max(from - 1, 0), Math.min(from + 1, last));
}

/** One spread forward or back, held inside the book. */
export const stepTarget = (from: number, dir: 1 | -1, total: number) => clamp(from + dir, 0, Math.max(0, total - 1));
