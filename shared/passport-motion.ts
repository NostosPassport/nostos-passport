export const SPAN = 1.7;
export const DRAG_ZONE = 0.3;
export const TAP_ZONE = 0.16;
export const FLICK = 450;

export type Zone = "next" | "prev" | null;

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function zoneAt(x: number, pageWidth: number, share: number): Zone {
  if (x >= pageWidth * 2 - pageWidth * share && x <= pageWidth * 2) return "next";
  if (x >= 0 && x <= pageWidth * share) return "prev";
  return null;
}

export const turnProgress = (pos: number, k: number) => clamp(pos - k, 0, 1);
export const flipAngle = (progress: number) => 0 - 180 * clamp(progress, 0, 1);
export const showsBack = (progress: number) => progress >= 0.5;
export const flipShade = (progress: number) => Math.sin(clamp(progress, 0, 1) * Math.PI) * 0.65;
export const castShade = (progress: number) => Math.sin(clamp(progress, 0, 1) * Math.PI) * 0.45;

export function dragPos(startPos: number, startX: number, x: number, pageWidth: number, zone: Exclude<Zone, null>, total: number): number {
  const last = Math.max(0, total - 1);
  if (zone === "next") return clamp(startPos + (startX - x) / (pageWidth * SPAN), startPos, Math.min(startPos + 1, last));
  return clamp(startPos - (x - startX) / (pageWidth * SPAN), Math.max(startPos - 1, 0), startPos);
}

export function settleTarget(pos: number, from: number, velocityX: number, pageWidth: number, total: number): number {
  const last = Math.max(0, total - 1);
  const ahead = pos - (velocityX / (pageWidth * SPAN)) * 0.2;
  return clamp(Math.round(ahead), Math.max(from - 1, 0), Math.min(from + 1, last));
}

export const stepTarget = (from: number, dir: 1 | -1, total: number) => clamp(from + dir, 0, Math.max(0, total - 1));
