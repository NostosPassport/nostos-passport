export const PASSPORT_PAGE_ASPECT = 1.42;
export const STAMP_BOX = 120;
export const STAMP_SHARE = 0.4;

export const SHAPES = ["circle", "oval", "rounded", "octagon", "hexagon"] as const;
export const MOTIFS = ["star", "diamond", "crescent", "door", "compass", "sun"] as const;
export const BORDERS = ["plain", "double", "dotted", "ticks", "dashed", "heavy"] as const;

export type Shape = (typeof SHAPES)[number];
export type Motif = (typeof MOTIFS)[number];
export type Border = (typeof BORDERS)[number];

export const STAMP_ARTWORK_STYLE = {
  strokes: { ring: 3, hair: 1.2, text: 2 },
  text: {
    name: 11,
    area: 6.5,
    arcTrack: 1.2,
    bannerTrack: 1,
    completeWord: 13,
    completeTrack: 2,
    completeArea: 7,
  },
  maxTiltDeg: 11,
} as const;

export type Placement = { cx: number; cy: number; size: number; rotation: number };
export type Speckle = { cx: number; cy: number; r: number };
export type StampInput = { placeId: string; placeName: string; neighborhoodId: string | null; neighborhoodName: string };
export type StampDesign = {
  shape: Shape;
  motif: Motif;
  border: Border;
  layout: "arc" | "banner";
  arcText: string;
  lines: string[];
  nameScale: number;
  area: string;
  ink: number;
  speckles: Speckle[];
};
export type RingSpec = { inset: number; width: number; dash: number[] | null; round: boolean };
export type CompletionDesign = { rays: number; label: string; area: string };

const MID = STAMP_BOX / 2;
const SLOT_X = [0.34, 0.66, 0.4] as const;
const SLOT_TOP = 0.13;
const SLOT_BOTTOM = 0.87;
const SLOT_JITTER = 0.025;
const ELLIPSIS = "…";

export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

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
    range: (min: number, max: number) => min + next() * (max - min),
    int: (n: number) => Math.floor(next() * n),
    pick: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
  };
}

export function slotPlacement(seed: string, slot: number, width: number, height: number): Placement {
  if (!Number.isInteger(slot) || slot < 1 || slot > 3) throw new RangeError("slot is 1, 2 or 3");
  const rng = seeded(`${seed}:${slot}`);
  const pitch = ((SLOT_BOTTOM - SLOT_TOP) * height) / 3;
  const jx = rng.range(-SLOT_JITTER, SLOT_JITTER) * width;
  const jy = rng.range(-SLOT_JITTER, SLOT_JITTER) * width;
  return {
    cx: SLOT_X[slot - 1]! * width + jx,
    cy: SLOT_TOP * height + pitch * (slot - 0.5) + jy,
    size: STAMP_SHARE * width,
    rotation: rng.range(-STAMP_ARTWORK_STYLE.maxTiltDeg, STAMP_ARTWORK_STYLE.maxTiltDeg),
  };
}

export const boxOf = (placement: Placement) => ({
  left: placement.cx - placement.size / 2,
  top: placement.cy - placement.size / 2,
  right: placement.cx + placement.size / 2,
  bottom: placement.cy + placement.size / 2,
});

export function overlapShare(a: Placement, b: Placement): number {
  const A = boxOf(a);
  const B = boxOf(b);
  const width = Math.min(A.right, B.right) - Math.max(A.left, B.left);
  const height = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
  if (width <= 0 || height <= 0) return 0;
  return (width * height) / Math.min(a.size * a.size, b.size * b.size);
}

const clip = (value: string, max: number) => value.length <= max ? value : `${value.slice(0, Math.max(1, max - 1)).trimEnd()}${ELLIPSIS}`;
const round = (value: number) => Math.round(value * 100) / 100;
const f = (value: number) => `${round(value)}`;

