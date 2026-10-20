import { describe, expect, it } from "vitest";

import { michelinStarsFromHit } from "@/server/services/michelin";
import { michelinMarkCenters, michelinStarPath } from "../../../shared/michelin-stamp";

describe("Michelin metadata", () => {
  it("parses one, two and three-star awards while ignoring Green Star and Bib Gourmand", () => {
    expect(michelinStarsFromHit({ michelin_award: "1 Star" })).toBe(1);
    expect(michelinStarsFromHit({ michelin_award: "2 Stars" })).toBe(2);
    expect(michelinStarsFromHit({ distinction: { slug: "3-stars-michelin" } })).toBe(3);
    expect(michelinStarsFromHit({ michelin_award: "Green Star" })).toBeNull();
    expect(michelinStarsFromHit({ michelin_award: "Bib Gourmand" })).toBeNull();
    expect(michelinStarsFromHit({ michelin_award: "1 Star", distinction: { slug: "green-star" } })).toBe(1);
  });

  it("lays out one to three six-lobed outlined Michelin marks inside the restaurant border", () => {
    const mark = { cx: 297, cy: 26, r: 5 };
    const one = michelinMarkCenters(mark, 1);
    expect(one).toHaveLength(1);
    expect(one[0]!.cx).toBe(289);
    expect(one[0]!.cy).toBe(26);
    expect(one[0]!.r).toBeCloseTo(3.6);
    expect(michelinMarkCenters(mark, 2)).toHaveLength(2);
    const three = michelinMarkCenters(mark, 3);
    expect(three).toHaveLength(3);
    expect(three.map((item) => item.cx)).toEqual([277.5, 289, 300.5]);
    expect(Math.max(...three.map((item) => item.cx + item.r * 1.52))).toBeLessThanOrEqual(306.5);
    expect((michelinStarPath(three[0]!).match(/M /g) ?? [])).toHaveLength(6);
  });
});
