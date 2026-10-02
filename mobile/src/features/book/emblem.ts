/**
 * The Nostos emblem, drawn as SVG path data in a unit circle (centered on 0,0, radius 1): two rings with ticks between them,
 * an eight-point compass star, and a small doorway at its heart. Nostos is the longing to return home: a compass to find the
 * way, a door to come back to. Original artwork; no seal, crest or logo of any country or app.
 */
const f = (n: number) => Number(n.toFixed(4));

const circle = (r: number) => `M ${f(-r)} 0 A ${r} ${r} 0 1 0 ${f(r)} 0 A ${r} ${r} 0 1 0 ${f(-r)} 0 Z`;

/** The eight-point star: long points N E S W, short points on the diagonals. */
export function starPath(long = 0.8, short = 0.5, inner = 0.17): string {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI) / 8 - Math.PI / 2;
    const r = i % 2 === 0 ? (i % 4 === 0 ? long : short) : inner;
    pts.push(`${i === 0 ? "M" : "L"} ${f(Math.cos(angle) * r)} ${f(Math.sin(angle) * r)}`);
  }
  return `${pts.join(" ")} Z`;
}

/** Short radial ticks between the two rings. */
export function ticksPath(count = 48, from = 0.9, to = 0.97): string {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count;
    out.push(`M ${f(Math.cos(a) * from)} ${f(Math.sin(a) * from)} L ${f(Math.cos(a) * to)} ${f(Math.sin(a) * to)}`);
  }
  return out.join(" ");
}

/** A doorway: an arch on two posts, at the heart of the star. */
export const doorPath = () => "M -0.07 0.1 L -0.07 -0.02 A 0.07 0.07 0 0 1 0.07 -0.02 L 0.07 0.1 Z";

export type Emblem = { rings: string[]; ticks: string; star: string; door: string };

export function emblem(): Emblem {
  return { rings: [circle(1), circle(0.9)], ticks: ticksPath(), star: starPath(), door: doorPath() };
}

/** Scale and place unit-circle path data: the paths are drawn by a canvas that applies `translate(cx, cy) scale(r)`. */
export const emblemTransform = (cx: number, cy: number, r: number) => ({ translate: [cx, cy] as const, scale: r });
