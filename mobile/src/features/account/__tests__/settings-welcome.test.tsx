/** The restyled Settings and Welcome screens: what is there in personal mode. */
import { fireEvent, render, screen } from "@testing-library/react-native";

import Settings from "@/app/(app)/settings/index";
import Welcome from "@/app/welcome";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock("@/config", () => ({ SOCIAL_ENABLED: false }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("@/auth/auth-context", () => ({ useAuth: () => ({ signOut: jest.fn() }), farewellNotice: { take: () => null } }));
jest.mock("@/api", () => {
  const client = jest.requireActual("@/api/client");
  return { api: {}, mediaUrl: (u: string) => u, errorText: client.errorText };
});
jest.mock("@/api/queries", () => ({
  useMe: () => ({ data: { user: { handle: "ava", displayName: "Ava Lee", role: "USER", memberSince: "2026-10-03T04:00:00.000Z" } }, refetch: jest.fn() }),
  useFollowing: () => ({ isPending: false, data: { following: [] }, refetch: jest.fn() }),
}));

describe("Settings in personal mode", () => {
  beforeEach(() => mockPush.mockClear());

  it("has Edit profile (the only way in now that the passport tab is the book) and says only you can see your passport", async () => {
    await render(<Settings />);
    await fireEvent.press(screen.getByRole("button", { name: /^Edit profile/ }));
    expect(mockPush).toHaveBeenCalledWith("/edit-profile");
    expect(screen.getByText("Only you can see your passport")).toBeTruthy();
  });
  it("has no following list, no find people and no blocked users", async () => {
    await render(<Settings />);
    expect(screen.queryByText("Find people")).toBeNull();
    expect(screen.queryByText("Blocked users")).toBeNull();
    expect(screen.queryByText("Following")).toBeNull();
  });
  it("keeps the quiet Customize row, the legal links, sign out and delete account", async () => {
    await render(<Settings />);
    for (const t of ["Customize, coming soon", "Privacy policy", "Terms", "Support", "Sign out", "Delete account"]) expect(screen.getByText(t)).toBeTruthy();
  });
});

describe("Welcome", () => {
  it("says the passport is yours alone, offers the three ways in, and shows no map", async () => {
    await render(<Welcome />);
    expect(screen.getByText("Go somewhere. Get a stamp.")).toBeTruthy();
    expect(screen.getByText(/Only you can see it\./)).toBeTruthy();
    expect(screen.queryByText(/Only people you approve/)).toBeNull();
    for (const t of ["Create account", "Sign in", "Look around first"]) expect(screen.getByText(t)).toBeTruthy();
  });
});
