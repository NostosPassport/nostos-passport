/** The size of the book on this screen. Pure, so it can be tested and reused by every part of the book. */
export const BOOK_ASPECT = 1.42; // height / width of a closed passport
export const MAX_WIDTH_SHARE = 0.84; // of the screen width
export const MAX_HEIGHT_SHARE = 0.6; // of the screen height, leaving room for the counts below

export type BookSize = { width: number; height: number; pageWidth: number; pageHeight: number; spineInset: number };

export function bookSize(screenWidth: number, screenHeight: number): BookSize {
  const width = Math.floor(Math.min(screenWidth * MAX_WIDTH_SHARE, (screenHeight * MAX_HEIGHT_SHARE) / BOOK_ASPECT));
  const height = Math.floor(width * BOOK_ASPECT);
  // An open book is two pages wide: each page is as wide as the closed cover.
  return { width, height, pageWidth: width, pageHeight: height, spineInset: Math.round(width * 0.035) };
}

/** How wide the open book is: two pages. It is scaled to fit the screen, with a margin. */
export function openScale(screenWidth: number, size: BookSize, margin: number): number {
  return Math.min(1, (screenWidth - margin * 2) / (size.pageWidth * 2));
}
