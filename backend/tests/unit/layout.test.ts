import { describe, expect, it } from "vitest";
import { LAYOUT_VECTORS, nextSlot, pageAndSlot, spreadOfPage } from "@/lib/layout";

describe("passport layout", () => {
  it.each(LAYOUT_VECTORS)("index %i is page %i slot %i", (index, page, slot) => expect(pageAndSlot(index)).toEqual({ page, slot }));

  it("fills three slots a page, in order, never skipping", () => {
    const seen = Array.from({ length: 12 }, (_, i) => pageAndSlot(i));
    expect(seen.map((s) => s.slot)).toEqual([1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3]);
    expect(seen.map((s) => s.page)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4]);
  });

  it("the first stamps stay on page 1 however many come later", () => {
    for (const total of [3, 10, 500]) expect(Array.from({ length: Math.min(total, 3) }, (_, i) => pageAndSlot(i).page)).toEqual(Array(Math.min(total, 3)).fill(1));
  });

  it("two pages to a spread", () => {
    expect([1, 2, 3, 4, 5, 6].map(spreadOfPage)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it("the next stamp lands in the next empty slot", () => {
    expect(nextSlot(0)).toEqual({ page: 1, slot: 1 });
    expect(nextSlot(5)).toEqual({ page: 2, slot: 3 });
    expect(nextSlot(6)).toEqual({ page: 3, slot: 1 });
  });

  it("refuses nonsense", () => {
    for (const bad of [-1, 1.5, Number.NaN]) expect(() => pageAndSlot(bad)).toThrow(RangeError);
  });
});
