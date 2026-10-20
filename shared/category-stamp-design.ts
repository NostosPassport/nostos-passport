/**
 * Category stamp design: larger, higher-contrast stamps for restaurants, bars/clubs, hotels and airports.
 *
 * The layout is a pure function of a design input. `buildStampScene` returns plain drawing instructions (paths, text,
 * arc text, the photo window), and the Expo and web renderers only map those instructions to elements. Nothing about layout
 * lives in a renderer, so native and web cannot drift. Text is measured with the real Source Serif 4 SemiBold advances.
 *
 * Rendering only: the backend still sends the same artwork descriptor (kind, cuisine, label, color, icon) and the stamp is
 * drawn from it plus the place name, locality, visit date and first photo. Hotel and airport are drawn when a design input
 * asks for them; the backend does not classify those categories today.
 */
import { STAMP_FONT_ADVANCE, STAMP_FONT_CAP_HEIGHT } from "./stamp-font-metrics";
import type { CategoryStampArtwork } from "./category-stamp-artwork";
import { seeded } from "./passport-artwork";

export type StampTemplate = "restaurant" | "airport" | "hotel" | "bar";
export type StampIcon =
  | "croissant" | "burger" | "tapas" | "mezze" | "restaurant" | "pasta" | "taco" | "sushi" | "noodles" | "curry"
  | "pizza" | "bread" | "fish" | "leaf" | "bowl" | "grill" | "glass" | "music" | "plane" | "key";
export const PRICE_TIERS = ["$", "$$", "$$$", "$$$$"] as const;
export type PriceTier = (typeof PRICE_TIERS)[number];

export type StampDesignInput = {
  template: StampTemplate;
  cuisine: string;
  /** Caption label, e.g. ITALIAN, BAR / CLUB, HOTEL, AIRPORT. */
  label: string;
  icon: StampIcon;
  color: string;
  name: string;
  /** Place locality as the app already derives it. */
  locality: string;
  timeZone: string;
  /** Only ever set from trusted stored data; null hides the mark. */
  priceTier: PriceTier | null;
};

/** The ivory paper the passport pages use; stamp inks are checked against it. */
/** Luminance-mask colours for the ink specks: keep (opaque ink) and erase (a gap in the ink). Border only, never text or photo. */
export const MASK_KEEP = "#FFFFFF";
export const MASK_ERASE = "#000000";

export const STAMP_PAPER = "#F7F4EE";
export const MIN_INK_CONTRAST = 7;

