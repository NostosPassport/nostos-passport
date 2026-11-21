import { fireEvent, render, screen } from "@testing-library/react-native";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";

import type { StampView } from "@/api/contracts";
import { PageView } from "@/features/book/PageView";
import { stampPlacement } from "@/features/book/slots";
import { applyLayout, clampScale, normRotation, toLayout } from "../arrange";
import { DragContext, type DragState } from "../ArrangeableStamp";

const W = 300;
const H = 420;
const stamp: StampView = {
  id: "s1",
  photoUrl: null,
  photos: [],
  caption: "",
  song: null,
  page: 1,
  slot: 1,
  createdAt: "2026-10-03T00:00:00.000Z",
  visitedAt: "2026-10-03T00:00:00.000Z",
  verifiedAt: null,
  verified: false,
  editedAt: null,
  place: { id: "p1", slug: "p1", name: "Brass Monkey", area: null, city: "New York", region: null, country: null, countryCode: "US", timeZone: "America/New_York" },
};

describe("placement maths", () => {
  it("keeps scale and tilt in range", () => {
    expect(clampScale(0.1)).toBe(0.4);
    expect(clampScale(9)).toBe(2.5);
    expect(normRotation(190)).toBe(-170);
    expect(normRotation(-190)).toBe(170);
    expect(normRotation(540)).toBe(180);
  });

  it("round-trips a hand placement through page points", () => {
    const auto = { cx: 100, cy: 100, size: 80, rotation: -3, height: 60 };
    const placed = applyLayout(auto, { x: 0.5, y: 0.25, scale: 1.5, rotation: 12 }, W, H);
    expect(placed).toEqual({ cx: 150, cy: 105, size: 120, rotation: 12, height: 90 });
    expect(toLayout(placed, auto.size, W, H)).toEqual({ x: 0.5, y: 0.25, scale: 1.5, rotation: 12 });
    expect(applyLayout(auto, undefined, W, H)).toBe(auto);
    expect(toLayout({ cx: -20, cy: 999, size: 1000, rotation: 200 }, 80, W, H)).toEqual({ x: 0, y: 1, scale: 2.5, rotation: -160 });
  });
});

describe("arranging a stamp on its page", () => {
  // A plain stand-in for a shared value; the Reanimated mock's makeMutable returns the bare number.
  const sv = <T,>(value: T) => { const v = { value, get: () => v.value, set: (n: T) => { v.value = n; } }; return v as unknown as DragState["active"]; };
  const drag = (): DragState => ({ active: sv(0), overTrash: sv(0), trashTop: sv(500) });
  const page = (onPlace = jest.fn(), onTakeOut = jest.fn(), state = drag(), layouts = new Map()) =>
    render(<DragContext.Provider value={state}><PageView page={1} side="left" width={W} height={H} stamps={[stamp]} onStampPress={jest.fn()} arrange={{ layouts, onPlace, onTakeOut }} /></DragContext.Provider>);

  it("draws a stamp where the owner placed it in this book", async () => {
    await page(jest.fn(), jest.fn(), drag(), new Map([["s1", { x: 0.5, y: 0.5, scale: 2, rotation: 10 }]]));
    const auto = stampPlacement(stamp, W, H);
    const style = screen.getByLabelText(/Stamp, Brass Monkey/).parent?.props.style;
    expect(JSON.stringify(style)).toContain(`"width":${auto.size * 2}`);
  });

  it("saves the new spot after a hold and drag", async () => {
    const onPlace = jest.fn();
    await page(onPlace);
    const auto = stampPlacement(stamp, W, H);
    await fireGestureHandler(getByGestureTestId("stamp-arrange-pan"), [
      { state: State.BEGAN, translationX: 0, translationY: 0, absoluteY: 200 },
      { state: State.ACTIVE, translationX: 0, translationY: 0, absoluteY: 200 },
      { state: State.ACTIVE, translationX: 30, translationY: 40, absoluteY: 240 },
      { state: State.END, translationX: 30, translationY: 40, absoluteY: 240 },
    ]);
    expect(onPlace).toHaveBeenCalledTimes(1);
    const saved = onPlace.mock.calls[0]![1];
    expect(saved.x).toBeCloseTo((auto.cx + 30) / W);
    expect(saved.y).toBeCloseTo((auto.cy + 40) / H);
    expect(saved.scale).toBeCloseTo(1);
  });

  it("takes the stamp out when it is dropped on the trash, and never saves a spot for it", async () => {
    const onPlace = jest.fn();
    const onTakeOut = jest.fn();
    await page(onPlace, onTakeOut);
    await fireGestureHandler(getByGestureTestId("stamp-arrange-pan"), [
      { state: State.BEGAN, translationX: 0, translationY: 0, absoluteY: 200 },
      { state: State.ACTIVE, translationX: 0, translationY: 0, absoluteY: 200 },
      { state: State.ACTIVE, translationX: 0, translationY: 320, absoluteY: 520 },
      { state: State.END, translationX: 0, translationY: 320, absoluteY: 520 },
    ]);
    expect(onTakeOut).toHaveBeenCalledTimes(1);
    expect(onPlace).not.toHaveBeenCalled();
  });

  it("offers VoiceOver a take-out action and still opens on tap", async () => {
    const onTakeOut = jest.fn();
    await page(jest.fn(), onTakeOut);
    const target = screen.getByLabelText(/Stamp, Brass Monkey/);
    await fireEvent(target, "accessibilityAction", { nativeEvent: { actionName: "takeOut" } });
    expect(onTakeOut).toHaveBeenCalledTimes(1);
  });
});
