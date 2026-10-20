import { fireEvent, render, screen } from "@testing-library/react-native";

import { Counts, Cover } from "../Cover";

describe("Cover", () => {
  it("is one button that opens the book, and it says what's inside", async () => {
    const onOpen = jest.fn();
    await render(<Cover width={300} height={426} counts={{ stamps: 12, places: 9 }} onOpen={onOpen} name="Sam" />);
    const button = screen.getByRole("button", { name: /Open your passport, Sam\. 12 stamps, 9 places\./ });
    await fireEvent.press(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows two brass numbers under the book", async () => {
    await render(<Counts counts={{ stamps: 12, places: 9 }} />);
    expect(screen.getByLabelText("12 stamps, 9 places")).toBeTruthy();
    const hidden = { includeHiddenElements: true };
    expect(screen.getByText("12", hidden)).toBeTruthy();
    expect(screen.getByText("STAMPS", hidden)).toBeTruthy();
    expect(screen.getByText("PLACES", hidden)).toBeTruthy();
  });
});
