import { describe, expect, it } from "vitest";

import { michelinStarsFromHit } from "@/server/services/michelin";
import { michelinMarkCenters } from "../../../shared/michelin-stamp";

describe("Michelin metadata", () => {
  it("parses one, two and three-star awards while ignoring Green Star", () => {
    expect(michelinStarsFromHit({ michelin_award: "1 Star" })).toBe(1);
    expect(michelinStarsFromHit({ michelin_award: "2 Stars" })).toBe(2);
    expect(michelinStarsFromHit({ distinction: { slug: "3-stars-michelin" } })).toBe(3);
    expect(michelinStarsFromHit({ michelin_award: "Green Star" })).toBeNull();
    expect(michelinStarsFromHit({ michelin_award: "Bib Gourmand" })).toBeNull();
  });

  it("lays out exactly one to three Michelin marks around the shared anchor", () => {
    const mark = { cx: 297, cy: 26, r: 5 };
    expect(michelinMarkCenters(mark, 1)).toEqual([{ cx: 297, cy: 26, r: 5 }]);
    expect(michelinMarkCenters(mark, 2)).toHaveLength(2);
    expect(michelinMarkCenters(mark, 3)).toHaveLength(3);
    expect(michelinMarkCenters(mark, 3).map((item) => item.cx)).toEqual([284, 297, 310]);
  });
});
