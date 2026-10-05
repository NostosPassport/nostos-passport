import { fireEvent, render, screen } from "@testing-library/react-native";

import Settings from "@/app/(app)/settings/index";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn() }, Stack: { Screen: () => null } }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("@/auth/auth-context", () => ({ useAuth: () => ({ signOut: jest.fn() }) }));
jest.mock("@/api/queries", () => ({
  useMe: () => ({ data: { user: { handle: "ava", displayName: "Ava Lee", role: "USER", memberSince: "2026-10-03T04:00:00.000Z" } }, refetch: jest.fn() }),
}));

describe("Settings in personal mode", () => {
  beforeEach(() => mockPush.mockClear());

  it("opens profile editing and states that the passport is private", async () => {
    await render(<Settings />);
    await fireEvent.press(screen.getByRole("button", { name: /^Edit profile/ }));
    expect(mockPush).toHaveBeenCalledWith("/edit-profile");
    expect(screen.getByText("Only you can see your passport.")).toBeTruthy();
    expect(screen.getByText("Nothing is shared, and there is no feed.")).toBeTruthy();
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
});
