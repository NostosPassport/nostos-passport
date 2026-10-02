import { isOpenish, nextPhase, spreadLabel, stageTransform } from "../book-state";

describe("the book's moments", () => {
  it("goes closed, opening, open, closing, closed, and ignores events that don't belong", () => {
    expect(nextPhase("closed", "tapCover")).toBe("opening");
    expect(nextPhase("opening", "coverSettled")).toBe("open");
    expect(nextPhase("open", "closeBook")).toBe("closing");
    expect(nextPhase("closing", "coverSettled")).toBe("closed");
    expect(nextPhase("closed", "coverSettled")).toBe("closed"); // a settle on mount does nothing
    expect(nextPhase("opening", "tapCover")).toBe("opening");
    expect(nextPhase("open", "tapCover")).toBe("open");
    expect(nextPhase("closing", "closeBook")).toBe("closing");
  });
  it("counts opening as open for the stage", () => {
    expect(["closed", "opening", "open", "closing"].map((p) => isOpenish(p as never))).toEqual([false, true, true, false]);
  });
});

describe("the stage", () => {
  it("centers the cover when closed and the whole spread when open, scaling down to fit", () => {
    expect(stageTransform(0, 300, 0.55)).toEqual({ scale: 1, translateX: -150 });
    expect(stageTransform(1, 300, 0.55)).toEqual({ scale: 0.55, translateX: -0 });
    const mid = stageTransform(0.5, 300, 0.5);
    expect(mid.scale).toBeCloseTo(0.75);
    expect(mid.translateX).toBeCloseTo(-56.25);
    expect(stageTransform(7, 300, 0.5).scale).toBe(0.5);
    expect(stageTransform(-3, 300, 0.5).translateX).toBe(-150);
  });
});

describe("the footer", () => {
  it("names the spread", () => {
    expect(spreadLabel(0, 4)).toBe("Bearer page");
    expect(spreadLabel(1, 4)).toBe("Pages 1 and 2");
    expect(spreadLabel(2, 4)).toBe("Pages 3 and 4");
    expect(spreadLabel(2, 3)).toBe("Page 3"); // an odd book ends on one page
  });
});
