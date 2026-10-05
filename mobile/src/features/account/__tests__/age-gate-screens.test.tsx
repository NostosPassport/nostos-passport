import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";

import SignUp from "@/app/sign-up";
import { testQueryClient } from "@/test/query-client";

const mockSignup = jest.fn();
const mockSignIn = jest.fn();

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));
jest.mock("@/auth/auth-context", () => ({ useAuth: () => ({ signIn: mockSignIn }) }));
jest.mock("@/api", () => {
  const client = jest.requireActual("@/api/client");
  return { api: { auth: { signup: (b: unknown) => mockSignup(b) } }, ApiError: client.ApiError, errorText: client.errorText };
});

const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={testQueryClient()}>{ui}</QueryClientProvider>);
const yearsAgo = (years: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}${dd}${d.getFullYear()}`;
};

beforeEach(() => {
  mockSignup.mockReset();
  mockSignIn.mockClear();
});

describe("sign-up age gate", () => {
  function fill(birthdate: string) {
    wrap(<SignUp />);
    fireEvent.changeText(screen.getByLabelText("Email"), "sam@example.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "long enough pw");
    fireEvent.changeText(screen.getByLabelText("Handle"), "sam_s");
    fireEvent.changeText(screen.getByLabelText("Name"), "Sam");
    fireEvent.changeText(screen.getByTestId("signup-birthdate"), birthdate);
    fireEvent.press(screen.getByLabelText("I agree to the Terms and Privacy policy"));
  }

  it("requires a birthdate", () => {
    wrap(<SignUp />);
    expect(screen.getByTestId("signup-birthdate")).toBeTruthy();
    expect(screen.queryByLabelText("I'm 21 or older")).toBeNull();
  });

  it("sends an eligible birthdate to the server once as YYYY-MM-DD", () => {
    mockSignup.mockResolvedValue({ token: "t", expiresAt: "2027-01-01T00:00:00.000Z", user: { id: "u", handle: "sam_s", displayName: "Sam", role: "USER" } });
    fill("05051990");
    fireEvent.press(screen.getByText("Create account"));
    expect(mockSignup).toHaveBeenCalledTimes(1);
    expect(mockSignup.mock.calls[0][0]).toMatchObject({ email: "sam@example.com", birthdate: "1990-05-05", acceptTerms: true });
    expect(mockSignup.mock.calls[0][0]).not.toHaveProperty("confirm21");
  });

  it("never sends an under-21 birthdate", () => {
    fill(yearsAgo(20));
    fireEvent.press(screen.getByText("Create account"));
    expect(mockSignup).not.toHaveBeenCalled();
    expect(screen.getAllByText("Nostos is for people 21 and older.").length).toBeGreaterThan(0);
  });
});
