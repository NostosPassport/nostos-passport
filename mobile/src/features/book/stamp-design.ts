/**
 * What a stamp looks like, as a pure function of the place. The same place always gets the same stamp; places differ by
 * SHAPE and DESIGN, never by color (ink is always brass). The border family comes from the neighborhood, so the stamps of one
 * neighborhood read as a set. Nothing here knows about the screen: it returns plain data and path strings.
 */
import { seeded } from "@/lib/rng";

export const SHAPES = ["circle", "oval", "rounded", "octagon", "hexagon"] as const;
export const MOTIFS = ["star", "diamond", "crescent", "door", "compass", "sun"] as const;
export const BORDERS = ["plain", "double", "dotted", "ticks", "dashed", "heavy"] as const;
export type Shape = (typeof SHAPES)[number];
export type Motif = (typeof MOTIFS)[number];
export type Border = (typeof BORDERS)[number];

/** Every stamp is drawn in a 120 by 120 box, the size the stroke tokens in the theme are written for. */
export const STAMP_BOX = 120;
const C = STAMP_BOX / 2;

export type Speckle = { cx: number; cy: number; r: number };
export type StampDesign = {
  shape: Shape;
  motif: Motif;
  border: Border;
  /** Circle stamps curve the name along the top; the others set it in lines. */
  layout: "arc" | "banner";
  arcText: string;
  lines: string[];
  /** 0.55 to 1: smaller for long names. */
  nameScale: number;
  area: string;
  /** How much of the ink took, 0.82 to 1. */
  ink: number;
  /** Spots where the ink did not take, drawn in the color of the paper. */
  speckles: Speckle[];
};

export type StampInput = { placeId: string; placeName: string; neighborhoodId: string | null; neighborhoodName: string };

