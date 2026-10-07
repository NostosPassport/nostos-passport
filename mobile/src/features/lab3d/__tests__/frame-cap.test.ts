import { FPS, loopActive, pixelRatioFor, shouldRender, targetFps } from "../frame-cap";

describe("when the loop runs", () => {
  it("only while focused, the app is active and the model is visible", () => {
    expect(loopActive({ focused: true, appActive: true, visible: true })).toBe(true);
    expect(loopActive({ focused: false, appActive: true, visible: true })).toBe(false);
    expect(loopActive({ focused: true, appActive: false, visible: true })).toBe(false);
    expect(loopActive({ focused: true, appActive: true, visible: false })).toBe(false);
  });
});

describe("frame rate cap", () => {
  it("30 when idle, 60 while dragging, coasting or soaking", () => {
    expect(targetFps({ active: false, lowPower: false })).toBe(FPS.idle);
    expect(targetFps({ active: true, lowPower: false })).toBe(FPS.active);
    expect(FPS.idle).toBe(30);
    expect(FPS.active).toBe(60);
  });

  it("Low Power Mode holds 30 even while dragging", () => {
    expect(targetFps({ active: true, lowPower: true })).toBe(30);
  });

  it("renders a frame only when the interval for the cap has passed (with a small vsync tolerance)", () => {
    expect(shouldRender(1000, 1000, 30)).toBe(false);
    expect(shouldRender(1016.7, 1000, 30)).toBe(false);
    expect(shouldRender(1033.3, 1000, 30)).toBe(true);
    expect(shouldRender(1016.7, 1000, 60)).toBe(true);
    expect(shouldRender(1010, 1000, 60)).toBe(false);
  });

  it("the first frame always renders", () => {
    expect(shouldRender(5, null, 30)).toBe(true);
  });
});

describe("pixel ratio", () => {
  it("is the device ratio capped at 2, and 1.5 in Low Power Mode", () => {
    expect(pixelRatioFor(3, false)).toBe(2);
    expect(pixelRatioFor(2, false)).toBe(2);
    expect(pixelRatioFor(1, false)).toBe(1);
    expect(pixelRatioFor(3, true)).toBe(1.5);
    expect(pixelRatioFor(1, true)).toBe(1);
  });
});