export function contrastRatio(hexA: string, hexB: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  const a = lum(hexA), b = lum(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Multiplies each channel until the ink reaches the contrast floor against the paper. Hue is preserved. */
export function inkAtContrast(hex: string, paper = STAMP_PAPER, min = MIN_INK_CONTRAST): string {
  let n = parseInt(hex.slice(1), 16);
  let rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const toHex = (c: number[]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
  for (let i = 0; i < 40 && contrastRatio(toHex(rgb), paper) < min; i++) rgb = rgb.map((v) => v * 0.93);
  return toHex(rgb);
}

/** Turns the descriptor the backend already sends into the design input. Ink is darkened to meet the contrast floor on paper. */
export function designFromArtwork(art: Pick<CategoryStampArtwork, "kind" | "cuisine" | "label" | "color" | "icon">, text: { name: string; locality: string; timeZone?: string | null; priceTier?: PriceTier | null }): StampDesignInput {
  const bar = art.kind === "bar";
  return {
    template: bar ? "bar" : "restaurant",
    cuisine: art.cuisine,
    label: bar ? (art.cuisine === "nightclub" ? "NIGHTCLUB" : "BAR / CLUB") : art.label,
    icon: art.icon,
    color: inkAtContrast(art.color),
    name: (text.name ?? "").normalize("NFC").trim().replace(/\s+/gu, " "),
    locality: (text.locality ?? "").trim(),
    timeZone: text.timeZone?.trim() || "UTC",
    priceTier: text.priceTier ?? null,
  };
}

/* ---------- icons (24-unit grid, drawn as strokes except the plane) ---------- */
export const STAMP_ICON_PATHS: Record<StampIcon, { d: string; fill?: boolean; rotate?: number }> = {
  pasta: { d: "M9 3.5c-1 1.2 1 2.3 0 3.5M12 2.5c-1 1.2 1 2.3 0 3.5M15 3.5c-1 1.2 1 2.3 0 3.5M6 11.5c2-2.6 4 2.6 6 0s4 2.6 6 0M3 12.5H21M4 12.5c.4 5.2 3.4 8 8 8s7.6-2.8 8-8M9.5 22h5" },
  croissant: { d: "M3 16c1-5 4-8.5 9-8.5s8 3.5 9 8.5c-2.2 2.2-4.5 2.4-6.2 1-1.1 1.2-3.5 1.2-5.6 0-1.7 1.4-4 1.2-6.2-1zM9.5 9l1.3 7.5M14.5 9l-1.3 7.5" },
  burger: { d: "M4 10.5c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5zM3.5 13.5h17M4 16.5c2 1.5 3-1.5 5 0s3-1.5 5 0 3-1.5 6 0M4.5 19c0 1.5 1 2 2.5 2h10c1.5 0 2.5-.5 2.5-2z" },
  tapas: { d: "M3 15h18M5 15c.5 3.5 3.5 5 7 5s6.5-1.5 7-5M8 11.5l8-7M14.5 5.5l1.7 2" },
  mezze: { d: "M3 13c1 5.5 4.5 7.5 9 7.5s8-2 9-7.5zM7 13c0-3 2-4.5 5-4.5s5 1.5 5 4.5M9 5.5c.4-1.2 1.2-1.6 2-1.6" },
  restaurant: { d: "M3 17.5h18M5 17.5c0-5 3-8.5 7-8.5s7 3.5 7 8.5M12 9V7M10.5 7h3M3 20.5h18" },
  taco: { d: "M3 18c0-7 4-11.5 9-11.5s9 4.5 9 11.5zM6.5 14c2-3 9-3 11 0" },
  sushi: { d: "M4 17c0-3 2-4.5 4-4.5h8c2 0 4 1.5 4 4.5v2H4zM5 12.5c1-3.5 4-5 7-5s6 1.5 7 5M9 12.5v-2M12 12.5v-3M15 12.5v-2" },
  noodles: { d: "M3.5 12.5H20.5M4.5 12.5c.4 5 3.4 7.5 7.5 7.5s7.1-2.5 7.5-7.5M9 12.5L17 3.5M12 12.5L20 5" },
  curry: { d: "M3 13H21M4.5 13c.4 5 3.4 7.5 7.5 7.5s7.1-2.5 7.5-7.5M8.5 9.5c.5-1.8 1.5-2.5 2.5-2.5s2 .7 2.5 2.5M16 3.5l-2 6" },
  pizza: { d: "M3.5 5.5c5.5-2 11.5-2 17 0L12 21zM8 9.5h.01M12.2 8.5h.01M10 13.5h.01M14 12.5h.01" },
  bread: { d: "M5 19v-8c-2.5-1-3-5 .5-6 2-.6 3.5.8 6.5.8s4.5-1.4 6.5-.8c3.5 1 3 5 .5 6v8zM9.5 10v6M14.5 10v6" },
  fish: { d: "M3 12c3-4.5 8-6 12.5-3.5L21 6v12l-5.5-2.5C11 18 6 16.5 3 12zM7.5 11.2h.01" },
  leaf: { d: "M5 19C3.5 8 10 4 20 4c0 10-5.5 15-15 15zM5 19l9-9" },
  bowl: { d: "M3 11.5h18M4.5 11.5c.4 5.5 3.4 8.5 7.5 8.5s7.1-3 7.5-8.5M9.5 21h5M8 7c.4-1.2 1.2-1.6 2-1.6M13 7c.4-1.2 1.2-1.6 2-1.6" },
  grill: { d: "M4 9h16M5 9l1 4h12l1-4M7 13v7M17 13v7M9 5.5c0-1 1-1 1-2M13 5.5c0-1 1-1 1-2" },
  glass: { d: "M4 4.5h16l-8 9.5zM12 14v7M7.5 21h9M15.5 8.2l3-3.7" },
  music: { d: "M9 17.5V5.5l10-2v12M9 17.5a3 3 0 11-6 0 3 3 0 016 0zM19 15.5a3 3 0 11-6 0 3 3 0 016 0z" },
  plane: { d: "M21 14.5v-1.8L13.5 8V3.5a1.5 1.5 0 00-3 0V8L3 12.7v1.8l7.5-2.2v4.6L8.5 18.3V20l3.5-1 3.5 1v-1.7l-2-1.4v-4.6z", fill: true, rotate: 45 },
  key: { d: "M15.5 6a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0zM12 9.5V21M12 14.5h3.2M12 18h2.6" },
};

/* ---------- text measurement ---------- */
const CJK = /[⺀-鿿가-힯豈-﫿぀-ヿ]/u;
/** Width of a string in the stamp serif, in the same units as `size`. Glyphs outside the font fall back to estimates. */
export function stampTextWidth(text: string, size: number, tracking = 0): number {
  let em = 0, n = 0;
  for (const ch of Array.from(text.normalize("NFC"))) {
    const cp = ch.codePointAt(0)!;
    if (/\p{Mark}/u.test(ch)) continue;
    n++;
    const adv = STAMP_FONT_ADVANCE[cp];
    em += adv !== undefined ? adv / 1000 : CJK.test(ch) ? 1.02 : 0.62;
  }
  return em * size + Math.max(0, n - 1) * tracking;
}
/** True when any glyph is not in the bundled font, so the platform fallback font (not measured) will draw it. */
export function hasFallbackGlyphs(text: string): boolean {
  return Array.from(text.normalize("NFC")).some((ch) => !/\p{Mark}/u.test(ch) && STAMP_FONT_ADVANCE[ch.codePointAt(0)!] === undefined);
}

export type NameLayout = { lines: string[]; size: number; truncated: boolean };

function wrapWords(name: string, size: number, tracking: number, maxWidth: number, maxLines: number): string[] | null {
  const lines: string[] = [];
  let line = "";
  const push = (piece: string) => {
    if (!line) line = piece;
    else if (stampTextWidth(`${line} ${piece}`, size, tracking) <= maxWidth) line += ` ${piece}`;
    else { lines.push(line); line = piece; }
  };
  for (const raw of name.split(" ")) {
    if (stampTextWidth(raw, size, tracking) <= maxWidth) { push(raw); continue; }
    let part = "";
    for (const ch of Array.from(raw)) {
      if (part && stampTextWidth(part + ch, size, tracking) > maxWidth) { push(part); part = ch; } else part += ch;
    }
    if (part) push(part);
  }
  if (line) lines.push(line);
  return lines.length <= maxLines ? lines : null;
}

function ellipsize(text: string, size: number, tracking: number, maxWidth: number): string {
  if (stampTextWidth(text, size, tracking) <= maxWidth) return text;
  let out = Array.from(text);
  while (out.length > 1 && stampTextWidth(out.join("").trimEnd() + "…", size, tracking) > maxWidth) out = out.slice(0, -1);
  return out.join("").trimEnd() + "…";
}

/**
 * The name fit rule. In order: shrink the type in steps on a single line, then wrap to two lines (shrinking again),
 * then truncate the second line with an ellipsis at the smallest size. A one-word name never wraps mid-word until the
 * ellipsis stage.
 */
export function fitStampName(raw: string, maxWidth: number, opts: { sizes1: readonly number[]; sizes2: readonly number[]; tracking?: number }): NameLayout {
  const name = (raw || "").normalize("NFC").trim().replace(/\s+/gu, " ") || "UNNAMED";
  const tr = opts.tracking ?? 0;
  for (const size of opts.sizes1) if (stampTextWidth(name, size, tr) <= maxWidth) return { lines: [name], size, truncated: false };
  for (const size of opts.sizes2) {
    const lines = wrapWords(name, size, tr, maxWidth, 2);
    if (lines && !lines.some((l) => stampTextWidth(l, size, tr) > maxWidth)) return { lines, size, truncated: false };
  }
  const size = opts.sizes2[opts.sizes2.length - 1]!;
  const words = name.split(" ");
  const lines: string[] = [];
  let line = "";
  let i = 0;
  for (; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i]!;
    if (stampTextWidth(next, size, tr) <= maxWidth) line = next;
    else if (!line) { line = ellipsize(words[i]!, size, tr, maxWidth); i++; break; }
    else break;
  }
  if (line) lines.push(line);
  if (i < words.length) lines.push(ellipsize(words.slice(i).join(" "), size, tr, maxWidth));
  else if (lines.length === 1 && stampTextWidth(lines[0]!, size, tr) > maxWidth) lines[0] = ellipsize(lines[0]!, size, tr, maxWidth);
  const truncated = lines.join(" ").replace(/…/g, "") !== name;
  return { lines: lines.slice(0, 2), size, truncated };
}

/* ---------- scene ---------- */
export type SceneText = { x: number; y: number; text: string; size: number; tracking: number; anchor: "middle" | "start"; textLength?: number };
/** `startOffset` is the distance along the path where the text begins, so it is centered without relying on text-anchor (React Native SVG ignores it on TextPath). */
export type SceneArcText = { id: string; d: string; text: string; size: number; tracking: number; textLength?: number; startOffset: number };
export type SceneStroke = { d: string; width: number };
export type SceneIcon = { d: string; fill: boolean; x: number; y: number; size: number; rotate: number; strokeWidth: number };
export type StampScene = {
  template: StampTemplate;
  width: number;
  height: number;
  /** Outer and inner border strokes, drawn in the ink colour. */
  borders: SceneStroke[];
  /** Border pieces the ink mask may erase specks from. Text and photo are never masked. */
  specks: { cx: number; cy: number; r: number }[];
  photo: { x: number; y: number; s: number; clipD: string };
  texts: SceneText[];
  arcs: SceneArcText[];
  icon: SceneIcon;
  mark: { cx: number; cy: number; r: number } | null;
  a11yLabel: string;
  /** Names the fit rule had to truncate. The full name is always in a11yLabel. */
  truncated: boolean;
};

const f2 = (v: number) => Number(v.toFixed(2));
const hashStr = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };

/** A square with hand-torn edges: a deterministic seeded wobble along each side, kept inside +-amp of the nominal square. */
export function tornPhotoPath(x: number, y: number, s: number, seed: string, amp = 1.5): string {
  const rng = seeded(`torn:${seed}`);
  const N = 26;
  const walk = () => { let v = 0; return () => { v = Math.max(-amp, Math.min(amp, v * 0.55 + rng.range(-amp, amp) * 0.9)); return v; }; };
  const top = walk(), right = walk(), bottom = walk(), left = walk();
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) pts.push([x + (s * i) / N, y + top()]);
  for (let i = 0; i < N; i++) pts.push([x + s + right(), y + (s * i) / N]);
  for (let i = 0; i < N; i++) pts.push([x + s - (s * i) / N, y + s + bottom()]);
  for (let i = 0; i < N; i++) pts.push([x + left(), y + s - (s * i) / N]);
  return pts.map((p, i) => `${i ? "L" : "M"}${f2(p[0])} ${f2(p[1])}`).join("") + "Z";
}

