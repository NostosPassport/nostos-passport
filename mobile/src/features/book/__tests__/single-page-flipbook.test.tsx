import { render, screen, within } from "@testing-library/react-native";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { State } from "react-native-gesture-handler";
import { Text } from "react-native";

import { SinglePageFlipBook } from "../SinglePageFlipBook";

const PW = 300;
const tap = async (x: number, y = 100) => fireGestureHandler(getByGestureTestId("single-flip-tap"), [
  { state: State.BEGAN, x, y },
  { state: State.ACTIVE, x, y },
  { state: State.END, x, y },
]);

describe("SinglePageFlipBook", () => {
  it("moves one page at a time from either half", async () => {
    const changed = jest.fn();
    const view = await render(<SinglePageFlipBook pageWidth={PW} pageHeight={426} total={4} page={1} pageTaps onPageChange={changed} renderPage={(index) => <Text>{`page ${index}`}</Text>} />);
    await tap(250);
    expect(changed).toHaveBeenCalledWith(2);
    await view.unmount();

    const back = jest.fn();
    await render(<SinglePageFlipBook pageWidth={PW} pageHeight={426} total={4} page={2} pageTaps onPageChange={back} renderPage={(index) => <Text>{`page ${index}`}</Text>} />);
    await tap(50);
    expect(back).toHaveBeenCalledWith(1);
  });

  it("uses the current page as the turning sheet instead of duplicating the destination", async () => {
    await render(<SinglePageFlipBook pageWidth={PW} pageHeight={426} total={4} page={1} pageTaps onPageChange={jest.fn()} renderPage={(index) => <Text>{`page ${index}`}</Text>} />);

    expect(within(screen.getByTestId("single-turn-current-next")).getByText("page 1")).toBeTruthy();
    expect(within(screen.getByTestId("single-turn-current-next")).queryByText("page 2")).toBeNull();
    expect(within(screen.getByTestId("single-turn-current-prev")).getByText("page 1")).toBeTruthy();
    expect(within(screen.getByTestId("single-turn-current-prev")).queryByText("page 0")).toBeNull();
    expect(screen.getAllByText("page 2")).toHaveLength(1);
    expect(screen.getAllByText("page 0")).toHaveLength(1);
  });

  it("holds at the profile and final page boundaries", async () => {
    const first = jest.fn();
    const view = await render(<SinglePageFlipBook pageWidth={PW} pageHeight={426} total={3} page={0} pageTaps onPageChange={first} renderPage={(index) => <Text>{`page ${index}`}</Text>} />);
    await tap(50);
    expect(first).not.toHaveBeenCalled();
    await view.unmount();

    const last = jest.fn();
    await render(<SinglePageFlipBook pageWidth={PW} pageHeight={426} total={3} page={2} pageTaps onPageChange={last} renderPage={(index) => <Text>{`page ${index}`}</Text>} />);
    await tap(250);
    expect(last).not.toHaveBeenCalled();
  });

  it("does not page when the tap lands on a stamp target", async () => {
    const changed = jest.fn();
    await render(<SinglePageFlipBook pageWidth={PW} pageHeight={426} total={3} page={1} pageTaps stampTargets={[{ left: 210, right: 280, top: 60, bottom: 140 }]} onPageChange={changed} renderPage={(index) => <Text>{`page ${index}`}</Text>} />);
    await tap(250, 100);
    expect(changed).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Passport pages").props.accessibilityValue).toMatchObject({ min: 1, max: 3, now: 2 });
  });
});
