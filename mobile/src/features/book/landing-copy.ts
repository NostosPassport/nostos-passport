import { seeded } from "@/lib/rng";

export function landingCopy(page: number | null): string {
  return page === null ? "Stamped" : `Added to page ${page}`;
}

export function photoPins(count: number, width: number, seed: string): { cx: number; size: number; rotation: number }[] {
  const n = Math.max(0, Math.min(6, count));
  if (n === 0) return [];
  const rng = seeded(`pins:${seed}`);
  const size = Math.min(width * 0.2, (width * 0.84) / n - width * 0.02);
  const step = (width * 0.84) / n;
  return Array.from({ length: n }, (_, i) => ({ cx: width * 0.08 + step * (i + 0.5), size, rotation: rng.range(-7, 7) }));
}
