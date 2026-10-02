/** Deterministic randomness for the book: the same input always gives the same look. */

/** FNV-1a: a string to a 32-bit number. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32: a small seeded generator. `next()` is in [0, 1). */
export function seeded(seed: number | string) {
  let a = (typeof seed === "string" ? hashString(seed) : seed) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** A float in [min, max). */
    range: (min: number, max: number) => min + next() * (max - min),
    /** An integer in [0, n). */
    int: (n: number) => Math.floor(next() * n),
    pick: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
  };
}
