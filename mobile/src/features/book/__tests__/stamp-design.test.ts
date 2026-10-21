import { resolveCategoryStamp } from "../../../../../shared/category-stamp-artwork";
import {
  MIN_INK_CONTRAST, STAMP_PAPER, STAMP_GEOMETRY, arcTextSamples, buildStampScene, contrastRatio, designFromArtwork, fitStampName,
  hasFallbackGlyphs, sceneProblems, stampTextWidth, tornPhotoPath, type StampDesignInput,
} from "../../../../../shared/category-stamp-design";
import { stampSheetCases } from "../../../../../shared/category-stamp-sheets";
import { STAMP_DETAIL_SHARE, STAMP_FOOTPRINTS, footprintOf, overlapShare, slotPlacement, boxOf } from "../../../../../shared/passport-artwork";

const DATE = "19 OCT 2026";
const NAME_SIZES = { sizes1: [26, 24, 22], sizes2: [26, 24, 22, 20, 18, 16] } as const;
const input = (over: Partial<StampDesignInput> = {}): StampDesignInput => ({
  template: "restaurant", cuisine: "italian", label: "ITALIAN", icon: "pasta", color: "#143B2B", name: "Osteria della Piazza", locality: "New York", timeZone: "America/New_York", priceTier: null, ...over,
});

describe("stamp scenes keep every element clear of the photo, the border and each other", () => {
  for (const sheet of ["reference", "long", "photos"]) {
    it(`sheet ${sheet}`, () => {
      for (const c of stampSheetCases(sheet)) {
        const scene = buildStampScene(c.design, { dateLabel: DATE });
        expect(sceneProblems(scene)).toEqual([]);
      }
    });
  }
  it("holds for odd names: apostrophes, accents, CJK, Greek, Cyrillic, wide, narrow and one long word", () => {
    const names = ["L'Épicérie Française", "東京の小さな食堂", "Αθήνα Μεζεδοπωλείο", "Супер Длинное Название Заведения", "WWWWWWWW MMMMMMMM", "iiii llll iiii", "Supercalifragilisticexpialidocious", "A", "x".repeat(80)];
    for (const template of ["restaurant", "airport", "hotel", "bar"] as const) {
      for (const name of names) {
        for (const locality of ["West Village", "Saint-Jean-Cap-Ferrat-sur-Mer", ""]) {
          const scene = buildStampScene(input({ template, name, locality }), { dateLabel: DATE });
          expect([template, name, locality, sceneProblems(scene)]).toEqual([template, name, locality, []]);
        }
      }
    }
  });
});

describe("name fit rule: shrink, then wrap to two lines, then truncate", () => {
  const W = 126;
  it("keeps a short name on one line at full size", () => {
    expect(fitStampName("Joe's", W, NAME_SIZES)).toMatchObject({ lines: ["Joe's"], size: 26, truncated: false });
  });
  it("shrinks one line before wrapping", () => {
    const candidates = ["Blue Hill", "Cafe Roma", "Joe's Pizza", "Il Buco Alimentari", "Sushi Nakazawa", "Katz's Deli", "Balthazar Bar", "Peter Luger"];
    const name = candidates.find((n) => stampTextWidth(n, 26) > W && stampTextWidth(n, 22) <= W);
    expect(name).toBeDefined();
    const fit = fitStampName(name!, W, NAME_SIZES);
    expect(fit.lines).toEqual([name]);
    expect(fit.size).toBeLessThan(26);
    expect(fit.size).toBeGreaterThanOrEqual(22);
  });
  it("wraps to two lines, at the largest size that fits, when one line cannot", () => {
    const fit = fitStampName("Osteria della Piazza", W, NAME_SIZES);
    expect(fit.lines).toEqual(["Osteria", "della Piazza"]);
    expect(fit.size).toBeGreaterThanOrEqual(22);
    for (const bigger of NAME_SIZES.sizes2.filter((z) => z > fit.size)) expect(stampTextWidth("della Piazza", bigger)).toBeGreaterThan(W);
  });
  it("truncates with an ellipsis only after shrinking and wrapping, and never below 16", () => {
    const fit = fitStampName("The Extraordinary Restaurant at Washington Square Park and Gardens", W, NAME_SIZES);
    expect(fit.truncated).toBe(true);
    expect(fit.size).toBe(16);
    expect(fit.lines).toHaveLength(2);
    expect(fit.lines[1]!.endsWith("…")).toBe(true);
    for (const line of fit.lines) expect(stampTextWidth(line, fit.size)).toBeLessThanOrEqual(W);
  });
  it("never lets a line exceed the column, whatever the glyph widths", () => {
    for (const name of ["WWWWWWWWWWWW", "iiiiiiiiiiiiiiiiiiiiiii", "Ünïcödé Çafé Ñandú", "東京の小さな食堂", "Supercalifragilisticexpialidocious"]) {
      const fit = fitStampName(name, W, NAME_SIZES);
      for (const line of fit.lines) expect(stampTextWidth(line, fit.size)).toBeLessThanOrEqual(W + 0.001);
    }
  });
});