type Geo = {
  w: number; h: number;
  photo: { x: number; y: number; s: number };
};

export const STAMP_GEOMETRY = {
  restaurant: { w: 320, h: 184, photo: { x: 24, y: 32, s: 130 } },
  airport: { w: 320, h: 184, photo: { x: 24, y: 32, s: 130 } },
  hotel: { w: 340, h: 232, photo: { x: 106, y: 46, s: 128 } },
  bar: { w: 220, h: 220, photo: { x: 58, y: 61, s: 104 } },
} as const satisfies Record<StampTemplate, Geo>;

const STROKE_OUTER = 3.6, STROKE_INNER = 1.5;
const rectBorders = (w: number, h: number): SceneStroke[] => {
  const r1 = 26, r2 = 19.5, i = 3, j = 10.5;
  const rr = (x: number, y: number, ww: number, hh: number, r: number) => `M${x + r} ${y}H${x + ww - r}A${r} ${r} 0 0 1 ${x + ww} ${y + r}V${y + hh - r}A${r} ${r} 0 0 1 ${x + ww - r} ${y + hh}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + hh - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  return [{ d: rr(i, i, w - 2 * i, h - 2 * i, r1), width: STROKE_OUTER }, { d: rr(j, j, w - 2 * j, h - 2 * j, r2), width: STROKE_INNER }];
};
const ellipsePath = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy}A${rx} ${ry} 0 1 1 ${cx + rx} ${cy}A${rx} ${ry} 0 1 1 ${cx - rx} ${cy}Z`;

function specksFor(template: StampTemplate, seed: string): { cx: number; cy: number; r: number }[] {
  const g = STAMP_GEOMETRY[template];
  const rng = seeded(`specks:${seed}`);
  const out: { cx: number; cy: number; r: number }[] = [];
  const count = 46;
  for (let i = 0; i < count; i++) {
    const outer = rng.next() < 0.6;
    const r = rng.range(0.35, 1.0);
    if (template === "restaurant" || template === "airport") {
      const inset = outer ? 3 : 10.5, t = rng.next(), side = rng.int(4);
      const w = g.w - 2 * inset, h = g.h - 2 * inset;
      const p = side === 0 ? [inset + 26 + t * (w - 52), inset] : side === 1 ? [inset + w, inset + 26 + t * (h - 52)] : side === 2 ? [inset + 26 + t * (w - 52), inset + h] : [inset, inset + 26 + t * (h - 52)];
      out.push({ cx: f2(p[0]!), cy: f2(p[1]!), r: f2(r) });
    } else {
      const a = rng.range(0, Math.PI * 2);
      const [rx, ry] = template === "hotel" ? (outer ? [165, 111] : [157, 103]) : (outer ? [106, 106] : [98, 98]);
      const [cx, cy] = [g.w / 2, g.h / 2];
      out.push({ cx: f2(cx + rx * Math.cos(a)), cy: f2(cy + ry * Math.sin(a)), r: f2(r) });
    }
  }
  return out;
}

function iconScene(icon: StampIcon, cx: number, cy: number, size: number): SceneIcon {
  const def = STAMP_ICON_PATHS[icon];
  return { d: def.d, fill: !!def.fill, x: f2(cx - size / 2), y: f2(cy - size / 2), size, rotate: def.rotate ?? 0, strokeWidth: 2.1 };
}

const upper = (s: string) => s.normalize("NFC").toLocaleUpperCase("en");
const safeLength = (text: string, size: number, tracking: number, max: number) => (hasFallbackGlyphs(text) ? Math.min(max, stampTextWidth(text, size, tracking)) : undefined);

/** Fit a single centered line by stepping the size down, then ellipsizing at the floor. */
function fitLine(text: string, maxWidth: number, sizes: readonly number[], tracking: number): { text: string; size: number } {
  for (const size of sizes) if (stampTextWidth(text, size, tracking) <= maxWidth) return { text, size };
  const size = sizes[sizes.length - 1]!;
  return { text: ellipsize(text, size, tracking, maxWidth), size };
}

/** Straight-line distance helpers used by sceneProblems to prove nothing overlaps. */
export type Box = { x0: number; y0: number; x1: number; y1: number };

/** Length of the half-ellipse arc `M x y A rx ry 0 0 sweep x y` used for stamp text paths. */
export function arcPathLength(d: string): number {
  const m = /M\s*([\d.-]+)\s+([\d.-]+)\s*A\s*([\d.-]+)\s+([\d.-]+)/.exec(d);
  if (!m) throw new Error(`unsupported arc ${d}`);
  const rx = Number(m[3]), ry = Number(m[4]);
  let len = 0, px = -rx, py = 0;
  for (let i = 1; i <= 400; i++) { const t = (Math.PI * i) / 400, x = -rx * Math.cos(t), y = ry * Math.sin(t); len += Math.hypot(x - px, y - py); px = x; py = y; }
  return len;
}

export function buildStampScene(art: StampDesignInput, opts: { seed?: string; hasPhoto?: boolean; dateLabel: string }): StampScene {
  const seed = opts.seed ?? art.name;
  const g = STAMP_GEOMETRY[art.template];
  const p = g.photo;
  const clipD = tornPhotoPath(p.x, p.y, p.s, seed);
  const texts: SceneText[] = [];
  const arcs: SceneArcText[] = [];
  const locality = upper(art.locality);
  const label = upper(art.label);
  let truncated = false;
  let borders: SceneStroke[];
  let icon: SceneIcon;
  let mark: StampScene["mark"] = null;

  if (art.template === "restaurant" || art.template === "airport") {
    borders = rectBorders(g.w, g.h);
    const cx = 232, colW = 126;
    const nameFit = fitStampName(art.name, colW, { sizes1: [26, 24, 22], sizes2: [26, 24, 22, 20, 18, 16], tracking: 0 });
    truncated = nameFit.truncated;
    const ys = nameFit.lines.length === 1 ? [64] : [50, 77];
    nameFit.lines.forEach((line, i) => texts.push({ x: cx, y: ys[i]!, text: line, size: nameFit.size, tracking: 0, anchor: "middle", textLength: safeLength(line, nameFit.size, 0, colW) }));
    icon = iconScene(art.icon, cx, 107, 34);
    const caption = (t: string, y: number, sizes: readonly number[], tr: number) => { const fit = fitLine(t, colW, sizes, tr); if (fit.text !== t) truncated = true; texts.push({ x: cx, y, text: fit.text, size: fit.size, tracking: tr, anchor: "middle", textLength: safeLength(fit.text, fit.size, tr, colW) }); };
    caption(label, 136, [13, 12, 11.5], 1.7);
    caption(locality, 150, [12, 11.5, 11], 1.5);
    if (opts.dateLabel) caption(opts.dateLabel, 164, [12, 11.5, 11], 1.3);
    if (art.priceTier) texts.push({ x: p.x, y: 25, text: art.priceTier, size: 13, tracking: 0.8, anchor: "start" });
    mark = { cx: 297, cy: 26, r: 5 };
  } else if (art.template === "bar") {
    const cx = g.w / 2, cy = g.h / 2;
    borders = [{ d: ellipsePath(cx, cy, 106, 106), width: STROKE_OUTER }, { d: ellipsePath(cx, cy, 98, 98), width: STROKE_INNER }];
    const R = 79, tr = 1.6;
    const maxArc = 2 * R * Math.sin((68 * Math.PI) / 180) * 1.0 + 0; // chord approximation of the allowed +-68 degree span
    const arcLen = R * ((136 * Math.PI) / 180);
    const nameUp = upper(art.name) || "UNNAMED";
    const fit = fitLine(nameUp, Math.min(arcLen, maxArc * 1.12), [18, 17, 16, 15, 14, 13, 12.5, 12], tr);
    if (fit.text !== nameUp) truncated = true;
    arcs.push({ startOffset: 0, id: "title", d: `M${cx - R} ${cy}A${R} ${R} 0 0 1 ${cx + R} ${cy}`, text: fit.text, size: fit.size, tracking: tr, textLength: safeLength(fit.text, fit.size, tr, arcLen) });
    const Rb = 91, labelText = [label, locality].filter(Boolean).join(" · ");
    const bArc = Rb * ((104 * Math.PI) / 180);
    const bfit = fitLine(labelText, bArc, [10.5, 10, 9.5, 9], 1.1);
    if (bfit.text !== labelText) truncated = true;
    arcs.push({ startOffset: 0, id: "foot", d: `M${cx - Rb} ${cy}A${Rb} ${Rb} 0 0 0 ${cx + Rb} ${cy}`, text: bfit.text, size: bfit.size, tracking: 1.1, textLength: safeLength(bfit.text, bfit.size, 1.1, bArc) });
    if (opts.dateLabel) texts.push({ x: cx, y: 178, text: opts.dateLabel, size: 12, tracking: 1.2, anchor: "middle" });
    icon = iconScene(art.icon, 187, 112, 28);
    if (art.priceTier) texts.push({ x: 42, y: 106, text: art.priceTier, size: 12, tracking: 0.8, anchor: "middle" });
  } else {
    const cx = g.w / 2, cy = g.h / 2;
    borders = [{ d: ellipsePath(cx, cy, 165, 111), width: STROKE_OUTER }, { d: ellipsePath(cx, cy, 157, 103), width: STROKE_INNER }];
    const rx = 140, ry = 87, tr = 1.7;
    const halfEllipse = Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
    const arcLen = halfEllipse * 0.72;
    const nameUp = upper(art.name) || "UNNAMED";
    const fit = fitLine(nameUp, arcLen, [18, 17, 16, 15, 14, 13, 12], tr);
    if (fit.text !== nameUp) truncated = true;
    arcs.push({ startOffset: 0, id: "title", d: `M${cx - rx} ${cy}A${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`, text: fit.text, size: fit.size, tracking: tr, textLength: safeLength(fit.text, fit.size, tr, arcLen) });
    const rbx = 141, rby = 94, labelText = [label, locality].filter(Boolean).join(" · ");
    const bArc = Math.PI * Math.sqrt((rbx * rbx + rby * rby) / 2) * 0.62;
    const bfit = fitLine(labelText, bArc, [12, 11.5, 11, 10.5], 1.4);
    if (bfit.text !== labelText) truncated = true;
    arcs.push({ startOffset: 0, id: "foot", d: `M${cx - rbx} ${cy}A${rbx} ${rby} 0 0 0 ${cx + rbx} ${cy}`, text: bfit.text, size: bfit.size, tracking: 1.4, textLength: safeLength(bfit.text, bfit.size, 1.4, bArc) });
    if (opts.dateLabel) texts.push({ x: cx, y: 188, text: opts.dateLabel, size: 12.5, tracking: 1.3, anchor: "middle" });
    icon = iconScene(art.icon, 288, 116, 38);
    if (art.priceTier) texts.push({ x: 56, y: 121, text: art.priceTier, size: 14, tracking: 1, anchor: "middle" });
  }
  for (const a of arcs) a.startOffset = f2(arcPathLength(a.d) / 2 - (a.textLength ?? stampTextWidth(a.text, a.size, a.tracking)) / 2);
  const a11yLabel = [art.name, art.label, art.locality, opts.dateLabel].filter(Boolean).join(", ");
  return { template: art.template, width: g.w, height: g.h, borders, specks: specksFor(art.template, seed), photo: { ...p, clipD }, texts, arcs, icon, mark, a11yLabel, truncated };
}

/* ---------- geometry proof: nothing overlaps the photo, the border or another element ---------- */
type Pt = { x: number; y: number };
type Region = { kind: "rect"; x0: number; y0: number; x1: number; y1: number; r: number } | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number };

