import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import ChangeEmail from "@/app/(app)/settings/email";
import { testQueryClient } from "@/test/query-client";

const mockStart = jest.fn();
const mockComplete = jest.fn();
const CHALLENGE = "11111111-1111-4111-8111-111111111111";

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
  Stack: { Screen: () => null },
}));
jest.mock("@/api/queries", () => ({ useMe: () => ({ data: { user: { email: "ava@example.com" } } }) }));
jest.mock("@/api/email-auth", () => ({
  startAccountEmailChange: (email: string) => mockStart(email),
  completeAccountEmailChange: (id: string, code: string) => mockComplete(id, code),
}));

const renderScreen = () => render(<QueryClientProvider client={testQueryClient()}><ChangeEmail /></QueryClientProvider>);

describe("Change email", () => {
  beforeEach(() => {
    mockStart.mockReset();
    mockStart.mockResolvedValue({ challengeId: CHALLENGE, expiresAt: "2026-10-07T20:00:00.000Z", resendAfterSeconds: 60 });
  });

  it("starts empty, shows the current address, trims, and lets the user change the address after Verify", async () => {
    await renderScreen();
    expect(screen.getByLabelText("New email").props.value).toBe("");
    expect(screen.getByText("Currently ava@example.com")).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText("New email"), " new@example.com ");
    await fireEvent(screen.getByLabelText("New email"), "submitEditing");
    await waitFor(() => expect(mockStart).toHaveBeenCalledWith("new@example.com"));

    const code = await screen.findByLabelText("Verification code");
    expect(code.props.autoFocus).toBe(true);
    expect(screen.getByText("We sent a six-digit code to new@example.com.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send another code" })).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Use a different email" }));
    expect(screen.queryByLabelText("Verification code")).toBeNull();
    expect(screen.getByLabelText("New email").props.editable).not.toBe(false);
  });
});
