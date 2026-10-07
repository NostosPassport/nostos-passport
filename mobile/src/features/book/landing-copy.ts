import type { NeighborhoodProgress } from "@/api/contracts";
import { seeded } from "@/lib/rng";

/** What the landing says once the stamp is down without exposing neighborhood dataset-size counts. */
export function landingCopy(page: number | null, progress: NeighborhoodProgress | null): { added: string; progress: string | null; completed: boolean } {
  const added = page === null ? "Stamped" : `Added to page ${page}`;
  if (!progress) return { added, progress: null, completed: false };
  if (progress.justCompleted) return { added, progress: `${progress.name} is complete.`, completed: true };
  if (!progress.newPlace) return { added, progress: `Another visit in ${progress.name}.`, completed: false };
  return { added, progress: `New place in ${progress.name}.`, completed: false };
}

/** Where the small photos pinned beside a stamp sit, across a page `width` wide. Same seed, same pins. */
export function photoPins(count: number, width: number, seed: string): { cx: number; size: number; rotation: number }[] {
  const n = Math.max(0, Math.min(6, count));
  if (n === 0) return [];
  const rng = seeded(`pins:${seed}`);
  const size = Math.min(width * 0.2, (width * 0.84) / n - width * 0.02);
  const step = (width * 0.84) / n;
  return Array.from({ length: n }, (_, i) => ({ cx: width * 0.08 + step * (i + 0.5), size, rotation: rng.range(-7, 7) }));
}