/** The area inside the inner border line, shrunk by `margin`. */
function innerRegion(t: StampTemplate, margin: number): Region {
  const g = STAMP_GEOMETRY[t];
  if (t === "restaurant" || t === "airport") return { kind: "rect", x0: 10.5 + margin, y0: 10.5 + margin, x1: g.w - 10.5 - margin, y1: g.h - 10.5 - margin, r: 19.5 - margin };
  const [rx, ry] = t === "hotel" ? [157, 103] : [98, 98];
  return { kind: "ellipse", cx: g.w / 2, cy: g.h / 2, rx: rx - margin, ry: ry - margin };
}
function inside(region: Region, p: Pt): boolean {
  if (region.kind === "ellipse") return ((p.x - region.cx) / region.rx) ** 2 + ((p.y - region.cy) / region.ry) ** 2 <= 1;
  if (p.x < region.x0 || p.x > region.x1 || p.y < region.y0 || p.y > region.y1) return false;
  const r = Math.max(0, region.r);
  const cx = p.x < region.x0 + r ? region.x0 + r : p.x > region.x1 - r ? region.x1 - r : p.x;
  const cy = p.y < region.y0 + r ? region.y0 + r : p.y > region.y1 - r ? region.y1 - r : p.y;
  return (p.x - cx) ** 2 + (p.y - cy) ** 2 <= r * r;
}
const boxHits = (a: Box, b: Box, gap: number) => a.x0 < b.x1 + gap && a.x1 > b.x0 - gap && a.y0 < b.y1 + gap && a.y1 > b.y0 - gap;
const corners = (b: Box): Pt[] => [{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }];
const cap = (size: number) => (size * STAMP_FONT_CAP_HEIGHT) / 1000;

