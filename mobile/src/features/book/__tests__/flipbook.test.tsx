import { render, screen } from "@testing-library/react-native";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { State } from "react-native-gesture-handler";
import { Text } from "react-native";
import * as Reanimated from "react-native-reanimated";

import { FlipBook } from "../FlipBook";
import type { PageFace } from "../spreads";

const PW = 300;
const label = (f: PageFace, side: string) => `${side}:${f.kind === "stamps" ? `page ${f.page}` : f.kind}`;
const face = (f: PageFace, side: "left" | "right") => <Text>{label(f, side)}</Text>;

async function setup(spread: number, total = 4) {
  const onSpreadChange = jest.fn();
  const onCloseBook = jest.fn();
  const view = await render(<FlipBook pageWidth={PW} pageHeight={426} total={total} spread={spread} onSpreadChange={onSpreadChange} onCloseBook={onCloseBook} renderFace={face} />);
  return { onSpreadChange, onCloseBook, view };
}

describe("FlipBook", () => {
  afterEach(() => jest.restoreAllMocks());
  it("draws the page it is on, the page under each turn, and nothing past either end of the book", async () => {
    await setup(0);
    // At the first spread: inside cover and bearer page, with the next faces ready to turn.
    expect(screen.getByText("right:bearer")).toBeTruthy();
    expect(screen.getByText("left:page 1")).toBeTruthy();
    expect(screen.getByText("right:page 2")).toBeTruthy();
    expect(screen.getByText("left:inside-cover")).toBeVisible();
  });

  it.each([false, true])("renders both first-spread faces with Reduce Motion=%s", async (reduced) => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(reduced);
    await setup(0, 2);
    expect(screen.getByText("left:inside-cover")).toBeVisible();
    expect(screen.getByText("right:bearer")).toBeVisible();
    expect(screen.queryByText("left:page 3")).toBeNull();
    expect(screen.queryByText("right:page 4")).toBeNull();
  });
  it.each([false, true])("renders both final-spread faces with Reduce Motion=%s", async (reduced) => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(reduced);
    await setup(1, 2);
    expect(screen.getByText("left:page 1")).toBeVisible();
    expect(screen.getByText("right:page 2")).toBeVisible();
    expect(screen.queryByText("left:page 3")).toBeNull();
    expect(screen.queryByText("right:page 4")).toBeNull();
  });
  it("in the middle it holds the turning pages on both sides, so either way is ready", async () => {
    await setup(1);
    expect(screen.getByText("left:inside-cover")).toBeTruthy(); // under the page lying on the left
    expect(screen.getByText("left:page 1")).toBeTruthy();
    expect(screen.getByText("right:page 2")).toBeTruthy();
    expect(screen.getByText("left:page 3")).toBeTruthy();
    expect(screen.getByText("right:page 4")).toBeTruthy();
  });
  it("turns forward when the right edge is tapped, and back when the left edge is", async () => {
    const a = await setup(1);
    await fireGestureHandler(getByGestureTestId("flip-tap"), [{ state: State.BEGAN, x: PW * 2 - 6, y: 200 }, { state: State.ACTIVE, x: PW * 2 - 6, y: 200 }, { state: State.END, x: PW * 2 - 6, y: 200 }]);
    expect(a.onSpreadChange).toHaveBeenCalledWith(2);
    await a.view.unmount();
    const b = await setup(2);
    await fireGestureHandler(getByGestureTestId("flip-tap"), [{ state: State.BEGAN, x: 6, y: 200 }, { state: State.ACTIVE, x: 6, y: 200 }, { state: State.END, x: 6, y: 200 }]);
    expect(b.onSpreadChange).toHaveBeenCalledWith(1);
  });
  it("ignores a tap in the middle of a page, so stamps stay tappable", async () => {
    const a = await setup(1);
    await fireGestureHandler(getByGestureTestId("flip-tap"), [{ state: State.BEGAN, x: PW, y: 200 }, { state: State.ACTIVE, x: PW, y: 200 }, { state: State.END, x: PW, y: 200 }]);
    expect(a.onSpreadChange).not.toHaveBeenCalled();
  });
  it("does not turn past the last spread, and tapping the left edge of the first spread closes the book", async () => {
    const last = await setup(3);
    await fireGestureHandler(getByGestureTestId("flip-tap"), [{ state: State.BEGAN, x: PW * 2 - 6, y: 200 }, { state: State.ACTIVE, x: PW * 2 - 6, y: 200 }, { state: State.END, x: PW * 2 - 6, y: 200 }]);
    expect(last.onSpreadChange).not.toHaveBeenCalled();
    await last.view.unmount();
    const first = await setup(0);
    await fireGestureHandler(getByGestureTestId("flip-tap"), [{ state: State.BEGAN, x: 6, y: 200 }, { state: State.ACTIVE, x: 6, y: 200 }, { state: State.END, x: 6, y: 200 }]);
    expect(first.onCloseBook).toHaveBeenCalledTimes(1);
    expect(first.onSpreadChange).not.toHaveBeenCalled();
  });
  it("turns forward when dragged from the right edge past halfway, and stays put when dragged only a little", async () => {
    const x0 = PW * 2 - 10;
    const far = await setup(1);
    await fireGestureHandler(getByGestureTestId("flip-pan"), [
      { state: State.BEGAN, x: x0, translationX: 0, velocityX: 0 },
      { state: State.ACTIVE, x: x0 - 20, translationX: -20, velocityX: -50 },
      { state: State.ACTIVE, x: x0 - 300, translationX: -300, velocityX: -50 },
      { state: State.END, x: x0 - 300, translationX: -300, velocityX: -50 },
    ]);
    expect(far.onSpreadChange).toHaveBeenCalledWith(2);
    await far.view.unmount();
    const near = await setup(1);
    await fireGestureHandler(getByGestureTestId("flip-pan"), [
      { state: State.BEGAN, x: x0, translationX: 0, velocityX: 0 },
      { state: State.ACTIVE, x: x0 - 60, translationX: -60, velocityX: -20 },
      { state: State.END, x: x0 - 60, translationX: -60, velocityX: -20 },
    ]);
    expect(near.onSpreadChange).not.toHaveBeenCalled();
  });
  it("ignores a drag that does not begin on an edge", async () => {
    const a = await setup(1);
    await fireGestureHandler(getByGestureTestId("flip-pan"), [
      { state: State.BEGAN, x: PW, translationX: 0, velocityX: 0 },
      { state: State.ACTIVE, x: PW - 250, translationX: -250, velocityX: -800 },
      { state: State.END, x: PW - 250, translationX: -250, velocityX: -800 },
    ]);
    expect(a.onSpreadChange).not.toHaveBeenCalled();
  });
});

