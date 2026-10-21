import * as fs from "node:fs";
import * as path from "node:path";

import { colors, editorial, palette } from "../editorial";

const SRC = path.resolve(__dirname, "../..");
const THEME_FILE = path.join(SRC, "theme", "editorial.ts");
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
const isPureWhite = (rgb: readonly number[]) => rgb.every((channel) => channel === 255);

describe("the Editorial palette", () => {
  const allowed = new Set(Object.values(palette).map((h) => key(toRgb(h))));

  it("matches the refined paper, ink and blue Figma direction with a semantic error red", () => {
    expect(Object.values(palette).map((h) => h.toUpperCase())).toEqual([
      "#F7F4EE", "#F3EFE5", "#EEE9DD", "#123BFF", "#5F84D7", "#355078", "#55705F", "#7B4E59", "#B29872", "#6B587A", "#5A5A55", "#171714", "#5A5A55", "#74746E", "#B3261E",
    ]);
    expect(editorial.name).toBe("Editorial");
    expect(colors.background).toBe("#F3EFE5");
    expect(colors.surface).toBe("#F3EFE5");
  });

  it("keeps every literal inside the approved palette", () => {
    const src = fs.readFileSync(THEME_FILE, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const h of src.match(HEX) ?? []) expect([h, allowed.has(key(toRgb(h)))]).toEqual([h, true]);
    for (const m of src.matchAll(/(?:ACCENT|INK|PAPER)_RGB = "([^"]+)"/g)) expect([m[1], allowed.has(m[1]!)]).toEqual([m[1], true]);
    for (const f of src.match(FUNC) ?? []) {
      const nums = f.match(/\d+/g)!.slice(0, 3).map(Number);
      if (nums.length === 3) expect([f, allowed.has(key(nums))]).toEqual([f, true]);
    }
  });

  it("keeps success and warning on accent while errors use semantic red", () => {
    expect([colors.success, colors.warning, colors.danger]).toEqual([palette.brass, palette.brass, palette.danger]);
  });

  it("contains no pure white token", () => {
    for (const value of Object.values(colors)) {
      if (value === "transparent") continue;
      const m = /^rgba\((\d+),(\d+),(\d+),[\d.]+\)$/.exec(value);
      const rgb = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : toRgb(value);
      expect(isPureWhite(rgb)).toBe(false);
    }
  });
});

describe("no color literal outside the theme file", () => {
  const files = walk(SRC).filter((f) => f !== THEME_FILE && !f.endsWith(path.join("api", "contracts.ts")));

  it("scans the whole app", () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it("finds no hex, rgb(a), hsl(a) or named color in source files", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      for (const m of [...(src.match(HEX) ?? []), ...(src.match(FUNC) ?? []), ...[...src.matchAll(NAMED)].map((x) => x[0])]) offenders.push(`${path.relative(SRC, f)}: ${m}`);
    }
    expect(offenders).toEqual([]);
  });

  it("keeps config colors intentional rather than pure white", () => {
    for (const f of ["../app.json", "../eas.json"]) {
      const src = fs.readFileSync(path.resolve(SRC, f), "utf8");
      for (const h of src.match(HEX) ?? []) expect([f, h, isPureWhite(toRgb(h))]).toEqual([f, h, false]);
    }
  });
});
