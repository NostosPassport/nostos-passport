import { PASSPORT_PAGE_ASPECT } from "../../../../shared/passport-artwork";

export const BOOK_ASPECT = PASSPORT_PAGE_ASPECT;
export const MAX_WIDTH_SHARE = 0.84;
export const MAX_HEIGHT_SHARE = 0.6;

export type BookSize = { width: number; height: number; pageWidth: number; pageHeight: number; spineInset: number };

export function bookSize(screenWidth: number, screenHeight: number): BookSize {
  const width = Math.floor(Math.min(screenWidth * MAX_WIDTH_SHARE, (screenHeight * MAX_HEIGHT_SHARE) / BOOK_ASPECT));
  const height = Math.floor(width * BOOK_ASPECT);
  return { width, height, pageWidth: width, pageHeight: height, spineInset: Math.round(width * 0.035) };
}

export function openScale(screenWidth: number, size: BookSize, margin: number): number {
  return Math.min(1, (screenWidth - margin * 2) / (size.pageWidth * 2));
}
