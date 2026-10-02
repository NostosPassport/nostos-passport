/**
 * Where a stamp sits in the passport book. One function, used by the server for every stamp response and mirrored
 * (with the same test vectors) in the app, so the page and slot a person sees are the ones the server says.
 *
 * Stamps are numbered oldest first among the owner's live stamps (not hidden, not removed), starting at 0. Three slots to
 * a page, pages from 1, so the oldest stamps stay on page 1 however many come later. A spread is two facing pages.
 */
export const SLOTS_PER_PAGE = 3;
export const PAGES_PER_SPREAD = 2;

export type PageSlot = { page: number; slot: number };

/** `index` is the 0-based position among the owner's live stamps, oldest first. Page and slot both start at 1. */
export function pageAndSlot(index: number): PageSlot {
  if (!Number.isInteger(index) || index < 0) throw new RangeError("index must be a whole number, 0 or more");
  return { page: Math.floor(index / SLOTS_PER_PAGE) + 1, slot: (index % SLOTS_PER_PAGE) + 1 };
}

/** The spread (1-based) a page is on: pages 1 and 2 are spread 1, 3 and 4 are spread 2. */
export function spreadOfPage(page: number): number {
  return Math.ceil(page / PAGES_PER_SPREAD);
}

/** The next empty slot after `count` live stamps: where the next stamp will land. */
export function nextSlot(count: number): PageSlot {
  return pageAndSlot(count);
}

/** Shared test vectors: [index, page, slot]. The app's tests use the same table. */
export const LAYOUT_VECTORS: readonly [number, number, number][] = [
  [0, 1, 1], [1, 1, 2], [2, 1, 3], [3, 2, 1], [5, 2, 3], [6, 3, 1], [11, 4, 3], [12, 5, 1], [29, 10, 3],
];
