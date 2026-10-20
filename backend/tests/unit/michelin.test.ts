import { describe, expect, it } from "vitest";

import { michelinStarsFromHit } from "@/server/services/michelin";
import { michelinMarkCenters } from "../../../shared/michelin-stamp";

describe("Michelin metadata", () => {
  it("parses one, two and three-star awards while ignoring Green Star and Bib Gourmand", () => {
    expect(michelinStarsFromHit({ michelin_award: "1 Star" })).toBe(1);
    expect(michelinStarsFromHit({ michelin_award: "2 Stars" })).toBe(2);
    expect(michelinStarsFromHit({ distinction: { slug: "3-stars-michelin" } })).toBe(3);
    expect(michelinStarsFromHit({ michelin_award: "Green Star" })).toBeNull();
    expect(michelinStarsFromHit({ michelin_award: "Bib Gourmand" })).toBeNull();
    expect(michelinStarsFromHit({ michelin_award: "1 Star", distinction: { slug: "green-star" } })).toBe(1);
  });

  it("lays out exactly one to three Michelin marks inside the restaurant border", () => {
    const mark = { cx: 297, cy: 26, r: 5 };
    expect(michelinMarkCenters(mark, 1)).toEqual([{ cx: 289, cy: 26, r: 5 }]);
    expect(michelinMarkCenters(mark, 2)).toHaveLength(2);
    expect(michelinMarkCenters(mark, 3)).toHaveLength(3);
    const three = michelinMarkCenters(mark, 3);
    expect(three.map((item) => item.cx)).toEqual([278, 289, 300]);
    expect(Math.max(...three.map((item) => item.cx + item.r))).toBeLessThanOrEqual(306.5);
  });
});