describe("text rules", () => {
  it("minimum sizes: name 16+, labels 11+ on rectangles; arc text 9+ on rounds", () => {
    for (const c of stampSheetCases("long")) {
      const scene = buildStampScene(c.design, { dateLabel: DATE });
      if (scene.template === "restaurant" || scene.template === "airport") {
        const [first, ...rest] = scene.texts;
        const nameLines = scene.texts.filter((t) => t.size >= 16 && t.y < 90);
        expect(nameLines.length).toBeGreaterThan(0);
        expect(first!.size).toBeGreaterThanOrEqual(16);
        for (const t of rest.filter((t) => t.y > 120)) expect(t.size).toBeGreaterThanOrEqual(11);
      } else {
        for (const a of scene.arcs) expect(a.size).toBeGreaterThanOrEqual(9);
      }
    }
  });
  it("keeps WEST VILLAGE whole on every template", () => {
    for (const template of ["restaurant", "airport", "hotel", "bar"] as const) {
      const scene = buildStampScene(input({ template, locality: "West Village", label: template === "bar" ? "BAR / CLUB" : "ITALIAN" }), { dateLabel: DATE });
      const all = [...scene.texts.map((t) => t.text), ...scene.arcs.map((a) => a.text)].join(" | ");
      expect(all).toContain("WEST VILLAGE");
    }
  });
  it("hides the price mark unless trusted data supplies one", () => {
    expect(buildStampScene(input(), { dateLabel: DATE }).texts.some((t) => /^\$+$/.test(t.text))).toBe(false);
    expect(buildStampScene(input({ priceTier: "$$" }), { dateLabel: DATE }).texts.some((t) => t.text === "$$")).toBe(true);
  });
  it("measures with the real font, and flags glyphs it cannot measure", () => {
    expect(stampTextWidth("WEST VILLAGE", 10)).toBeGreaterThan(stampTextWidth("west village", 10));
    expect(stampTextWidth("iiii", 10)).toBeLessThan(stampTextWidth("WWWW", 10) / 2);
    expect(hasFallbackGlyphs("L'Épicérie Française")).toBe(false);
    expect(hasFallbackGlyphs("東京の小さな食堂")).toBe(true);
  });
  it("squeezes only text drawn with a fallback font; Latin text is never squeezed", () => {
    const latin = buildStampScene(input({ name: "WWWWWWWW MMMMMMMM" }), { dateLabel: DATE });
    expect(latin.texts.every((t) => t.textLength === undefined)).toBe(true);
    const cjk = buildStampScene(input({ name: "東京の小さな食堂" }), { dateLabel: DATE });
    expect(cjk.texts.some((t) => t.textLength !== undefined)).toBe(true);
  });
  it("centers arc text with an explicit start offset (React Native ignores text-anchor on TextPath)", () => {
    const scene = buildStampScene(input({ template: "bar", name: "Midnight Social", label: "BAR / CLUB" }), { dateLabel: DATE });
    for (const a of scene.arcs) {
      expect(a.startOffset).toBeGreaterThan(0);
      const samples = arcTextSamples(a);
      expect(Math.abs(samples[0]!.base.x - 110) - Math.abs(samples[samples.length - 1]!.base.x - 110)).toBeLessThan(2);
    }
  });
});