const ELLIPSIS = "…";
const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, Math.max(1, n - 1)).trimEnd()}${ELLIPSIS}`);

/** Uppercase lines of at most `maxLine` characters, at most `maxLines` of them, ending in an ellipsis if the name is cut. */
export function fitName(name: string, maxLine = 12, maxLines = 3): string[] {
  const words = name.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const word = clip(w, maxLine);
    if (!cur) cur = word;
    else if ((cur + " " + word).length <= maxLine) cur += " " + word;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  lines.push(cur);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = clip(kept[maxLines - 1]! + ELLIPSIS, maxLine);
  return kept;
}

export function stampDesign(input: StampInput): StampDesign {
  const rng = seeded(`stamp:${input.placeId}`);
  const shape = SHAPES[rng.int(SHAPES.length)]!;
  const motif = MOTIFS[rng.int(MOTIFS.length)]!;
  const lines = fitName(input.placeName);
  const longest = Math.max(1, ...lines.map((l) => l.length));
  const dots = Array.from({ length: 6 + rng.int(7) }, () => {
    const a = rng.range(0, Math.PI * 2);
    const d = Math.sqrt(rng.next()) * C * 0.82;
    return { cx: round(C + Math.cos(a) * d), cy: round(C + Math.sin(a) * d), r: round(rng.range(0.8, 2.6)) };
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
    speckles: dots,
  };
}

/** The border family of a neighborhood. A place with no neighborhood gets a plain ring. */
export function borderFor(neighborhoodId: string | null): Border {
  if (!neighborhoodId) return "plain";
  return BORDERS[seeded(`border:${neighborhoodId}`).int(BORDERS.length)]!;
}

const round = (n: number) => Math.round(n * 100) / 100;
const f = (n: number) => `${round(n)}`;

/** A closed outline for a shape, in the 120 box, `inset` units in from the edge. */
export function shapePath(shape: Shape, inset = 6): string {
  const r = C - inset;
  switch (shape) {
    case "circle":
      return `M${f(C - r)} ${f(C)} A${f(r)} ${f(r)} 0 1 0 ${f(C + r)} ${f(C)} A${f(r)} ${f(r)} 0 1 0 ${f(C - r)} ${f(C)} Z`;
    case "oval": {
      const ry = r * 0.78;
      return `M${f(C - r)} ${f(C)} A${f(r)} ${f(ry)} 0 1 0 ${f(C + r)} ${f(C)} A${f(r)} ${f(ry)} 0 1 0 ${f(C - r)} ${f(C)} Z`;
    }
    case "rounded": {
      const k = r * 0.3;
      const [a, b] = [C - r, C + r];
      return `M${f(a + k)} ${f(a)} L${f(b - k)} ${f(a)} Q${f(b)} ${f(a)} ${f(b)} ${f(a + k)} L${f(b)} ${f(b - k)} Q${f(b)} ${f(b)} ${f(b - k)} ${f(b)} L${f(a + k)} ${f(b)} Q${f(a)} ${f(b)} ${f(a)} ${f(b - k)} L${f(a)} ${f(a + k)} Q${f(a)} ${f(a)} ${f(a + k)} ${f(a)} Z`;
    }
    case "octagon":
      return polygon(8, r, Math.PI / 8);
    case "hexagon":
      return polygon(6, r, 0);
  }
}

function polygon(n: number, r: number, turn: number): string {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = turn + (i / n) * Math.PI * 2 - Math.PI / 2;
    return `${i === 0 ? "M" : "L"}${f(C + Math.cos(a) * r)} ${f(C + Math.sin(a) * r)}`;
  });
  return pts.join(" ") + " Z";
}

export type RingSpec = { inset: number; width: number; dash: number[] | null; round: boolean };
/** The rings a border family draws, outermost first. Widths are in the 120 box (see `stampStyle.strokes`). */
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

/** The small figure at the heart of a stamp, drawn around (0, 0) inside a circle of radius `r`. Closed shapes, fill them. */
export function motifPath(motif: Motif, r: number): string {
  switch (motif) {
    case "star": {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rad = i % 2 === 0 ? r : r * 0.42;
        return `${i === 0 ? "M" : "L"}${f(Math.cos(a) * rad)} ${f(Math.sin(a) * rad)}`;
      });
      return pts.join(" ") + " Z";
    }
    case "diamond": return `M0 ${f(-r)} L${f(r * 0.7)} 0 L0 ${f(r)} L${f(-r * 0.7)} 0 Z`;
    case "crescent": return `M0 ${f(-r)} A${f(r)} ${f(r)} 0 1 0 0 ${f(r)} A${f(r * 0.75)} ${f(r * 0.75)} 0 1 1 0 ${f(-r)} Z`;
    case "door": return `M${f(-r * 0.6)} ${f(r)} L${f(-r * 0.6)} ${f(-r * 0.15)} A${f(r * 0.6)} ${f(r * 0.6)} 0 0 1 ${f(r * 0.6)} ${f(-r * 0.15)} L${f(r * 0.6)} ${f(r)} Z`;
    case "compass": {
      const pts = Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const rad = i % 2 === 0 ? r : r * 0.3;
        return `${i === 0 ? "M" : "L"}${f(Math.cos(a) * rad)} ${f(Math.sin(a) * rad)}`;
      });
      return pts.join(" ") + " Z";
    }
    case "sun": {
      const pts = Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        const rad = i % 2 === 0 ? r : r * 0.62;
        return `${i === 0 ? "M" : "L"}${f(Math.cos(a) * rad)} ${f(Math.sin(a) * rad)}`;
      });
      return pts.join(" ") + " Z";
    }
  }
}

/** The foil stamp a finished neighborhood earns: rays and a ring, named for the neighborhood. */
export type CompletionDesign = { rays: number; label: string; area: string };
export function completionDesign(neighborhoodId: string, name: string): CompletionDesign {
  const rng = seeded(`complete:${neighborhoodId}`);
  return { rays: 12 + rng.int(7) * 2, label: "COMPLETE", area: clip(name.trim().toUpperCase(), 18) };
}

/** Rays of a completion stamp as one path, from `inner` to `outer` radius around (0, 0). */
export function rayPath(rays: number, inner: number, outer: number): string {
  return Array.from({ length: rays }, (_, i) => {
    const a = (i / rays) * Math.PI * 2;
    return `M${f(Math.cos(a) * inner)} ${f(Math.sin(a) * inner)} L${f(Math.cos(a) * outer)} ${f(Math.sin(a) * outer)}`;
  }).join(" ");
}
