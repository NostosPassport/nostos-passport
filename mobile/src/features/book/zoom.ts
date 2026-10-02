"worklet";
/** Math for dragging a photo about a page and for pinching one up full screen. Runs inside gestures, so this file is a worklet. */

export const MIN_SCALE = 1;
export const MAX_SCALE = 4;
export const DOUBLE_TAP_SCALE = 2.5;

export const clampValue = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Keep a photo's center so the whole photo stays on the page, with a small margin. Centers are in page units (px). */
export function clampCenter(cx: number, cy: number, photoSize: number, pageW: number, pageH: number, margin = 0): { cx: number; cy: number } {
  const half = photoSize / 2 + margin;
  return { cx: clampValue(cx, half, Math.max(half, pageW - half)), cy: clampValue(cy, half, Math.max(half, pageH - half)) };
}

export const clampScale = (s: number) => clampValue(s, MIN_SCALE, MAX_SCALE);

/** Double tap: zoom in, or back out if already zoomed. */
export const doubleTapScale = (current: number) => (current > 1.01 ? 1 : DOUBLE_TAP_SCALE);

/** How far a zoomed photo may be dragged: just enough to bring its edges to the edges of the view, and none at all when it fits. */
export function clampPan(tx: number, ty: number, scale: number, viewW: number, viewH: number): { tx: number; ty: number } {
  const maxX = Math.max(0, (viewW * scale - viewW) / 2);
  const maxY = Math.max(0, (viewH * scale - viewH) / 2);
  return { tx: clampValue(tx, -maxX, maxX), ty: clampValue(ty, -maxY, maxY) };
}
