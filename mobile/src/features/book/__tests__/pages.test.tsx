import { render, screen } from "@testing-library/react-native";

import type { StampView } from "@/api/contracts";
import { bookStyle, stampStyle } from "@/theme";
import { edgeLines, pinnedPages, ribbonPath, ribbonsOnPage } from "../edges";
import { rosettePath, wavePaths } from "../guilloche";
import { PageView } from "../PageView";
import { Spread } from "../Spread";
import { groupByPage, pageCountFor, spreadAt, spreadCountFor, spreadIndexForPage } from "../spreads";
import { boxOf, overlapShare, slotPlacement } from "../slots";

const stamp = (id: string, page: number | null, slot: number | null, name = "Place"): StampView => ({
  id, photoUrl: null, photos: [], caption: "", song: null, page, slot, createdAt: "2026-10-03T00:00:00.000Z", editedAt: null,
  place: { id: `p-${id}`, slug: id, name, neighborhood: "East Village", neighborhoodId: null },
  author: { handle: "me", displayName: "Me", avatarUrl: null, verified: false }, mine: true, likes: { count: 0, viewerLiked: false }, hidden: false, removed: false,
});

describe("spreads", () => {
  it("opens on the inside cover and the bearer page, then two stamp pages to a spread", () => {
    expect(spreadAt(0)).toEqual({ index: 0, left: { kind: "inside-cover" }, right: { kind: "bearer" } });
    expect(spreadAt(1)).toEqual({ index: 1, left: { kind: "stamps", page: 1 }, right: { kind: "stamps", page: 2 } });
    expect(spreadAt(3).right).toEqual({ kind: "stamps", page: 6 });
    expect(() => spreadAt(-1)).toThrow();
  });
  it("agrees with the shared layout: the spread of a page holds that page", () => {
    for (let page = 1; page <= 20; page++) {
      const s = spreadAt(spreadIndexForPage(page));
      expect([s.left, s.right]).toContainEqual({ kind: "stamps", page });
    }
  });
  it("always shows the page the next stamp lands on, in whole spreads, at least one", () => {
    expect(pageCountFor(0)).toBe(2);
    expect(pageCountFor(5)).toBe(2); // the next stamp is the 6th: page 2
    expect(pageCountFor(6)).toBe(4); // the 7th starts page 3, so page 4 shows too
    expect(pageCountFor(9)).toBe(4);
    expect(pageCountFor(12)).toBe(6);
    expect(spreadCountFor(0)).toBe(2);
    expect(spreadCountFor(6)).toBe(3);
  });
  it("groups stamps by page in slot order and leaves out hidden and removed ones", () => {
    const m = groupByPage([stamp("c", 1, 3), stamp("a", 1, 1), stamp("b", 1, 2), stamp("d", 2, 1), stamp("x", null, null)]);
    expect(m.get(1)!.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(m.get(2)!.map((s) => s.id)).toEqual(["d"]);
    expect(m.size).toBe(2);
  });
});

describe("slot placement", () => {
  const W = 300;
  const H = 426;
  it("is the same for the same seed and different for another", () => {
    expect(slotPlacement("s1", 2, W, H)).toEqual(slotPlacement("s1", 2, W, H));
    expect(slotPlacement("s1", 2, W, H)).not.toEqual(slotPlacement("s2", 2, W, H));
    expect(() => slotPlacement("s", 4, W, H)).toThrow();
  });
  it("keeps every stamp inside the page rule and within the tilt limit, for any seed", () => {
    for (let n = 0; n < 300; n++) {
      for (const slot of [1, 2, 3]) {
        const p = slotPlacement(`seed${n}`, slot, W, H);
        const b = boxOf(p);
        expect(b.left).toBeGreaterThan(W * 0.06);
        expect(b.right).toBeLessThan(W * 0.94);
        expect(b.top).toBeGreaterThan(H * 0.06);
        expect(b.bottom).toBeLessThan(H * 0.94);
        expect(Math.abs(p.rotation)).toBeLessThanOrEqual(stampStyle.maxTiltDeg);
      }
    }
  });
  it("lets neighbors overlap only a little, for any seed, at phone sizes", () => {
    for (const [w, h] of [[300, 426], [260, 369], [340, 483]] as const) {
      for (let n = 0; n < 300; n++) {
        const [a, b, c] = [1, 2, 3].map((s) => slotPlacement(`seed${n}`, s, w, h)) as [ReturnType<typeof slotPlacement>, ReturnType<typeof slotPlacement>, ReturnType<typeof slotPlacement>];
        expect(overlapShare(a, b)).toBeLessThanOrEqual(stampStyle.maxOverlap);
        expect(overlapShare(b, c)).toBeLessThanOrEqual(stampStyle.maxOverlap);
        expect(overlapShare(a, c)).toBeLessThanOrEqual(stampStyle.maxOverlap);
      }
    }
  });
});

describe("guilloche", () => {
  it("draws a closed rosette that fits its circle and is the same every time", () => {
    const d = rosettePath("page:1", 150, 200, 100);
    expect(d).toBe(rosettePath("page:1", 150, 200, 100));
    expect(d).not.toBe(rosettePath("page:2", 150, 200, 100));
    expect(d.endsWith("Z")).toBe(true);
    const pts = [...d.matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
    expect(pts[0]).toEqual(pts[pts.length - 1]); // closed
    for (const [x, y] of pts) expect(Math.hypot(x - 150, y - 200)).toBeLessThanOrEqual(100.05);
  });
  it("draws interlocking waves inside their band", () => {
    const waves = wavePaths("top:1", 200, 20, 5);
    expect(waves).toHaveLength(5);
    expect(new Set(waves).size).toBe(5);
    for (const w of waves) {
      for (const m of w.matchAll(/[ML][\d.-]+ ([\d.-]+)/g)) {
        expect(Number(m[1])).toBeGreaterThanOrEqual(0);
        expect(Number(m[1])).toBeLessThanOrEqual(20);
      }
    }
  });
});

describe("edges and ribbons", () => {
  it("shows more page edge on the side with more pages, capped", () => {
    expect(edgeLines(0, 5)).toEqual({ left: 0, right: 4 });
    expect(edgeLines(2, 5)).toEqual({ left: 2, right: 2 });
    expect(edgeLines(4, 5)).toEqual({ left: 4, right: 0 });
    expect(edgeLines(40, 80).left).toBe(bookStyle.maxEdgeLines);
    expect(edgeLines(40, 80).right).toBe(bookStyle.maxEdgeLines);
  });
  it("cuts a swallowtail ribbon", () => {
    expect(ribbonPath(10, 40)).toBe("M0 0 L10 0 L10 40 L5 35 L0 40 Z");
  });
  it("marks pinned stamps on their page, and lists each pinned page once in book order", () => {
    const here = [stamp("a", 3, 1), stamp("b", 3, 2)];
    expect(ribbonsOnPage(here, ["z", "b", "a"])).toEqual(["b", "a"]);
    expect(pinnedPages([stamp("a", 7, 1), stamp("b", 2, 1), stamp("c", 7, 2), stamp("d", null, null)])).toEqual([2, 7]);
  });
});

describe("PageView and Spread", () => {
  it("shows the page number and one button per stamp, saying which are pinned", async () => {
    await render(<PageView page={4} side="right" width={300} height={426} stamps={[stamp("a", 4, 1, "Katz's"), stamp("b", 4, 2, "Cafe")]} pinnedIds={["b"]} />);
    expect(screen.getByLabelText("Page 4")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stamp, Katz's, page 4, slot 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stamp, Cafe, page 4, slot 2, pinned" })).toBeTruthy();
  });
  it("shows an empty page with only its number", async () => {
    await render(<PageView page={5} side="left" width={300} height={426} stamps={[]} />);
    expect(screen.getByLabelText("Page 5")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
  it("lays two pages side by side", async () => {
    await render(<Spread pageWidth={300} pageHeight={426} spreadIndex={1} spreadTotal={3} left={<PageView page={1} side="left" width={300} height={426} stamps={[]} />} right={<PageView page={2} side="right" width={300} height={426} stamps={[]} />} />);
    expect(screen.getByLabelText("Page 1")).toBeTruthy();
    expect(screen.getByLabelText("Page 2")).toBeTruthy();
  });
});
