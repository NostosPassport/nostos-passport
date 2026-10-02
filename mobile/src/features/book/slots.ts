/** Where the three stamps of a page sit: a staggered base layout plus small seeded jitter, so a page looks stamped by hand. */
import { stampStyle } from "@/theme";
import { seeded } from "@/lib/rng";

export type Placement = { cx: number; cy: number; size: number; rotation: number };

/** Centers as a share of the page width, per slot, and the share of the page height the three slots share. */
const SLOT_X = [0.34, 0.66, 0.4] as const;
const TOP = 0.13;
const BOTTOM = 0.87;
export const STAMP_SHARE = 0.4; // stamp size, as a share of the page width
const JITTER = 0.025; // of the page width, either way

export function slotPlacement(seed: string, slot: number, width: number, height: number): Placement {
  if (!Number.isInteger(slot) || slot < 1 || slot > 3) throw new RangeError("slot is 1, 2 or 3");
  const rng = seeded(`${seed}:${slot}`);
  const pitch = ((BOTTOM - TOP) * height) / 3;
  const jx = rng.range(-JITTER, JITTER) * width;
  const jy = rng.range(-JITTER, JITTER) * width;
  return {
    cx: SLOT_X[slot - 1]! * width + jx,
    cy: TOP * height + pitch * (slot - 0.5) + jy,
    size: STAMP_SHARE * width,
    rotation: rng.range(-stampStyle.maxTiltDeg, stampStyle.maxTiltDeg),
  };
}

/** The unrotated box of a placement, for overlap checks. */
export const boxOf = (p: Placement) => ({ left: p.cx - p.size / 2, top: p.cy - p.size / 2, right: p.cx + p.size / 2, bottom: p.cy + p.size / 2 });

/** Share of the smaller box covered by the overlap of two boxes. 0 when they don't touch. */
export function overlapShare(a: Placement, b: Placement): number {
  const A = boxOf(a);
  const B = boxOf(b);
  const w = Math.min(A.right, B.right) - Math.max(A.left, B.left);
  const h = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.min(a.size * a.size, b.size * b.size);
}
