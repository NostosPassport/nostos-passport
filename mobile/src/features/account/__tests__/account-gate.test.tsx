/** "Sign in to post" must never show while the account is still loading or failed to load. */
import { fireEvent, render, screen } from "@testing-library/react-native";

import { accountState } from "@/auth/account-state";
import { AccountGate } from "../account-gate";

let mockState: ReturnType<typeof import("@/auth/account-state").useAccountState>;
const retry = jest.fn();
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/auth/account-state", () => ({ ...jest.requireActual("@/auth/account-state"), useAccountState: () => mockState }));

describe("accountState", () => {
  const me = (isSuccess: boolean, isError: boolean) => ({ isSuccess, isError });
  it("is checking while auth or /api/me is loading, never 'guest'", () => {
    expect(accountState("loading", me(false, false))).toBe("checking");
    expect(accountState("signedIn", me(false, false))).toBe("checking");
  });
  it("is an error when signed in but /api/me failed", () => {
    expect(accountState("signedIn", me(false, true))).toBe("error");
  });
  it("is a guest only when there is no account, and ready once /api/me loaded", () => {
    expect(accountState("signedOut", me(false, false))).toBe("guest");
    expect(accountState("guest", me(false, false))).toBe("guest");
    expect(accountState("signedIn", me(true, false))).toBe("ready");
  });
});

describe("AccountGate", () => {
  const render_ = async () => render(<AccountGate title="Stamp a place" message="Sign in to stamp the places you go."><></></AccountGate>);

  it("checking: says so, and offers no sign-in", async () => {
    mockState = { state: "checking", retry, retrying: false };
    await render_();
    expect(screen.getByText("Checking your account")).toBeTruthy();
    expect(screen.queryByText("Sign in")).toBeNull();
    expect(screen.queryByText(/Sign in to/)).toBeNull();
  });

  it("error: offers Try again, not Sign in", async () => {
    mockState = { state: "error", retry, retrying: false };
    await render_();
    expect(screen.getByText(/Couldn't check your account/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Try again"));
    expect(retry).toHaveBeenCalled();
    expect(screen.queryByText("Sign in")).toBeNull();
  });

  it("guest: the sign-in prompt", async () => {
    mockState = { state: "guest", retry, retrying: false };
    await render_();
    expect(screen.getByText("Stamp a place")).toBeTruthy();
    expect(screen.getByText("Sign in")).toBeTruthy();
  });

  it("ready: shows the screen", async () => {
    mockState = { state: "ready", retry, retrying: false };
    await render(<AccountGate title="t" message="m"><></></AccountGate>);
    expect(screen.queryByText("Checking your account")).toBeNull();
    expect(screen.queryByText("Sign in")).toBeNull();
  });
});
