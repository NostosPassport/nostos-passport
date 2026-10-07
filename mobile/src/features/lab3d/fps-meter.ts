/** Average and minimum fps over the last second, from frame timestamps in ms. */

export type FpsReading = { avg: number; min: number };

const WINDOW_MS = 1000;

export function createFpsMeter() {
  let stamps: number[] = [];
  const prune = (now: number) => {
    const cutoff = now - WINDOW_MS;
    let i = 0;
    while (i < stamps.length && stamps[i]! < cutoff) i++;
    if (i > 0) stamps = stamps.slice(i);
  };
  return {
    tick(now: number) {
      stamps.push(now);
      prune(now);
    },
    read(now: number): FpsReading {
      prune(now);
      if (stamps.length < 2) return { avg: 0, min: 0 };
      let worst = 0;
      for (let i = 1; i < stamps.length; i++) worst = Math.max(worst, stamps[i]! - stamps[i - 1]!);
      const span = stamps[stamps.length - 1]! - stamps[0]!;
      return { avg: span > 0 ? ((stamps.length - 1) * 1000) / span : 0, min: worst > 0 ? 1000 / worst : 0 };
    },
    reset() {
      stamps = [];
    },
  };
}
