// Generates simple deterministic "nightlife" placeholder PNGs for seed photos.
import { PNG } from "pngjs";
import type { Rng } from "../src/lib/rng";

function hsl(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

export function placeholderPng(rng: Rng, width = 240, height = 300): Buffer {
  const png = new PNG({ width, height });
  const hue = rng.int(0, 359);
  const lights = Array.from({ length: rng.int(4, 9) }, () => ({
    x: rng.int(0, width), y: rng.int(0, Math.floor(height * 0.6)), r: rng.int(12, 45), hue: (hue + rng.int(-60, 60) + 360) % 360,
  }));
  const crowdLine = Math.floor(height * (0.62 + rng.next() * 0.1));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = y / height;
      let [r, g, b] = hsl(hue, 0.55, 0.08 + 0.12 * (1 - t));
      for (const l of lights) {
        const d = Math.hypot(x - l.x, y - l.y);
        if (d < l.r * 2.2) {
          const glow = Math.max(0, 1 - d / (l.r * 2.2)) ** 2;
          const [lr, lg, lb] = hsl(l.hue, 0.9, 0.6);
          r += lr * glow; g += lg * glow; b += lb * glow;
        }
      }
      // silhouettes of a crowd along the bottom
      const bump = Math.sin(x / 9) * 6 + Math.sin(x / 23 + hue) * 10;
      if (y > crowdLine + bump) { r *= 0.15; g *= 0.15; b *= 0.18; }
      const i = (width * y + x) << 2;
      png.data[i] = Math.min(255, r);
      png.data[i + 1] = Math.min(255, g);
      png.data[i + 2] = Math.min(255, b);
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}