/** Axis-aligned box of a straight text line (caps height above the baseline; descent is ignored for uppercase captions). */
export function textBox(t: SceneText): Box {
  const w = t.textLength ?? stampTextWidth(t.text, t.size, t.tracking);
  const x0 = t.anchor === "middle" ? t.x - w / 2 : t.x;
  return { x0, x1: x0 + w, y0: t.y - cap(t.size) - 0.5, y1: t.y + t.size * 0.22 };
}

function parseArc(d: string) {
  const m = /M\s*([\d.-]+)\s+([\d.-]+)\s*A\s*([\d.-]+)\s+([\d.-]+)\s+0\s+0\s+([01])\s+([\d.-]+)\s+([\d.-]+)/.exec(d);
  if (!m) throw new Error(`unsupported arc ${d}`);
  const [x0, y0, rx, ry, sweep, x1] = [m[1], m[2], m[3], m[4], m[5], m[6]].map(Number) as [number, number, number, number, number, number];
  return { cx: (x0 + x1) / 2, cy: y0, rx, ry, top: sweep === 1 };
}

/** Samples along an arc text: baseline point and glyph-top point for the span the text actually covers. */
export function arcTextSamples(a: SceneArcText): { base: Pt; top: Pt }[] {
  const { cx, cy, rx, ry, top } = parseArc(a.d);
  const steps = 400, pts: Pt[] = [], len: number[] = [0];
  for (let i = 0; i <= steps; i++) { const t = (Math.PI * i) / steps; pts.push({ x: cx - rx * Math.cos(t), y: cy + (top ? -1 : 1) * ry * Math.sin(t) }); if (i) len.push(len[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y)); }
  const total = len[steps]!, w = a.textLength ?? stampTextWidth(a.text, a.size, a.tracking);
  const out: { base: Pt; top: Pt }[] = [];
  const h = cap(a.size);
  for (let k = 0; k <= 60; k++) {
    const target = total / 2 - w / 2 + (w * k) / 60;
    let i = len.findIndex((v) => v >= target); if (i < 1) i = 1;
    const base = pts[i]!, prev = pts[i - 1]!;
    // glyph "up" is the left-hand normal of travel: outward on the top arc, toward the centre on the bottom arc
    const tx = base.x - prev.x, ty = base.y - prev.y, n = Math.hypot(tx, ty) || 1;
    const nx = ty / n, ny = -tx / n;
    out.push({ base, top: { x: base.x + nx * h, y: base.y + ny * h } });
  }
  return out;
}

