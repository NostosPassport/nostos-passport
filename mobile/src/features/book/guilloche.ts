/** Security-paper patterns drawn behind a page: a rosette (a closed spirograph curve) and bands of interlocking waves. */
import { seeded } from "@/lib/rng";

const f2 = (n: number) => Math.round(n * 100) / 100;
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** A closed hypotrochoid fitted inside a circle of `radius` around (cx, cy). The same seed always gives the same rosette. */
export function rosettePath(seed: string, cx: number, cy: number, radius: number, steps = 720): string {
  const rng = seeded(`rosette:${seed}`);
  const R = 5 + rng.int(5); // 5..9
  let r = 2 + rng.int(3); // 2..4
  if (gcd(R, r) === R) r += 1;
  const d = r * rng.range(0.6, 1.2);
  const turns = r / gcd(R, r);
  const fit = radius / (R - r + d);
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 * turns;
    const x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
    pts.push(`${i === 0 ? "M" : "L"}${f2(cx + x * fit)} ${f2(cy + y * fit)}`);
  }
  return pts.join(" ") + " Z";
}

/** `lines` sine waves across a band `width` by `bandHeight`, each shifted a little, so they weave. */
export function wavePaths(seed: string, width: number, bandHeight: number, lines = 5, samples = 48): string[] {
  const rng = seeded(`waves:${seed}`);
  const freq = 2 + rng.int(3);
  const base = rng.range(0, Math.PI * 2);
  const amp = bandHeight * 0.3;
  return Array.from({ length: lines }, (_, k) => {
    const phase = base + (k / lines) * Math.PI;
    const pts: string[] = [];
    for (let i = 0; i <= samples; i++) {
      const x = (i / samples) * width;
      const y = bandHeight / 2 + amp * Math.sin((i / samples) * Math.PI * 2 * freq + phase) + (k - (lines - 1) / 2) * (bandHeight * 0.08);
      pts.push(`${i === 0 ? "M" : "L"}${f2(x)} ${f2(y)}`);
    }
    return pts.join(" ");
  });
}
