/**
 * How the book is cut into spreads. Spread 0 is the inside front cover (left) facing the bearer page (right). From spread 1,
 * the stamp pages run in pairs: spread s holds pages 2s-1 and 2s, which matches `spreadOfPage` in src/lib/layout.ts.
 */
import { nextSlot, spreadOfPage } from "@/lib/layout";
import type { StampView } from "@/api/contracts";

export type PageFace = { kind: "inside-cover" } | { kind: "bearer" } | { kind: "stamps"; page: number };
export type Spread = { index: number; left: PageFace; right: PageFace };

/** Stamp pages to show: up to the page the next stamp will land on, rounded up to an even number, at least two. */
export function pageCountFor(stampCount: number): number {
  const next = nextSlot(Math.max(0, stampCount)).page;
  return Math.max(2, next + (next % 2));
}

export const spreadCountFor = (stampCount: number): number => 1 + pageCountFor(stampCount) / 2;

export function spreadAt(index: number): Spread {
  if (!Number.isInteger(index) || index < 0) throw new RangeError("spread index must be a whole number, 0 or more");
  if (index === 0) return { index, left: { kind: "inside-cover" }, right: { kind: "bearer" } };
  return { index, left: { kind: "stamps", page: index * 2 - 1 }, right: { kind: "stamps", page: index * 2 } };
}

/** The spread a stamp page is on. */
export const spreadIndexForPage = (page: number): number => spreadOfPage(page);

/** Stamps grouped by page, each page in slot order. Hidden and removed stamps (page null) never appear. */
export function groupByPage(stamps: readonly StampView[]): Map<number, StampView[]> {
  const pages = new Map<number, StampView[]>();
  for (const s of stamps) {
    if (s.page === null || s.slot === null) continue;
    const list = pages.get(s.page) ?? [];
    list.push(s);
    pages.set(s.page, list);
  }
  for (const list of pages.values()) list.sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
  return pages;
}
