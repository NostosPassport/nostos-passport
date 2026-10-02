/** The passport's index: neighborhoods, how far through each you are, and the page to jump to. Pure. */
import type { NeighborhoodIndexResponse, StampView } from "@/api/contracts";
import { spreadOfPage } from "@/lib/layout";

export type IndexRow = {
  id: string;
  name: string;
  borough: string;
  visited: number;
  total: number;
  complete: boolean;
  percent: number;
  /** The first page with a stamp in this neighborhood, or null when you haven't been. */
  page: number | null;
  /** The spoken form. */
  label: string;
};

/** The earliest page each neighborhood has a stamp on. Hidden and removed stamps (no page) don't count. */
export function firstPageByNeighborhood(stamps: readonly StampView[]): Map<string, number> {
  const pages = new Map<string, number>();
  for (const s of stamps) {
    const id = s.place.neighborhoodId;
    if (!id || s.page === null) continue;
    const have = pages.get(id);
    if (have === undefined || s.page < have) pages.set(id, s.page);
  }
  return pages;
}

export function indexRows(neighborhoods: NeighborhoodIndexResponse["neighborhoods"], stamps: readonly StampView[]): IndexRow[] {
  const pages = firstPageByNeighborhood(stamps);
  return neighborhoods.map((n) => {
    const page = pages.get(n.neighborhoodId) ?? null;
    const progress = `${n.visited} of ${n.total} places`;
    return {
      id: n.neighborhoodId,
      name: n.name,
      borough: n.borough,
      visited: n.visited,
      total: n.total,
      complete: n.complete,
      percent: n.percent,
      page,
      label: `${n.name}, ${n.borough}. ${n.complete ? "Complete. " : ""}${progress}.${page ? ` First stamp on page ${page}.` : " Not started."}`,
    };
  });
}

/** The spread to turn to for a page (spread 0 is the bearer page). */
export const spreadForPage = (page: number): number => spreadOfPage(page);

/** A ring drawn as a stroked circle: how much of the circumference is filled. */
export function ringGeometry(visited: number, total: number, radius: number): { circumference: number; filled: number; fraction: number } {
  const circumference = 2 * Math.PI * radius;
  const fraction = total <= 0 ? 0 : Math.min(1, Math.max(0, visited / total));
  return { circumference, filled: circumference * fraction, fraction };
}