export function fitName(name: string, maxLine = 12, maxLines = 3): string[] {
  const words = name.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = "";
  for (const raw of words) {
    const word = clip(raw, maxLine);
    if (!current) current = word;
    else if (`${current} ${word}`.length <= maxLine) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = clip(`${kept[maxLines - 1]}${ELLIPSIS}`, maxLine);
  return kept;
}

export function borderFor(neighborhoodId: string | null): Border {
  if (!neighborhoodId) return "plain";
  return BORDERS[seeded(`border:${neighborhoodId}`).int(BORDERS.length)]!;
}

export function stampDesign(input: StampInput): StampDesign {
  const rng = seeded(`stamp:${input.placeId}`);
  const shape = SHAPES[rng.int(SHAPES.length)]!;
  const motif = MOTIFS[rng.int(MOTIFS.length)]!;
  const lines = fitName(input.placeName);
  const longest = Math.max(1, ...lines.map((line) => line.length));
  const speckles = Array.from({ length: 6 + rng.int(7) }, () => {
    const angle = rng.range(0, Math.PI * 2);
    const distance = Math.sqrt(rng.next()) * MID * 0.82;
    return { cx: round(MID + Math.cos(angle) * distance), cy: round(MID + Math.sin(angle) * distance), r: round(rng.range(0.8, 2.6)) };
  });
  return {
    shape,
    motif,
    border: borderFor(input.neighborhoodId),
    layout: shape === "circle" ? "arc" : "banner",
    arcText: clip(input.placeName.trim().toUpperCase(), 20),
    lines,
    nameScale: Math.min(1, Math.max(0.55, 10 / longest)),
    area: clip(input.neighborhoodName.trim().toUpperCase(), 18),
    ink: round(rng.range(0.82, 1)),
    speckles,
  };
}

function polygon(points: number, radius: number, turn: number): string {
  return Array.from({ length: points }, (_, index) => {
    const angle = turn + (index / points) * Math.PI * 2 - Math.PI / 2;
    return `${index === 0 ? "M" : "L"}${f(MID + Math.cos(angle) * radius)} ${f(MID + Math.sin(angle) * radius)}`;
  }).join(" ") + " Z";
}

export function shapePath(shape: Shape, inset = 6): string {
  const radius = MID - inset;
  switch (shape) {
    case "circle":
      return `M${f(MID - radius)} ${f(MID)} A${f(radius)} ${f(radius)} 0 1 0 ${f(MID + radius)} ${f(MID)} A${f(radius)} ${f(radius)} 0 1 0 ${f(MID - radius)} ${f(MID)} Z`;
    case "oval": {
      const ry = radius * 0.78;
      return `M${f(MID - radius)} ${f(MID)} A${f(radius)} ${f(ry)} 0 1 0 ${f(MID + radius)} ${f(MID)} A${f(radius)} ${f(ry)} 0 1 0 ${f(MID - radius)} ${f(MID)} Z`;
    }
    case "rounded": {
      const k = radius * 0.3;
      const a = MID - radius;
      const b = MID + radius;
      return `M${f(a + k)} ${f(a)} L${f(b - k)} ${f(a)} Q${f(b)} ${f(a)} ${f(b)} ${f(a + k)} L${f(b)} ${f(b - k)} Q${f(b)} ${f(b)} ${f(b - k)} ${f(b)} L${f(a + k)} ${f(b)} Q${f(a)} ${f(b)} ${f(a)} ${f(b - k)} L${f(a)} ${f(a + k)} Q${f(a)} ${f(a)} ${f(a + k)} ${f(a)} Z`;
    }
    case "octagon":
      return polygon(8, radius, Math.PI / 8);
    case "hexagon":
      return polygon(6, radius, 0);
  }
}

export function ringsFor(border: Border, strokes: { ring: number; hair: number }): RingSpec[] {
  const { ring, hair } = strokes;
  switch (border) {
    case "plain": return [{ inset: 6, width: ring, dash: null, round: false }];
    case "double": return [{ inset: 6, width: ring, dash: null, round: false }, { inset: 12, width: hair, dash: null, round: false }];
    case "dotted": return [{ inset: 6, width: ring, dash: [0.1, ring * 1.8], round: true }, { inset: 12, width: hair, dash: null, round: false }];
    case "ticks": return [{ inset: 6, width: ring, dash: [1.4, 3.4], round: false }, { inset: 12, width: hair, dash: null, round: false }];
    case "dashed": return [{ inset: 6, width: ring, dash: [10, 4], round: false }];
    case "heavy": return [{ inset: 6, width: ring * 1.7, dash: null, round: false }, { inset: 13, width: hair, dash: null, round: false }];
  }
}

export function motifPath(motif: Motif, radius: number): string {
  switch (motif) {
    case "star": {
      const points = Array.from({ length: 10 }, (_, index) => {
        const angle = (index / 10) * Math.PI * 2 - Math.PI / 2;
        const r = index % 2 === 0 ? radius : radius * 0.42;
        return `${index === 0 ? "M" : "L"}${f(Math.cos(angle) * r)} ${f(Math.sin(angle) * r)}`;
      });
      return points.join(" ") + " Z";
    }
    case "diamond": return `M0 ${f(-radius)} L${f(radius * 0.7)} 0 L0 ${f(radius)} L${f(-radius * 0.7)} 0 Z`;
    case "crescent": return `M0 ${f(-radius)} A${f(radius)} ${f(radius)} 0 1 0 0 ${f(radius)} A${f(radius * 0.75)} ${f(radius * 0.75)} 0 1 1 0 ${f(-radius)} Z`;
    case "door": return `M${f(-radius * 0.6)} ${f(radius)} L${f(-radius * 0.6)} ${f(-radius * 0.15)} A${f(radius * 0.6)} ${f(radius * 0.6)} 0 0 1 ${f(radius * 0.6)} ${f(-radius * 0.15)} L${f(radius * 0.6)} ${f(radius)} Z`;
    case "compass": {
      const points = Array.from({ length: 8 }, (_, index) => {
        const angle = (index / 8) * Math.PI * 2 - Math.PI / 2;
        const r = index % 2 === 0 ? radius : radius * 0.3;
        return `${index === 0 ? "M" : "L"}${f(Math.cos(angle) * r)} ${f(Math.sin(angle) * r)}`;
      });
      return points.join(" ") + " Z";
    }
    case "sun": {
      const points = Array.from({ length: 24 }, (_, index) => {
        const angle = (index / 24) * Math.PI * 2;
        const r = index % 2 === 0 ? radius : radius * 0.62;
        return `${index === 0 ? "M" : "L"}${f(Math.cos(angle) * r)} ${f(Math.sin(angle) * r)}`;
      });
      return points.join(" ") + " Z";
    }
  }
}

export function completionDesign(neighborhoodId: string, name: string): CompletionDesign {
  const rng = seeded(`complete:${neighborhoodId}`);
  return { rays: 12 + rng.int(7) * 2, label: "COMPLETE", area: clip(name.trim().toUpperCase(), 18) };
}

export function rayPath(rays: number, inner: number, outer: number): string {
  return Array.from({ length: rays }, (_, index) => {
    const angle = (index / rays) * Math.PI * 2;
    return `M${f(Math.cos(angle) * inner)} ${f(Math.sin(angle) * inner)} L${f(Math.cos(angle) * outer)} ${f(Math.sin(angle) * outer)}`;
  }).join(" ");
}

const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);

