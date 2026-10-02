import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";

import { RatingPicker, ratingValueText, stepRating } from "../rating-picker";

describe("RatingPicker", () => {
  it("picks a number with a light haptic, and ignores re-picking the same one", async () => {
    const onChange = jest.fn();
    const { rerender } = await render(<RatingPicker value={null} onChange={onChange} />);
    await fireEvent.press(screen.getByTestId("rating-8"));
    expect(onChange).toHaveBeenCalledWith(8);
    expect(Haptics.impactAsync).toHaveBeenCalled();
    await rerender(<RatingPicker value={8} onChange={onChange} />);
    await fireEvent.press(screen.getByTestId("rating-8"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("is one adjustable control for VoiceOver, with the value spoken", async () => {
    const onChange = jest.fn();
    await render(<RatingPicker value={7} onChange={onChange} />);
    const control = screen.getByRole("adjustable");
    expect(control.props.accessibilityLabel).toBe("Rating");
    expect(control.props.accessibilityValue).toMatchObject({ min: 1, max: 10, now: 7, text: "7 out of 10" });
    await fireEvent(control, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    expect(onChange).toHaveBeenLastCalledWith(8);
    await fireEvent(control, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
    expect(onChange).toHaveBeenLastCalledWith(6);
  });

  it("does nothing when disabled (a locked rating)", async () => {
    const onChange = jest.fn();
    await render(<RatingPicker value={4} onChange={onChange} disabled />);
    await fireEvent.press(screen.getByTestId("rating-9"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("steps within 1-10 and starts from 5", () => {
    expect(stepRating(null, "increment")).toBe(5);
    expect(stepRating(10, "increment")).toBe(10);
    expect(stepRating(1, "decrement")).toBe(1);
    expect(ratingValueText(null)).toBe("Not rated");
  });
});
