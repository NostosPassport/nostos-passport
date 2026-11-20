import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";

import Settings from "@/app/(app)/settings/index";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn() }, Stack: { Screen: () => null } }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const mockSignOut = jest.fn();
jest.mock("@/auth/auth-context", () => ({ useAuth: () => ({ signOut: () => mockSignOut() }) }));
jest.mock("@/api/queries", () => ({
  useMe: () => ({ data: { user: { handle: "ava", displayName: "Ava Lee", role: "USER", memberSince: "2026-10-03T04:00:00.000Z" } }, refetch: jest.fn() }),
}));

describe("Settings in personal mode", () => {
  beforeEach(() => mockPush.mockClear());

  it("opens profile editing and states that the passport is private", async () => {
    await render(<Settings />);
    await fireEvent.press(screen.getByRole("button", { name: /^Edit profile/ }));
    expect(mockPush).toHaveBeenCalledWith("/edit-profile");
    expect(screen.getByText("Your passport is private, and there is no feed.")).toBeTruthy();
    expect(screen.getByText("Only collections you choose to share get a link.")).toBeTruthy();
    expect(screen.queryByText(/Nothing is shared/)).toBeNull();
  });

  it("has no following, find people, or blocked-user surfaces", async () => {
    await render(<Settings />);
    expect(screen.queryByText("Find people")).toBeNull();
    expect(screen.queryByText("Blocked users")).toBeNull();
    expect(screen.queryByText("Following")).toBeNull();
  });

  it("keeps customization, legal links, sign out, and account deletion", async () => {
    await render(<Settings />);
    for (const title of ["Customize", "Privacy policy", "Terms", "Support", "Sign out", "Delete account"]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  it("shows sign-out progress and ignores a second sign-out while it runs", async () => {
    let finish: () => void = () => undefined;
    mockSignOut.mockImplementation(() => new Promise<void>((r) => { finish = r; }));
    const alert = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.style === "destructive")?.onPress?.());
    await render(<Settings />);
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Sign out" }).props.accessibilityState.busy).toBe(true);
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(alert).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    alert.mockRestore();
  });
});
