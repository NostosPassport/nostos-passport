/** Social off (the default): no like button. */
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";

import { testQueryClient } from "@/test/query-client";
import { StampCard } from "../stamp-card";

let mockFlag = false;
jest.mock("@/config", () => ({ get SOCIAL_ENABLED() { return mockFlag; } }));

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/auth/auth-context", () => ({ useAuth: () => ({ status: "signedIn" }) }));
jest.mock("@/api", () => ({ api: {}, mediaUrl: (u: string) => u, errorText: (_e: unknown, f: string) => f }));

const stamp = {
  id: "s1", photoUrl: null, caption: "hello", song: null, createdAt: "2026-09-24T02:00:00.000Z", editedAt: null,
  place: { id: "p1", slug: "v", name: "Velvet", neighborhood: "East Village" },
  author: { handle: "sam", displayName: "Sam", avatarUrl: null, verified: false }, mine: true, likes: { count: 2, viewerLiked: false }, hidden: false, removed: false,
};

function configWith(flag: string | undefined): boolean {
  const prev = process.env.EXPO_PUBLIC_SOCIAL_ENABLED;
  if (flag === undefined) delete process.env.EXPO_PUBLIC_SOCIAL_ENABLED;
  else process.env.EXPO_PUBLIC_SOCIAL_ENABLED = flag;
  let value = true;
  jest.isolateModules(() => {
    value = (jest.requireActual("@/config") as { SOCIAL_ENABLED: boolean }).SOCIAL_ENABLED;
  });
  process.env.EXPO_PUBLIC_SOCIAL_ENABLED = prev;
  return value;
}

const card = () => render(<QueryClientProvider client={testQueryClient()}><StampCard stamp={stamp as never} /></QueryClientProvider>);

describe("SOCIAL_ENABLED", () => {
  it("is off unless the build sets it to 1", () => {
    expect(configWith(undefined)).toBe(false);
    expect(configWith("0")).toBe(false);
    expect(configWith("1")).toBe(true);
  });

  it("off: a stamp shows no like button", async () => {
    mockFlag = false;
    await card();
    expect(screen.queryByLabelText(/like/i)).toBeNull();
  });

  it("on: the like button is there", async () => {
    mockFlag = true;
    await card();
    expect(screen.getByLabelText("2 likes")).toBeTruthy();
  });
});
