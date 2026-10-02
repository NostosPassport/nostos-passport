import { LAYOUT_VECTORS, nextSlot, pageAndSlot, spreadOfPage } from "../layout";

describe("passport layout (mirror of the server's)", () => {
  it.each(LAYOUT_VECTORS)("index %i is page %i slot %i", (index, page, slot) => expect(pageAndSlot(index)).toEqual({ page, slot }));
  it("two pages to a spread, and the next stamp lands in the next empty slot", () => {
    expect([1, 2, 3, 4].map(spreadOfPage)).toEqual([1, 1, 2, 2]);
    expect(nextSlot(5)).toEqual({ page: 2, slot: 3 });
    expect(nextSlot(6)).toEqual({ page: 3, slot: 1 });
  });
  it("matches the server's vectors file exactly", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const src = (require("node:fs") as typeof import("node:fs")).readFileSync("../backend/src/lib/layout.ts", "utf8");
    const server = [...src.matchAll(/\[(\d+), (\d+), (\d+)\]/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
    expect(server).toEqual(LAYOUT_VECTORS.map((v) => [...v]));
  });
});
