import { render, screen } from "@testing-library/react-native";

import { BORDERS, MOTIFS, SHAPES, borderFor, completionDesign, fitName, motifPath, rayPath, ringsFor, shapePath, stampDesign, STAMP_BOX } from "../stamp-design";
import { CompletionStamp, StampMark } from "../StampMark";

const input = (id: string, name = "Katz's Delicatessen", hood: string | null = "n-east-village", hoodName = "East Village") => ({ placeId: id, placeName: name, neighborhoodId: hood, neighborhoodName: hoodName });

describe("stamp design", () => {
  it("is the same for the same place, every time, and different places differ", () => {
    expect(stampDesign(input("p1"))).toEqual(stampDesign(input("p1")));
    const designs = new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify(stampDesign(input(`p${i}`)))));
    expect(designs.size).toBe(40);
  });
  it("uses every shape and every motif across many places, and nothing else", () => {
    const shapes = new Set<string>();
    const motifs = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const d = stampDesign(input(`place-${i}`));
      shapes.add(d.shape);
      motifs.add(d.motif);
    }
    expect([...shapes].sort()).toEqual([...SHAPES].sort());
    expect([...motifs].sort()).toEqual([...MOTIFS].sort());
  });
  it("carries no color: variety is shape and design, ink is the theme's brass", () => {
    expect(JSON.stringify(stampDesign(input("p1")))).not.toMatch(/#|rgb|hsl/i);
  });
  it("gives every place in a neighborhood the same border family, and different neighborhoods a spread of them", () => {
    const borders = new Set(Array.from({ length: 30 }, (_, i) => stampDesign(input(`a${i}`, "X", "hood-1")).border));
    expect(borders.size).toBe(1);
    const across = new Set(Array.from({ length: 60 }, (_, i) => borderFor(`hood-${i}`)));
    expect(across.size).toBeGreaterThanOrEqual(4);
    for (const b of across) expect(BORDERS).toContain(b);
  });
  it("gives a place with no neighborhood a plain ring", () => {
    expect(stampDesign(input("p1", "Nowhere", null, "")).border).toBe("plain");
  });
  it("sets circle stamps on an arc and the rest in lines", () => {
    for (let i = 0; i < 100; i++) {
      const d = stampDesign(input(`q${i}`));
      expect(d.layout).toBe(d.shape === "circle" ? "arc" : "banner");
    }
  });
  it("keeps ink strength and speckles in range, with every speckle inside the stamp", () => {
    for (let i = 0; i < 200; i++) {
      const d = stampDesign(input(`r${i}`));
      expect(d.ink).toBeGreaterThanOrEqual(0.82);
      expect(d.ink).toBeLessThanOrEqual(1);
      expect(d.speckles.length).toBeGreaterThanOrEqual(6);
      expect(d.speckles.length).toBeLessThanOrEqual(12);
      for (const s of d.speckles) expect(Math.hypot(s.cx - STAMP_BOX / 2, s.cy - STAMP_BOX / 2)).toBeLessThanOrEqual(STAMP_BOX / 2);
    }
  });
});

describe("fitting a name", () => {
  it("uppercases and wraps on words, at most three lines of twelve", () => {
    expect(fitName("Katz's Delicatessen")).toEqual(["KATZ'S", "DELICATESSEN"]);
  });
  it("cuts a word that is too long, and a name that is too long, with an ellipsis", () => {
    expect(fitName("Supercalifragilisticexpialidocious")[0]!.endsWith("…")).toBe(true);
    const long = fitName("One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve");
    expect(long).toHaveLength(3);
    expect(long[2]!.endsWith("…")).toBe(true);
    for (const l of long) expect(l.length).toBeLessThanOrEqual(12);
  });
  it("copes with nothing, and with extra spaces", () => {
    expect(fitName("   ")).toEqual([]);
    expect(fitName("  The   Rock ")).toEqual(["THE ROCK"]);
  });
  it("shrinks the type for long names but never below a legible size", () => {
    expect(stampDesign(input("a", "Bar")).nameScale).toBe(1);
    expect(stampDesign(input("a", "Metropolitan Museum")).nameScale).toBeLessThan(1);
    expect(stampDesign(input("a", "Supercalifragilisticexpialidocious")).nameScale).toBeGreaterThanOrEqual(0.55);
  });
});

describe("shapes, borders and motifs", () => {
  it("draws every shape as one closed outline inside the box", () => {
    for (const shape of SHAPES) {
      const d = shapePath(shape, 6);
      expect(d.endsWith("Z")).toBe(true);
      expect(d.match(/M/g)).toHaveLength(1);
      for (const m of d.matchAll(/-?\d+(?:\.\d+)?/g)) {
        // Arc flags and radii are small; every coordinate stays in the box.
        expect(Number(m[0])).toBeGreaterThanOrEqual(-0.001);
        expect(Number(m[0])).toBeLessThanOrEqual(STAMP_BOX);
      }
    }
  });
  it("gives each border family rings from the outside in, using the theme's stroke widths", () => {
    const strokes = { ring: 3, hair: 1.2 };
    expect(ringsFor("plain", strokes)).toHaveLength(1);
    expect(ringsFor("double", strokes).map((r) => r.width)).toEqual([3, 1.2]);
    expect(ringsFor("heavy", strokes)[0]!.width).toBeGreaterThan(3);
    expect(ringsFor("dotted", strokes)[0]!.round).toBe(true);
    for (const b of BORDERS) for (const [i, r] of ringsFor(b, strokes).entries()) if (i > 0) expect(r.inset).toBeGreaterThan(ringsFor(b, strokes)[0]!.inset);
  });
  it("draws each motif as a closed figure within its radius", () => {
    for (const m of MOTIFS) {
      const d = motifPath(m, 10);
      expect(d.endsWith("Z")).toBe(true);
      expect(d.length).toBeGreaterThan(10);
    }
    expect(motifPath("star", 10).match(/L/g)).toHaveLength(9);
  });
  it("makes a completion stamp from the neighborhood alone", () => {
    expect(completionDesign("hood-1", "East Village")).toEqual(completionDesign("hood-1", "East Village"));
    const d = completionDesign("hood-1", "East Village");
    expect(d.label).toBe("COMPLETE");
    expect(d.area).toBe("EAST VILLAGE");
    expect(d.rays % 2).toBe(0);
    expect(rayPath(d.rays, 47, 56).match(/M/g)).toHaveLength(d.rays);
  });
});

describe("drawing", () => {
  it("renders a stamp for every shape without crashing", async () => {
    for (let i = 0; i < 12; i++) await render(<StampMark input={input(`draw-${i}`)} size={100} />);
  });
  it("renders the completion stamp with a spoken label", async () => {
    await render(<CompletionStamp neighborhoodId="hood-1" name="East Village" size={140} />);
    expect(screen.getByLabelText("East Village complete")).toBeTruthy();
  });
});
