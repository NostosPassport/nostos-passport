/** Apple Guideline 1.2: every stamp and every profile can be reported, and its author blocked, in the app. */
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ActionSheetIOS } from "react-native";

import type { StampView } from "@/api/contracts";
import { StampCard } from "@/features/stamps/stamp-card";
import { testQueryClient } from "@/test/query-client";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock("@/auth/auth-context", () => ({ useAuth: () => ({ status: "signedIn" }) }));
jest.mock("@/api", () => ({ api: {}, mediaUrl: (u: string) => u, errorText: (_e: unknown, f: string) => f }));

const stamp = (over: Partial<StampView> = {}): StampView => ({
  id: "s1", photoUrl: null, photos: [], page: 1, slot: 1, caption: "hello", song: null, createdAt: "2026-09-24T02:00:00.000Z", editedAt: null,
  place: { id: "p1", slug: "velvet", name: "Velvet", neighborhood: "East Village", neighborhoodId: null },
  author: { handle: "sam", displayName: "Sam", avatarUrl: null, verified: false }, mine: false, likes: { count: 0, viewerLiked: false }, hidden: false, removed: false, ...over,
});

describe("Report and Block on every stamp", () => {
  it("someone else's stamp has Report and Block, and Report offers the underage, stalking and not-at-this-place reasons", async () => {
    const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation(() => undefined);
    await render(<QueryClientProvider client={testQueryClient()}><StampCard stamp={stamp()} /></QueryClientProvider>);
    await fireEvent.press(screen.getByLabelText("More options"));
    const menu = sheet.mock.calls[0]![0];
    expect(menu.options).toEqual(["Report stamp", "Block @sam", "Cancel"]);
    expect(menu.destructiveButtonIndex).toEqual([0, 1]);
    // Choosing Report opens the reasons.
    sheet.mock.calls[0]![1](0);
    const reasons = sheet.mock.calls[1]![0].options as string[];
    expect(reasons).toEqual(expect.arrayContaining(["Under 21 or looks underage", "Stalking or unwanted contact", "Not at this place"]));
    sheet.mockRestore();
  });

  it("your own stamp has no Report or Block (you can edit or delete it from its detail screen)", async () => {
    await render(<QueryClientProvider client={testQueryClient()}><StampCard stamp={stamp({ mine: true })} /></QueryClientProvider>);
    expect(screen.queryByLabelText("More options")).toBeNull();
  });
});
