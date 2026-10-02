/** The 21+ gate: the sign-up form and the guest gate turn away under-21s and keep nothing. */
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";

import { testQueryClient } from "@/test/query-client";
import AgeGate from "@/app/age-gate";
import SignUp from "@/app/sign-up";

const mockBrowse = jest.fn();
const mockSignup = jest.fn();
const mockSignIn = jest.fn();

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));
jest.mock("@/auth/auth-context", () => ({ useAuth: () => ({ browseAsGuest: mockBrowse, signIn: mockSignIn }) }));
jest.mock("@/api", () => {
  const client = jest.requireActual("@/api/client");
  return { api: { auth: { signup: (b: unknown) => mockSignup(b) } }, ApiError: client.ApiError, errorText: client.errorText };
});

const wrap = async (ui: React.ReactElement) => render(<QueryClientProvider client={testQueryClient()}>{ui}</QueryClientProvider>);
const yearsAgo = (years: number, dayOffset = 0) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + dayOffset);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}${dd}${d.getFullYear()}`;
};

beforeEach(() => {
  mockBrowse.mockClear();
  mockSignup.mockReset();
  mockSignIn.mockClear();
  jest.mocked(SecureStore.setItemAsync).mockClear();
});

describe("guest age gate", () => {
  it("lets in someone who is 21 today, and formats the date as they type", async () => {
    await wrap(<AgeGate />);
    await fireEvent.changeText(screen.getByTestId("age-gate-birthdate"), yearsAgo(21));
    expect(screen.getByTestId("age-gate-birthdate").props.value).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    await fireEvent.press(screen.getByText("Continue"));
    expect(mockBrowse).toHaveBeenCalledTimes(1);
  });

  it("turns away someone a day short of 21: one sentence, no way forward, nothing saved", async () => {
    await wrap(<AgeGate />);
    await fireEvent.changeText(screen.getByTestId("age-gate-birthdate"), yearsAgo(21, 1));
    await fireEvent.press(screen.getByText("Continue"));
    expect(mockBrowse).not.toHaveBeenCalled();
    expect(screen.getByText("Nostos is for people 21 and older.")).toBeTruthy();
    expect(screen.queryByText("Continue")).toBeNull();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("asks again for an impossible date instead of guessing", async () => {
    await wrap(<AgeGate />);
    await fireEvent.changeText(screen.getByTestId("age-gate-birthdate"), "02301990");
    await fireEvent.press(screen.getByText("Continue"));
    expect(mockBrowse).not.toHaveBeenCalled();
    expect(screen.getByText("Enter your birthdate as MM/DD/YYYY.")).toBeTruthy();
  });
});

describe("sign-up age gate", () => {
  async function fill(birthdate: string) {
    await wrap(<SignUp />);
    await fireEvent.changeText(screen.getByLabelText("Email"), "sam@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "long enough pw");
    await fireEvent.changeText(screen.getByLabelText("Handle"), "sam_s");
    await fireEvent.changeText(screen.getByLabelText("Name"), "Sam");
    await fireEvent.changeText(screen.getByTestId("signup-birthdate"), birthdate);
    await fireEvent.press(screen.getByLabelText("I agree to the Terms and Privacy policy"));
  }

  it("has a birthdate field in place of the old 21+ checkbox", async () => {
    await wrap(<SignUp />);
    expect(screen.getByTestId("signup-birthdate")).toBeTruthy();
    expect(screen.queryByLabelText("I'm 21 or older")).toBeNull();
  });

  it("sends the birthdate to the server once, as YYYY-MM-DD, when the person is 21 or older", async () => {
    mockSignup.mockResolvedValue({ token: "t", expiresAt: "2027-01-01T00:00:00.000Z", user: { id: "u", handle: "sam_s", displayName: "Sam", role: "USER" } });
    await fill("05051990");
    await fireEvent.press(screen.getByText("Create account"));
    expect(mockSignup).toHaveBeenCalledTimes(1);
    expect(mockSignup.mock.calls[0][0]).toMatchObject({ email: "sam@example.com", birthdate: "1990-05-05", acceptTerms: true });
    expect(mockSignup.mock.calls[0][0]).not.toHaveProperty("confirm21");
  });

  it("never sends an under-21 birthdate: it stops on the phone and says why", async () => {
    await fill(yearsAgo(20));
    await fireEvent.press(screen.getByText("Create account"));
    expect(mockSignup).not.toHaveBeenCalled();
    expect(screen.getAllByText("Nostos is for people 21 and older.").length).toBeGreaterThan(0);
  });
});
