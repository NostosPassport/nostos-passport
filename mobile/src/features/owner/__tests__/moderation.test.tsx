import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";

import type { ModQueueResponse } from "@/api/contracts";
import Moderation from "@/app/(app)/moderation";
import { testQueryClient } from "@/test/query-client";

const mockAct = jest.fn(async (_v: unknown) => ({ target: null }));
const queue: ModQueueResponse = {
  items: [
    {
      targetType: "PHOTO",
      targetId: "p1",
      venue: { name: "Velvet", slug: "velvet" },
      content: { kind: "PHOTO", preview: "Crowd shot", url: "https://x/p1", author: "@maya", authorRep: 0.8, hiddenAt: null, createdAt: "2026-09-24T02:00:00.000Z" },
      flags: [{ id: "f1", reason: "Harassment or hate", createdAt: "2026-09-24T02:10:00.000Z", by: "@sam", byRole: "USER", byVenueOwner: false, byOtherVenueOwner: true }],
      history: [],
    },
    {
      targetType: "USER",
      targetId: "u9",
      venue: null,
      content: { kind: "USER", preview: "@spammer", author: "@spammer", authorRep: 0.2, hiddenAt: null, createdAt: "2026-09-01T00:00:00.000Z" },
      flags: [{ id: "f2", reason: "Spam or scam", createdAt: "2026-09-24T02:10:00.000Z", by: "@ali", byRole: "USER", byVenueOwner: false, byOtherVenueOwner: false }],
      history: [],
    },
  ],
};

jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("@/api/queries", () => ({
  useModQueue: () => ({ data: queue, isPending: false, isError: false, refetch: jest.fn() }),
  useModHidden: () => ({ data: { items: [] }, isPending: false, isError: false, refetch: jest.fn() }),
  useModLog: () => ({ data: { events: [] }, isPending: false, isError: false, refetch: jest.fn() }),
}));
jest.mock("@/api", () => {
  const client = jest.requireActual("@/api/client");
  return { api: { mod: { act: (v: unknown) => mockAct(v) } }, ApiError: client.ApiError, errorText: client.errorText, mediaUrl: (u: string) => u };
});

describe("Moderation queue", () => {
  it("groups flags under each item, with reasons and who flagged", async () => {
    await render(
      <QueryClientProvider client={testQueryClient()}>
        <Moderation />
      </QueryClientProvider>,
    );
    expect(screen.getByText("“Harassment or hate”")).toBeTruthy();
    expect(screen.getByText(/another venue\u2019s owner/)).toBeTruthy();
    expect(screen.getByText("Velvet · 1 flag")).toBeTruthy();
  });

  it("hides content and suspends accounts, after a confirmation with an optional note", async () => {
    const prompt = jest.spyOn(Alert, "prompt").mockImplementation((_t, _m, buttons) => {
      if (Array.isArray(buttons)) buttons[1].onPress?.("Clear violation" as never);
    });
    await render(
      <QueryClientProvider client={testQueryClient()}>
        <Moderation />
      </QueryClientProvider>,
    );
    await fireEvent.press(screen.getByLabelText("Hide photo by @maya"));
    await fireEvent.press(screen.getByLabelText("Suspend @spammer"));
    expect(prompt).toHaveBeenCalledTimes(2);
    expect(mockAct).toHaveBeenNthCalledWith(1, { targetType: "PHOTO", targetId: "p1", action: "HIDE", note: "Clear violation" });
    expect(mockAct).toHaveBeenNthCalledWith(2, { targetType: "USER", targetId: "u9", action: "SUSPEND", note: "Clear violation" });
  });
});
