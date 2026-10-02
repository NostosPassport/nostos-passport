import { fireEvent, render, screen } from "@testing-library/react-native";

import { ReportBar } from "../report-bar";
import type { ReportBarState } from "../report-bar-state";

async function setup(state: ReportBarState, notice: { kind: "VIBE" | "LINE" | "COVER" | "PHOTO"; message: string } | null = null) {
  const handlers = {
    onReport: jest.fn(),
    onCamera: jest.fn(),
    onSignIn: jest.fn(),
    onEnableLocation: jest.fn(),
    onOpenSettings: jest.fn(),
  };
  return { handlers, view: await render(<ReportBar state={state} notice={notice} {...handlers} />) };
}

describe("ReportBar", () => {
  it("inside the geofence: every action works", async () => {
    const { handlers } = await setup({ kind: "ready" });
    await screen.findByLabelText("Report vibe");
    await fireEvent.press(screen.getByLabelText("Report vibe"));
    await fireEvent.press(screen.getByLabelText("Report line"));
    await fireEvent.press(screen.getByLabelText("Report cover"));
    await fireEvent.press(screen.getByLabelText("Post a photo"));
    expect(handlers.onReport.mock.calls.map((c) => c[0])).toEqual(["VIBE", "LINE", "COVER"]);
    expect(handlers.onCamera).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("report-bar-message")).toBeNull();
  });

  it("outside the geofence: dimmed, disabled, and shows the server's distance", async () => {
    const { handlers } = await setup({ kind: "outside", distanceM: 140 });
    await screen.findByText("You're 140 m away. Get closer to post.");
    const vibe = screen.getByLabelText("Report vibe");
    expect(vibe).toBeDisabled();
    await fireEvent.press(vibe);
    await fireEvent.press(screen.getByLabelText("Post a photo"));
    expect(handlers.onReport).not.toHaveBeenCalled();
    expect(handlers.onCamera).not.toHaveBeenCalled();
    expect(screen.getByTestId("report-bar-actions")).toHaveStyle({ opacity: 0.45 });
  });

  it("cooldown: says so inline (without a countdown that could go stale) and still allows other kinds", async () => {
    const message = "You already posted a vibe update here. Try again in 12 min.";
    const { handlers } = await setup({ kind: "ready" }, { kind: "VIBE", message });
    const line = "You posted a vibe update here recently. You can post again soon.";
    await screen.findByText(line);
    expect(screen.queryByText(message)).toBeNull();
    expect(screen.getByLabelText("Report vibe").props.accessibilityHint).toBe(line);
    await fireEvent.press(screen.getByLabelText("Report line"));
    expect(handlers.onReport).toHaveBeenCalledWith("LINE");
  });

  it("guests are asked to sign in", async () => {
    const { handlers } = await setup({ kind: "signin" });
    await fireEvent.press(await screen.findByText("Sign in to post what it's like here"));
    expect(handlers.onSignIn).toHaveBeenCalled();
  });

  it("no location yet: asks to share it", async () => {
    const { handlers } = await setup({ kind: "needs-location" });
    await fireEvent.press(await screen.findByText("Share your location to post"));
    expect(handlers.onEnableLocation).toHaveBeenCalled();
  });

  it("renders nothing for the venue's owner", async () => {
    await setup({ kind: "hidden" });
    expect(screen.queryByLabelText("Report vibe")).toBeNull();
  });
});
