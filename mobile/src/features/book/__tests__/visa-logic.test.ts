import type { StampPhotoView } from "@/api/contracts";
import { clampCenter, clampPan, clampScale, doubleTapScale, MAX_SCALE } from "../zoom";
import { bringToFront, defaultScrapbook, layoutRequest, photoShare, resolveLayout } from "../scrapbook";
import { typedCount } from "../typewriter";
import { visaLabel, visaStamp } from "../visa";

const photo = (id: string, position: number, x: number | null = null, y: number | null = null, rotation: number | null = null): StampPhotoView => ({ id, url: `https://x/${id}.jpg`, position, x, y, rotation });

describe("scrapbook layout", () => {
  it("has a default place for each of 0 to 6 photos, inside the page, the same every time", () => {
    for (let n = 0; n <= 6; n++) {
      const spots = defaultScrapbook(n, "s1");
      expect(spots).toHaveLength(n);
      expect(spots).toEqual(defaultScrapbook(n, "s1"));
      const half = photoShare(n) / 2;
      for (const s of spots) {
        expect(s.x - half).toBeGreaterThanOrEqual(0);
        expect(s.x + half).toBeLessThanOrEqual(1);
        expect(s.y - half * 0.7).toBeGreaterThanOrEqual(0);
        expect(Math.abs(s.rotation)).toBeLessThanOrEqual(6);
      }
    }
    expect(defaultScrapbook(3, "a")).not.toEqual(defaultScrapbook(3, "b"));
    expect(defaultScrapbook(9, "s")).toHaveLength(6);
  });
  it("makes photos smaller as there are more of them", () => {
    const shares = [1, 2, 3, 4, 5, 6].map(photoShare);
    for (let i = 1; i < shares.length; i++) expect(shares[i]!).toBeLessThanOrEqual(shares[i - 1]!);
  });
  it("uses where the owner left a photo and the default for photos never moved, in page order", () => {
    const r = resolveLayout([photo("b", 1), photo("a", 0, 0.2, 0.9, 12)], "s");
    expect(r.map((x) => x.photo.id)).toEqual(["a", "b"]);
    expect(r[0]!.spot).toEqual({ x: 0.2, y: 0.9, rotation: 12 });
    expect(r[1]!.spot).toEqual(defaultScrapbook(2, "s")[1]);
  });
  it("brings a dragged photo to the top and leaves the rest in order", () => {
    expect(bringToFront([{ id: "a" }, { id: "b" }, { id: "c" }], "a").map((p) => p.id)).toEqual(["b", "c", "a"]);
    expect(bringToFront([{ id: "a" }, { id: "b" }], "z").map((p) => p.id)).toEqual(["a", "b"]);
  });
  it("saves a layout the way the server wants it: order as position, shares of the page, rounded, in range", () => {
    const body = layoutRequest([{ id: "a", spot: { x: 0.123456, y: 1.4, rotation: 60 } }, { id: "b", spot: { x: -1, y: 0.5, rotation: -3.14159 } }]);
    expect(body).toEqual({ photos: [{ id: "a", position: 0, x: 0.123, y: 1, rotation: 45 }, { id: "b", position: 1, x: 0, y: 0.5, rotation: -3.142 }] });
  });
});

describe("dragging and zooming", () => {
  it("keeps a dragged photo wholly on the page", () => {
    expect(clampCenter(-50, -50, 100, 300, 420)).toEqual({ cx: 50, cy: 50 });
    expect(clampCenter(999, 999, 100, 300, 420)).toEqual({ cx: 250, cy: 370 });
    expect(clampCenter(150, 200, 100, 300, 420)).toEqual({ cx: 150, cy: 200 });
    expect(clampCenter(5, 5, 400, 300, 420)).toEqual({ cx: 200, cy: 200 });
  });
  it("zooms between 1 and 4 times, and double tap toggles in and out", () => {
    expect(clampScale(0.2)).toBe(1);
    expect(clampScale(9)).toBe(MAX_SCALE);
    expect(doubleTapScale(1)).toBe(2.5);
    expect(doubleTapScale(2.5)).toBe(1);
  });
  it("lets a zoomed photo be dragged only until its edges meet the screen's, and not at all when it fits", () => {
    expect(clampPan(500, -500, 2, 400, 800)).toEqual({ tx: 200, ty: -400 });
    expect(clampPan(30, 30, 1, 400, 800)).toEqual({ tx: 0, ty: 0 });
    expect(clampPan(10, 10, 3, 400, 800)).toEqual({ tx: 10, ty: 10 });
  });
});

describe("typing and dates", () => {
  it("types at a steady pace and never past the end", () => {
    expect(typedCount(0, 40)).toBe(0);
    expect(typedCount(500, 40)).toBe(19);
    expect(typedCount(99999, 40)).toBe(40);
    expect(typedCount(-5, 40)).toBe(0);
    expect(typedCount(500, 0)).toBe(0);
  });
  it("reads each stamp in its venue's local time zone", () => {
    expect(visaStamp("2026-10-04T03:41:00.000Z", "America/New_York")).toEqual({ date: "03 OCT 2026", time: "11:41 PM" });
    expect(visaStamp("2026-01-15T17:05:00.000Z", "America/New_York")).toEqual({ date: "15 JAN 2026", time: "12:05 PM" });
    expect(visaStamp("2026-10-04T03:41:00.000Z", "Europe/Rome")).toEqual({ date: "04 OCT 2026", time: "5:41 AM" });
    expect(visaStamp("nope", "Europe/Rome")).toEqual({ date: "", time: "" });
  });
  it("has a spoken label using the supplied locality and venue time zone", () => {
    expect(visaLabel("Katz's", "East Village", "2026-10-04T03:41:00.000Z", 3, "America/New_York")).toBe("Katz's, East Village, 03 OCT 2026 at 11:41 PM. Page 3.");
    expect(visaLabel("Roscioli", "Rome, Italy", "2026-10-04T03:41:00.000Z", 2, "Europe/Rome")).toBe("Roscioli, Rome, Italy, 04 OCT 2026 at 5:41 AM. Page 2.");
    expect(visaLabel("Katz's", "", "bad", null, "America/New_York")).toBe("Katz's.");
  });
});