describe("ink and paper", () => {
  it("every cuisine and bar ink meets the contrast floor on the ivory page", () => {
    const types = ["italian_restaurant", "french_restaurant", "american_restaurant", "spanish_restaurant", "lebanese_restaurant", "turkish_restaurant", "portuguese_restaurant", "ethiopian_restaurant", "mexican_restaurant", "japanese_restaurant", "korean_restaurant", "chinese_restaurant", "indian_restaurant", "thai_restaurant", "vietnamese_restaurant", "greek_restaurant", "mediterranean_restaurant", "middle_eastern_restaurant", "seafood_restaurant", "pizza_restaurant", "bakery", "cafe", "vegetarian_restaurant", "steak_house", "restaurant"];
    const arts = types.map((t) => resolveCategoryStamp({ id: t, category: "restaurant", primaryType: t })!).concat(resolveCategoryStamp({ id: "b", category: "bar", primaryType: "cocktail_bar" })!, resolveCategoryStamp({ id: "c", category: "bar", primaryType: "night_club" })!);
    for (const art of arts) {
      const design = designFromArtwork(art, { name: "x", locality: "y" });
      expect([art.cuisine, contrastRatio(design.color, STAMP_PAPER) >= MIN_INK_CONTRAST]).toEqual([art.cuisine, true]);
    }
  });
  it("has no painted backing: the scene contains only strokes, ink text, the icon and the photo", () => {
    const scene = buildStampScene(input(), { dateLabel: DATE });
    expect(scene.borders.every((b) => b.width > 0)).toBe(true);
    expect(Object.keys(scene).sort()).toEqual(["a11yLabel", "arcs", "borders", "height", "icon", "mark", "photo", "specks", "template", "texts", "truncated", "width"]);
  });
});

describe("torn photo edge", () => {
  it("is deterministic per seed and stays within a pixel or two of the nominal square", () => {
    const { x, y, s } = STAMP_GEOMETRY.restaurant.photo;
    expect(tornPhotoPath(x, y, s, "a")).toBe(tornPhotoPath(x, y, s, "a"));
    expect(tornPhotoPath(x, y, s, "a")).not.toBe(tornPhotoPath(x, y, s, "b"));
    for (const [px, py] of [...tornPhotoPath(x, y, s, "a").matchAll(/([\d.]+) ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const)) {
      expect(px).toBeGreaterThanOrEqual(x - 1.6);
      expect(px).toBeLessThanOrEqual(x + s + 1.6);
      expect(py).toBeGreaterThanOrEqual(y - 1.6);
      expect(py).toBeLessThanOrEqual(y + s + 1.6);
    }
  });
});

describe("page placement of category stamps", () => {
  const W = 360, H = 360 * 1.42;
  const kinds = ["restaurant", "airport", "hotel", "bar"] as const;
  it("three stamps stack on one page without touching, whatever the mix, and stay on the page", () => {
    for (const a of kinds) for (const b of kinds) for (const c of kinds) {
      const ps = [slotPlacement("x", 1, W, H, footprintOf({ template: a })), slotPlacement("y", 2, W, H, footprintOf({ template: b })), slotPlacement("z", 3, W, H, footprintOf({ template: c }))];
      expect(overlapShare(ps[0]!, ps[1]!)).toBe(0);
      expect(overlapShare(ps[1]!, ps[2]!)).toBe(0);
      for (const p of ps) {
        const box = boxOf(p);
        expect(box.left).toBeGreaterThan(0);
        expect(box.right).toBeLessThan(W);
        expect(box.top).toBeGreaterThan(0);
        expect(box.bottom).toBeLessThan(H);
      }
    }
  });
  it("is much larger than the old 40% box, and the detail view nearly fills the page width", () => {
    expect(STAMP_FOOTPRINTS.restaurant.share).toBeGreaterThanOrEqual(0.6);
    expect(STAMP_FOOTPRINTS.hotel.share).toBeGreaterThanOrEqual(0.5);
    for (const k of kinds) expect(STAMP_DETAIL_SHARE[k]).toBeGreaterThanOrEqual(0.8);
    expect(STAMP_DETAIL_SHARE.restaurant).toBeGreaterThanOrEqual(0.88);
  });
  it("uses the legacy neutral placement when a stamp has no category artwork", () => {
    expect(footprintOf(null)).toBeNull();
    expect(slotPlacement("q", 1, W, H, null).height).toBeUndefined();
  });
});
