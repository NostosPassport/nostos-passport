import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";

import EditProfile from "@/app/(app)/edit-profile";
import { testQueryClient } from "@/test/query-client";

jest.mock("expo-router", () => ({ router: { back: jest.fn(), push: jest.fn() }, Stack: { Screen: () => null } }));
jest.mock("@/lib/use-confirm-discard", () => ({ useConfirmDiscard: () => undefined }));
jest.mock("@/api/queries", () => ({
  qk: { me: ["me"], profileSettings: ["me", "profile"] },
  useProfileSettings: () => ({ data: { profile: { handle: "ava", displayName: "Ava", bio: "", avatarUrl: null } } }),
}));

describe("Edit profile", () => {
  it("shows the handle as read-only and counts the bio as typed", async () => {
    await render(<QueryClientProvider client={testQueryClient()}><EditProfile /></QueryClientProvider>);
    expect(screen.getByLabelText("Handle").props.editable).toBe(false);
    expect(screen.getByText("Handles can't be changed.")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Bio"), "hi  ");
    expect(screen.getByText("4 / 150")).toBeTruthy();
  });
});
