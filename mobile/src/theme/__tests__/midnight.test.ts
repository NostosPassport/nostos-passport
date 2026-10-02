/**
 * The Midnight rules, enforced: black and brass only, nothing white, and no color literal anywhere but the theme file.
 * This runs in the gate (npm run check), next to the ESLint rule `local/no-raw-design-values`.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { colors, midnight, palette } from "../midnight";

const SRC = path.resolve(__dirname, "../..");
const THEME_FILE = path.join(SRC, "theme", "midnight.ts");

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
const FUNC = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\s*\([^)]*\)/g;
const NAMED = /\b(?:color|Color|tint|Tint|background|border)\w*\s*[:=]\s*\{?\s*["'`](white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|gold|ivory|snow|whitesmoke|ghostwhite|azure)["'`]/g;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return d.name === "__tests__" || d.name === "node_modules" ? [] : walk(p);
    return /\.(ts|tsx)$/.test(d.name) && !/\.d\.ts$/.test(d.name) ? [p] : [];
  });
}

const toRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const full = h.length === 3 || h.length === 4 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
};
const key = (rgb: readonly number[]) => rgb.join(",");
/** White: every channel at or above 245 (bone, #E8E4DC, is the lightest allowed value). */
const isWhite = (rgb: readonly number[]) => Math.min(...rgb) >= 245;

describe("the Midnight palette", () => {
  const allowed = new Set(Object.values(palette).map((h) => key(toRgb(h))));

  it("is black, two near-black surfaces, brass, dim brass and three bone tones, and nothing else", () => {
    expect(Object.values(palette).map((h) => h.toUpperCase())).toEqual(["#000000", "#0B0B0D", "#141418", "#C9A24B", "#8F7434", "#E8E4DC", "#A09C94", "#6B6862"]);
    expect(midnight.name).toBe("Midnight");
  });

  it("every color in the theme file is one of those colors, alone or with an alpha", () => {
    const src = fs.readFileSync(THEME_FILE, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const hexes = src.match(HEX) ?? [];
    expect(hexes.length).toBeGreaterThanOrEqual(8);
    for (const h of hexes) expect([h, allowed.has(key(toRgb(h)))]).toEqual([h, true]);
    // rgba(...) literals are written from named brass/bone/black rgb strings; check the strings.
    for (const m of src.matchAll(/(?:BRASS|BONE|BLACK)_RGB = "([^"]+)"/g)) expect([m[1], allowed.has(m[1]!)]).toEqual([m[1], true]);
    for (const f of src.match(FUNC) ?? []) {
      const nums = f.match(/\d+/g)!.slice(0, 3).map(Number);
      // Template-built rgba (`rgba(${BRASS_RGB},0.18)`) has no digits before the interpolation: those are checked above.
      if (nums.length === 3) expect([f, allowed.has(key(nums))]).toEqual([f, true]);
    }
  });

  it("nothing in the theme is white, and no token resolves to a white or a non-palette color", () => {
    for (const [name, value] of Object.entries(colors)) {
      if (value === "transparent") continue;
      const m = /^rgba\((\d+),(\d+),(\d+),[\d.]+\)$/.exec(value);
      const rgb = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : toRgb(value);
      expect([name, isWhite(rgb), allowed.has(key(rgb))]).toEqual([name, false, true]);
    }
    expect(Math.max(...Object.values(palette).map((h) => toRgb(h).reduce((a, b) => a + b, 0) / 3))).toBeLessThan(245);
  });

  it("errors and states are brass, never another hue", () => {
    expect([colors.success, colors.warning, colors.danger]).toEqual([palette.brass, palette.brass, palette.brass]);
  });

  it("the white detector works", () => {
    expect(isWhite(toRgb("#FFFFFF"))).toBe(true);
    expect(isWhite(toRgb("#FAFAFA"))).toBe(true);
    expect(isWhite(toRgb("#fff"))).toBe(true);
    expect(isWhite(toRgb("#E8E4DC"))).toBe(false);
  });
});

describe("no color literal outside the theme file", () => {
  const files = walk(SRC).filter((f) => f !== THEME_FILE && !f.endsWith(path.join("api", "contracts.ts")));

  it("scans the whole app", () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it("finds no hex, rgb(a), hsl(a) or named color in any source file", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      for (const m of [...(src.match(HEX) ?? []), ...(src.match(FUNC) ?? []), ...[...src.matchAll(NAMED)].map((x) => x[0])]) offenders.push(`${path.relative(SRC, f)}: ${m}`);
    }
    expect(offenders).toEqual([]);
  });

  it("uses no white anywhere in the app, including the config", () => {
    for (const f of ["../app.json", "../eas.json"]) {
      const src = fs.readFileSync(path.resolve(SRC, f), "utf8");
      for (const h of src.match(HEX) ?? []) expect([f, h, isWhite(toRgb(h))]).toEqual([f, h, false]);
    }
    const app = JSON.parse(fs.readFileSync(path.resolve(SRC, "../app.json"), "utf8")).expo;
    expect(app.backgroundColor).toBe("#000000");
  });

  it("the detector catches a planted offender", () => {
    expect("const x = { color: '#FFFFFF' }".match(HEX)).toEqual(["#FFFFFF"]);
    expect("backgroundColor: 'white'".match(NAMED)?.length).toBe(1);
    expect("shadowColor: \"rgba(255,255,255,0.4)\"".match(FUNC)?.length).toBe(1);
  });
});