describe("whole-page focused gestures",()=>{
 it("a blank center tap advances; a stamp target keeps detail precedence; first-left stays open",async()=>{
 const changed=jest.fn(),closed=jest.fn();
 const v=await render(<FlipBook pageWidth={PW} pageHeight={426} total={3} spread={1} pageTaps stampTargets={[{left:350,right:420,top:80,bottom:160}]} onSpreadChange={changed} onCloseBook={closed} renderFace={face}/>);
 const tap=async(x:number,y:number)=>fireGestureHandler(getByGestureTestId("flip-tap"),[{state:State.BEGAN,x,y},{state:State.ACTIVE,x,y},{state:State.END,x,y}]);
 await tap(380,100);expect(changed).not.toHaveBeenCalled();await tap(450,100);expect(changed).toHaveBeenCalledWith(2);
 await v.unmount();await render(<FlipBook pageWidth={PW} pageHeight={426} total={3} spread={0} pageTaps onSpreadChange={changed} onCloseBook={closed} renderFace={face}/>);
 await tap(120,100);expect(closed).not.toHaveBeenCalled();
 });
 it("rapid repeated taps do not start another animation while settling",async()=>{
 const spring=jest.spyOn(Reanimated,"withSpring").mockImplementation(()=>1);
 await render(<FlipBook pageWidth={PW} pageHeight={426} total={3} spread={0} pageTaps onSpreadChange={jest.fn()} renderFace={face}/>);
 const tap=async()=>fireGestureHandler(getByGestureTestId("flip-tap"),[{state:State.BEGAN,x:450,y:100},{state:State.ACTIVE,x:450,y:100},{state:State.END,x:450,y:100}]);
 await tap();await tap();expect(spring).toHaveBeenCalledTimes(1);spring.mockRestore();
 });
});
