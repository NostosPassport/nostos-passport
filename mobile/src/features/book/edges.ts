/** The visible edges of the page stacks on either side of an open book, and the ribbons that mark pinned stamps. */
import { bookStyle } from "@/theme";
import type { StampView } from "@/api/contracts";

/** How many page-edge lines show on each side: more when more pages lie that way, capped. */
export function edgeLines(spreadIndex: number, spreadTotal: number): { left: number; right: number } {
  const behind = Math.max(0, spreadIndex);
  const ahead = Math.max(0, spreadTotal - 1 - spreadIndex);
  return { left: Math.min(bookStyle.maxEdgeLines, behind), right: Math.min(bookStyle.maxEdgeLines, ahead) };
}

/** A ribbon: a strip with a swallowtail notch. Drawn in a box `w` wide and `len` long. */
export function ribbonPath(w: number, len: number, notch = w * 0.5): string {
  const f = (n: number) => Math.round(n * 100) / 100;
  return `M0 0 L${f(w)} 0 L${f(w)} ${f(len)} L${f(w / 2)} ${f(len - notch)} L0 ${f(len)} Z`;
}

/** The stamp ids that carry a ribbon on this page: the pinned ones, in the order they were pinned. */
export function ribbonsOnPage(stamps: readonly StampView[], pinnedIds: readonly string[]): string[] {
  const here = new Set(stamps.map((s) => s.id));
  return pinnedIds.filter((id) => here.has(id));
}

/** Pages that hold a pinned stamp, once each, in book order. */
export function pinnedPages(pins: readonly StampView[]): number[] {
  return [...new Set(pins.map((s) => s.page).filter((p): p is number => p !== null))].sort((a, b) => a - b);
}
