import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { OpeningCover } from "../OpeningCover";
import { coverAngle, pageShadow, showsInside, swingShade } from "../open-math";

describe("open animation math", () => {
  it("turns the cover from 0 to minus 180 degrees and clamps", () => {
    expect([coverAngle(0), coverAngle(0.5), coverAngle(1), coverAngle(2), coverAngle(-1)]).toEqual([-0, -90, -180, -180, -0]);
  });
  it("shows the inside face only past halfway", () => {
    expect([showsInside(0.4), showsInside(0.5), showsInside(0.51)]).toEqual([false, false, true]);
  });
  it("shades most edge-on and not at all when flat", () => {
    expect([swingShade(0), swingShade(1)].map((n) => Math.round(n * 1000))).toEqual([0, 0]);
    expect(swingShade(0.5)).toBeGreaterThan(swingShade(0.2));
    expect(pageShadow(0.5)).toBeGreaterThan(pageShadow(0.9));
  });
});

describe("OpeningCover", () => {
  it("renders the cover and the page under it", async () => {
    await render(<OpeningCover width={200} height={284} open={false} outside={<Text>cover</Text>} page={<Text>page</Text>} />);
    expect(screen.getByText("cover")).toBeTruthy();
    expect(screen.getByText("page")).toBeTruthy();
  });
});