/** Empty when the scene is clean. Used by the unit tests and the dev sheets; every entry names the collision. */
export function sceneProblems(scene: StampScene): string[] {
  const out: string[] = [];
  const photo: Box = { x0: scene.photo.x - 1.6, y0: scene.photo.y - 1.6, x1: scene.photo.x + scene.photo.s + 1.6, y1: scene.photo.y + scene.photo.s + 1.6 };
  const keep = innerRegion(scene.template, 3);
  const boxes: { id: string; box: Box }[] = scene.texts.map((t, i) => ({ id: `text ${i} "${t.text}"`, box: textBox(t) }));
  const ic = scene.icon;
  boxes.push({ id: "icon", box: { x0: ic.x, y0: ic.y, x1: ic.x + ic.size, y1: ic.y + ic.size } });
  if (scene.mark) boxes.push({ id: "mark", box: { x0: scene.mark.cx - scene.mark.r, y0: scene.mark.cy - scene.mark.r, x1: scene.mark.cx + scene.mark.r, y1: scene.mark.cy + scene.mark.r } });
  for (const { id, box } of boxes) {
    if (!corners(box).every((p) => inside(keep, p))) out.push(`${id} crosses the border`);
    if (boxHits(box, photo, 2)) out.push(`${id} overlaps the photo`);
  }
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (boxHits(boxes[i]!.box, boxes[j]!.box, 0.5)) out.push(`${boxes[i]!.id} overlaps ${boxes[j]!.id}`);
  for (const a of scene.arcs) {
    const s = arcTextSamples(a);
    if (!s.every((p) => inside(keep, p.base) && inside(keep, p.top))) out.push(`arc ${a.id} crosses the border`);
    if (s.some((p) => boxHits({ x0: p.base.x, x1: p.base.x, y0: p.base.y, y1: p.base.y }, photo, 2) || boxHits({ x0: p.top.x, x1: p.top.x, y0: p.top.y, y1: p.top.y }, photo, 2))) out.push(`arc ${a.id} overlaps the photo`);
    for (const { id, box } of boxes) if (s.some((p) => boxHits({ x0: Math.min(p.base.x, p.top.x), x1: Math.max(p.base.x, p.top.x), y0: Math.min(p.base.y, p.top.y), y1: Math.max(p.base.y, p.top.y) }, box, 0.5))) out.push(`arc ${a.id} overlaps ${id}`);
  }
  if (!corners(photo).every((p) => inside(innerRegion(scene.template, 1), p))) out.push("photo crosses the border");
  return out;
}
