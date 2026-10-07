import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import SignUp from "@/app/sign-up";
import { testQueryClient } from "@/test/query-client";

const mockStartSignup = jest.fn();
const mockCompleteSignup = jest.fn();
const mockSignIn = jest.fn();

const CHALLENGE = "11111111-1111-4111-8111-111111111111";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, Stack: { Screen: () => null } }));
jest.mock("@/auth/auth-context", () => ({ useAuth: () => ({ signIn: mockSignIn }) }));
jest.mock("@/api/email-auth", () => ({
  startSignupEmail: (...args: unknown[]) => mockStartSignup(...args),
  completeSignup: (body: unknown) => mockCompleteSignup(body),
}));

const wrap = async (ui: React.ReactElement) => render(<QueryClientProvider client={testQueryClient()}>{ui}</QueryClientProvider>);
const yearsAgo = (years: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}${dd}${d.getFullYear()}`;
};

beforeEach(() => {
  mockStartSignup.mockReset();
  mockCompleteSignup.mockReset();
  mockSignIn.mockClear();
  mockStartSignup.mockResolvedValue({ challengeId: CHALLENGE, expiresAt: "2026-10-07T20:00:00.000Z", resendAfterSeconds: 60 });
});

describe("sign-up age gate", () => {
  async function fill(birthdate: string) {
    await wrap(<SignUp />);
    await fireEvent.changeText(screen.getByLabelText("Email"), "sam@example.com");
    await fireEvent.changeText(screen.getByLabelText("Handle"), "sam_s");
    await fireEvent.changeText(screen.getByLabelText("Name"), "Sam");
    await fireEvent.changeText(screen.getByTestId("signup-birthdate"), birthdate);
    await fireEvent.press(screen.getByLabelText("I agree to the Terms and Privacy policy"));
  }

  it("requires a birthdate and has no password fields", async () => {
    await wrap(<SignUp />);
    expect(screen.getByTestId("signup-birthdate")).toBeTruthy();
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.queryByLabelText("Confirm password")).toBeNull();
    expect(screen.getByLabelText("Verify email")).toBeTruthy();
    expect(screen.getByText("For people 13 and over. Only you can see it.")).toBeTruthy();
  });

  it("verifies an eligible email, then creates the account with the code", async () => {
    mockCompleteSignup.mockResolvedValue({ token: "t", expiresAt: "2027-01-01T00:00:00.000Z", user: { id: "u", handle: "sam_s", displayName: "Sam", role: "USER" } });
    await fill("05051990");

    await fireEvent.press(screen.getByLabelText("Verify email"));
    await waitFor(() => expect(mockStartSignup).toHaveBeenCalledWith("sam@example.com", "Sam", "1990-05-05"));

    const code = await screen.findByLabelText("Verification code");
    await fireEvent.changeText(code, "123456");
    await fireEvent.press(screen.getByLabelText("Create account"));

    await waitFor(() =>
      expect(mockCompleteSignup).toHaveBeenCalledWith({
        challengeId: CHALLENGE,
        code: "123456",
        handle: "sam_s",
        displayName: "Sam",
        acceptTerms: true,
      }),
    );
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
  });

  it("never requests verification for someone under 13", async () => {
    await fill(yearsAgo(12));
    await fireEvent.press(screen.getByLabelText("Verify email"));
    expect(mockStartSignup).not.toHaveBeenCalled();
    expect(screen.getAllByText("Nostos is for people 13 and older.").length).toBeGreaterThan(0);
  });
});
