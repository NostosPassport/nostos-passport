import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { ApiError } from "@/api/client";
import SignIn from "@/app/sign-in";
import { nav } from "@/lib/nav";
import { testQueryClient } from "@/test/query-client";

const mockPush = jest.fn();
const mockStart = jest.fn();
const mockComplete = jest.fn();
const mockSignIn = jest.fn();
const CHALLENGE = "11111111-1111-4111-8111-111111111111";

jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn(), replace: jest.fn() } }));
jest.mock("@/auth/auth-context", () => ({ useAuth: () => ({ signIn: mockSignIn }), farewellNotice: { take: () => null } }));
jest.mock("@/api/email-auth", () => ({
  startEmailSignIn: (id: string) => mockStart(id),
  completeEmailSignIn: (challengeId: string, code: string) => mockComplete(challengeId, code),
}));

const renderScreen = () => render(<QueryClientProvider client={testQueryClient()}><SignIn /></QueryClientProvider>);

beforeEach(() => {
  mockPush.mockClear();
  mockStart.mockReset();
  mockComplete.mockReset();
  mockSignIn.mockClear();
  nav.reset();
  mockStart.mockResolvedValue({ challengeId: CHALLENGE, expiresAt: "2026-10-07T20:00:00.000Z", resendAfterSeconds: 60 });
});

describe("Sign in", () => {
  it("uses the shared field and button, then shows a focused code step with resend and change", async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText("Email or handle"), "sam@example.com");
    await fireEvent.press(screen.getByRole("button", { name: "Send sign-in code" }));
    await waitFor(() => expect(mockStart).toHaveBeenCalledWith("sam@example.com"));

    const code = await screen.findByLabelText("Verification code");
    expect(code.props.autoFocus).toBe(true);
    expect(screen.getByText("We sent a six-digit code to sam@example.com.")).toBeTruthy();
    // Cooldown: resend is not available straight away.
    expect(screen.getByRole("button", { name: "Send another code" }).props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(code, "12a3456");
    mockComplete.mockResolvedValue({ token: "t", expiresAt: "2027-01-01T00:00:00.000Z", user: { id: "u", handle: "sam", displayName: "Sam", role: "USER" } });
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(mockComplete).toHaveBeenCalledWith(CHALLENGE, "123456"));
  });

  it("lets the user go back and change the address after a code is sent", async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText("Email or handle"), "sam@example.com");
    await fireEvent.press(screen.getByRole("button", { name: "Send sign-in code" }));
    await screen.findByLabelText("Verification code");
    await fireEvent.press(screen.getByRole("button", { name: "Use a different email or handle" }));
    expect(screen.queryByLabelText("Verification code")).toBeNull();
    expect(screen.getByRole("button", { name: "Send sign-in code" })).toBeTruthy();
  });

  it("marks a wrong code and clears the error once the user types again", async () => {
    mockComplete.mockRejectedValue(new ApiError(400, "invalid_code", "That code is not correct."));
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText("Email or handle"), "sam");
    await fireEvent.press(screen.getByRole("button", { name: "Send sign-in code" }));
    expect(await screen.findByText("We sent a six-digit code to the email on your account.")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Verification code"), "000000");
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("That code is not correct.")).toBeTruthy();
    expect(screen.getByLabelText("Verification code, needs attention")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Verification code, needs attention"), "1");
    expect(screen.queryByText("That code is not correct.")).toBeNull();
  });

  it("keeps a primary button in place when there is no account, and it opens sign-up", async () => {
    mockStart.mockRejectedValue(new ApiError(404, "not_found", "No account."));
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText("Email or handle"), "new@example.com");
    await fireEvent.press(screen.getByRole("button", { name: "Send sign-in code" }));
    expect(await screen.findByText("Looks like you’re new to Nostos.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Create a passport" }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/sign-up", params: { email: "new@example.com" } });
  });
});