export function rosettePath(seed: string, cx: number, cy: number, radius: number, steps = 720): string {
  const rng = seeded(`rosette:${seed}`);
  const R = 5 + rng.int(5);
  let r = 2 + rng.int(3);
  if (gcd(R, r) === R) r += 1;
  const d = r * rng.range(0.6, 1.2);
  const turns = r / gcd(R, r);
  const fit = radius / (R - r + d);
  const points: string[] = [];
  for (let index = 0; index <= steps; index++) {
    const t = (index / steps) * Math.PI * 2 * turns;
    const x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
    points.push(`${index === 0 ? "M" : "L"}${round(cx + x * fit)} ${round(cy + y * fit)}`);
  }
  return points.join(" ") + " Z";
}

export function wavePaths(seed: string, width: number, bandHeight: number, lines = 5, samples = 48): string[] {
  const rng = seeded(`waves:${seed}`);
  const frequency = 2 + rng.int(3);
  const base = rng.range(0, Math.PI * 2);
  const amplitude = bandHeight * 0.3;
  return Array.from({ length: lines }, (_, line) => {
    const phase = base + (line / lines) * Math.PI;
    const points: string[] = [];
    for (let index = 0; index <= samples; index++) {
      const x = (index / samples) * width;
      const y = bandHeight / 2 + amplitude * Math.sin((index / samples) * Math.PI * 2 * frequency + phase) + (line - (lines - 1) / 2) * (bandHeight * 0.08);
      points.push(`${index === 0 ? "M" : "L"}${round(x)} ${round(y)}`);
    }
    return points.join(" ");
  });
}
