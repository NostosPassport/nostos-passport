import { fireEvent, render, screen } from "@testing-library/react-native";

import Customize from "@/app/(app)/customize";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({ router: { back: () => mockBack() } }));

describe("Customize teaser", () => {
  it("is a quiet note with a lock: nothing to buy, nothing to set up, and a way out", async () => {
    await render(<Customize />);
    expect(screen.getByText("Customize")).toBeTruthy();
    expect(screen.getByText(/Nothing to set up yet, and nothing to buy/)).toBeTruthy();
    expect(screen.queryByText(/\$|price|buy now|subscribe|purchase|upgrade/i)).toBeNull();
    await fireEvent.press(screen.getByText("Close"));
    expect(mockBack).toHaveBeenCalled();
  });
});
