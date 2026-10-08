import { act, fireEvent, render, screen } from "@testing-library/react-native";

import type { NeighborhoodProgress, StampView } from "@/api/contracts";
import * as Haptics from "expo-haptics";
import { LANDING, landingFrame } from "../landing";
import { landingCopy, photoPins } from "../landing-copy";
import { LandingScene } from "../LandingScene";

jest.mock("@/api", () => ({ api: {}, mediaUrl: (u: string) => u }));

const progress = (over: Partial<NeighborhoodProgress> = {}): NeighborhoodProgress => ({ neighborhoodId: "n1", name: "East Village", borough: "Manhattan", visited: 4, total: 12, complete: false, justCompleted: false, newPlace: true, ...over });
const stamp = (over: Partial<StampView> = {}): StampView => ({
  id: "s9", photoUrl: null, photos: [], caption: "", song: null, page: 3, slot: 2,
  createdAt: "2026-10-03T00:00:00.000Z", visitedAt: "2026-10-03T00:00:00.000Z", verifiedAt: null, verified: false, editedAt: null,
  place: { id: "p9", slug: "p9", name: "Katz's", neighborhood: "East Village", neighborhoodId: "n1" },
  ...over,
});

describe("landing timeline", () => {
  it("hovers large and invisible, then falls and gets faster until impact", () => {
    expect(landingFrame(0, false)).toMatchObject({ scale: 1.7, opacity: 0 });
    expect(landingFrame(LANDING.rise, false).scale).toBeCloseTo(1.7);
    let last = 1.7;
    for (let t = LANDING.rise; t < LANDING.impact; t += 10) {
      const s = landingFrame(t, false).scale;
      expect(s).toBeLessThanOrEqual(last + 1e-9);
      last = s;
    }
    expect(landingFrame(LANDING.impact - 1, false).scale).toBeLessThan(1.05);
  });
  it("is quiet before impact: no shake, no glow, no ink", () => {
    for (let t = 0; t < LANDING.impact; t += 20) {
      const f = landingFrame(t, false);
      expect([f.shakeX, f.shakeY, f.glow, f.inkSpread]).toEqual([0, 0, 0, 0]);
    }
  });
  it("shakes hard on impact and settles to nothing", () => {
    const peak = Math.max(...Array.from({ length: 30 }, (_, i) => Math.abs(landingFrame(LANDING.impact + i * 3, false).shakeX)));
    expect(peak).toBeGreaterThan(1.5);
    expect(peak).toBeLessThanOrEqual(4);
    const f = landingFrame(LANDING.impact + LANDING.shake, false);
    expect(f.shakeX).toBeCloseTo(0);
    expect(f.shakeY).toBeCloseTo(0);
  });
  it("flares to full brass quickly and fades to nothing, and spreads ink once", () => {
    const glows = Array.from({ length: 120 }, (_, i) => landingFrame(LANDING.impact + i * 10, false).glow);
    expect(Math.max(...glows)).toBeCloseTo(1, 1);
    expect(glows.indexOf(Math.max(...glows))).toBeLessThan(40);
    expect(landingFrame(LANDING.impact + LANDING.glow, false).glow).toBeCloseTo(0);
    expect(landingFrame(LANDING.impact + LANDING.ink, false).inkSpread).toBeCloseTo(1);
    expect(landingFrame(LANDING.total, false)).toMatchObject({ scale: 1, opacity: 1 });
  });
  it("with Reduce Motion only fades in: no scale, shake or flare", () => {
    for (const t of [0, 100, 220, 500, 1200]) {
      const f = landingFrame(t, true);
      expect(f.scale).toBe(1);
      expect([f.shakeX, f.shakeY, f.glow]).toEqual([0, 0, 0]);
    }
    expect(landingFrame(0, true).opacity).toBe(0);
    expect(landingFrame(220, true).opacity).toBe(1);
  });
});

describe("what the landing says", () => {
  it("names the page and neighborhood without exposing dataset-size counts", () => {
    expect(landingCopy(3, progress())).toEqual({ added: "Added to page 3", progress: "New place in East Village.", completed: false });
  });
  it("says so when it is another visit, and when the neighborhood is finished", () => {
    expect(landingCopy(3, progress({ newPlace: false })).progress).toBe("Another visit in East Village.");
    expect(landingCopy(3, progress({ justCompleted: true, complete: true, visited: 12 }))).toMatchObject({ completed: true, progress: "East Village is complete." });
  });
  it("copes with no neighborhood and with no page", () => {
    expect(landingCopy(null, null)).toEqual({ added: "Stamped", progress: null, completed: false });
  });
  it("pins up to six photos in a row inside the page, tilted a little, the same way every time", () => {
    expect(photoPins(0, 300, "s")).toEqual([]);
    expect(photoPins(9, 300, "s")).toHaveLength(6);
    expect(photoPins(3, 300, "s")).toEqual(photoPins(3, 300, "s"));
    for (const n of [1, 2, 3, 4, 5, 6]) {
      for (const p of photoPins(n, 300, "s")) {
        expect(p.cx - p.size / 2).toBeGreaterThanOrEqual(0);
        expect(p.cx + p.size / 2).toBeLessThanOrEqual(300);
        expect(Math.abs(p.rotation)).toBeLessThanOrEqual(7);
      }
    }
  });
});

describe("LandingScene", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  it("says which page the stamp went on and names the neighborhood without dataset-size counts, and gives a haptic knock on impact", async () => {
    await render(<LandingScene stamp={stamp()} others={[]} progress={progress()} pageWidth={300} pageHeight={426} onDone={jest.fn()} />);
    expect(screen.getByText("Added to page 3")).toBeTruthy();
    expect(screen.getByText("New place in East Village.")).toBeTruthy();
    expect(screen.queryByText(/4 of 12/)).toBeNull();
    expect(screen.getByLabelText("New stamp, Katz's, page 3, slot 2")).toBeTruthy();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(LANDING.impact));
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });
  it("pins the photos it was given and shows the foil stamp when the neighborhood is finished", async () => {
    const photos = [0, 1].map((i) => ({ id: `ph${i}`, url: `https://x/${i}.jpg`, position: i, x: null, y: null, rotation: null }));
    await render(<LandingScene stamp={stamp({ photos })} others={[]} progress={progress({ justCompleted: true, complete: true, visited: 12 })} pageWidth={300} pageHeight={426} onDone={jest.fn()} />);
    expect(screen.getByLabelText("East Village complete")).toBeTruthy();
  });
  it("calls Done", async () => {
    const onDone = jest.fn();
    await render(<LandingScene stamp={stamp()} others={[]} progress={null} pageWidth={300} pageHeight={426} onDone={onDone} />);
    await fireEvent.press(screen.getByText("Done"));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
