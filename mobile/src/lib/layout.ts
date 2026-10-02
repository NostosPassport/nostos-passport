/**
 * Where a stamp sits in the passport book. A mirror of the server's `backend/src/lib/layout.ts` (the server computes the page
 * and slot it returns; the app uses this for the next empty slot and for jumping to a page). The same test vectors run on both.
 */
export const SLOTS_PER_PAGE = 3;
export const PAGES_PER_SPREAD = 2;

export type PageSlot = { page: number; slot: number };

export function pageAndSlot(index: number): PageSlot {
  if (!Number.isInteger(index) || index < 0) throw new RangeError("index must be a whole number, 0 or more");
  return { page: Math.floor(index / SLOTS_PER_PAGE) + 1, slot: (index % SLOTS_PER_PAGE) + 1 };
}

/** The spread (1-based) a page is on: pages 1 and 2 are spread 1. */
export const spreadOfPage = (page: number): number => Math.ceil(page / PAGES_PER_SPREAD);

/** The next empty slot after `count` live stamps. */
export const nextSlot = (count: number): PageSlot => pageAndSlot(count);

export const LAYOUT_VECTORS: readonly [number, number, number][] = [
  [0, 1, 1], [1, 1, 2], [2, 1, 3], [3, 2, 1], [5, 2, 3], [6, 3, 1], [11, 4, 3], [12, 5, 1], [29, 10, 3],
];
