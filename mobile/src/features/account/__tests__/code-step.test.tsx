import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { CodeStep, MIN_RESEND_SECONDS } from "@/features/account/code-step";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("CodeStep", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const props = { resendAfterSeconds: 0, code: "", onChangeCode: jest.fn(), sentTo: "sam@example.com" };

  it("holds resend for a short cooldown, then confirms a new code was sent", async () => {
    const onResend = jest.fn();
    const view = await render(<CodeStep {...props} challengeId={A} onResend={onResend} />);
    const resend = () => screen.getByRole("button", { name: "Send another code" });
    expect(resend().props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText(`Send another code in ${MIN_RESEND_SECONDS}s`)).toBeTruthy();

    await act(async () => { jest.advanceTimersByTime(MIN_RESEND_SECONDS * 1000); });
    expect(resend().props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(resend());
    expect(onResend).toHaveBeenCalledTimes(1);

    await view.rerender(<CodeStep {...props} challengeId={B} onResend={onResend} />);
    expect(screen.getByText("New code sent to sam@example.com.")).toBeTruthy();
    expect(resend().props.accessibilityState.disabled).toBe(true);
  });

  it("keeps only digits and offers a way to change the address", async () => {
    const onChangeCode = jest.fn();
    const onChangeAddress = jest.fn();
    await render(<CodeStep {...props} onChangeCode={onChangeCode} challengeId={A} onResend={jest.fn()} onChangeAddress={onChangeAddress} />);
    await fireEvent.changeText(screen.getByLabelText("Verification code"), "12-34 567");
    expect(onChangeCode).toHaveBeenCalledWith("123456");
    await fireEvent.press(screen.getByRole("button", { name: "Use a different email" }));
    expect(onChangeAddress).toHaveBeenCalled();
  });
});
