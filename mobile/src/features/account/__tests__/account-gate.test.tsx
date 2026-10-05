import { fireEvent, render, screen } from "@testing-library/react-native";

import { accountState } from "@/auth/account-state";
import { AccountGate } from "../account-gate";

let mockState: ReturnType<typeof import("@/auth/account-state").useAccountState>;
const retry = jest.fn();
jest.mock("@/auth/account-state", () => ({ ...jest.requireActual("@/auth/account-state"), useAccountState: () => mockState }));

describe("accountState", () => {
  const me = (isSuccess: boolean, isError: boolean) => ({ isSuccess, isError });

  it("stays checking until a signed-in account has loaded", () => {
    expect(accountState("loading", me(false, false))).toBe("checking");
    expect(accountState("signedOut", me(false, false))).toBe("checking");
    expect(accountState("signedIn", me(false, false))).toBe("checking");
  });

  it("is an error when signed in but /api/me failed", () => {
    expect(accountState("signedIn", me(false, true))).toBe("error");
  });

  it("is ready once the signed-in account loaded", () => {
    expect(accountState("signedIn", me(true, false))).toBe("ready");
  });
});

describe("AccountGate", () => {
  const renderGate = () => render(<AccountGate title="Stamp a place" message="Loading your passport."><></></AccountGate>);

  it("checking: says so and offers no sign-in action", () => {
    mockState = { state: "checking", retry, retrying: false };
    renderGate();
    expect(screen.getByText("Checking your account")).toBeTruthy();
    expect(screen.queryByText("Sign in")).toBeNull();
  });

  it("error: offers Try again", () => {
    mockState = { state: "error", retry, retrying: false };
    renderGate();
    expect(screen.getByText(/Couldn't check your account/)).toBeTruthy();
    fireEvent.press(screen.getByText("Try again"));
    expect(retry).toHaveBeenCalled();
    expect(screen.queryByText("Sign in")).toBeNull();
  });

  it("ready: shows the protected screen", () => {
    mockState = { state: "ready", retry, retrying: false };
    render(<AccountGate title="t" message="m"><></></AccountGate>);
    expect(screen.queryByText("Checking your account")).toBeNull();
    expect(screen.queryByText("Sign in")).toBeNull();
  });
});
