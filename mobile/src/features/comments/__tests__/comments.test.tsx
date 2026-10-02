import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ActionSheetIOS } from "react-native";

import type { VenuePageResponse } from "@/api/contracts";
import { testQueryClient } from "@/test/query-client";
import { CommentsSection } from "../comments-section";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock("@/auth/auth-context", () => ({ useAuth: () => ({ status: "signedIn" }) }));

const now = "2026-09-24T03:00:00.000Z";

function page(over: Partial<VenuePageResponse["viewer"]> = {}): VenuePageResponse {
  return {
    now,
    viewer: { going: false, hereNow: false, ownsVenue: false, ...over },
    featured: { thisMonth: { month: "2026-09", photos: [], total: 0 }, archive: [] },
    official: {
      id: "v1", slug: "velvet", name: "Velvet", address: "", neighborhood: "East Village", lat: 0, lng: 0, hours: [], officialCoverCents: null,
      dressCode: null, officialPhotoUrl: null, attribution: null, promos: [], accuracy: { status: "no_official_cover", qualifyingWindows: 0, matchingWindows: 0, windows: [] },
    },
    live: {
      hereNow: 0, goingTonight: 0, friendsGoing: [], coverMismatch: false, livePhotos: [], earlierPhotos: [],
      consensus: {
        vibe: { status: "insufficient", reportCount: 0, userCount: 0, newestAt: null },
        line: { status: "insufficient", reportCount: 0, userCount: 0, newestAt: null },
        cover: { status: "insufficient", reportCount: 0, userCount: 0, newestAt: null },
      },
      comments: [
        { id: "c1", body: "Line's moving fast", createdAt: "2026-09-24T02:50:00.000Z", editedAt: null, author: { kind: "user", handle: "maya", verified: false, regular: false }, mine: false, replies: [{ id: "r1", body: "Thanks for coming", createdAt: "2026-09-24T02:55:00.000Z", author: { kind: "user", handle: "velvet_nyc", verified: false, regular: false }, mine: false }] },
        { id: "c2", body: "Great DJ", createdAt: "2026-09-24T02:40:00.000Z", editedAt: "2026-09-24T02:41:00.000Z", author: { kind: "deleted" }, mine: false, replies: [] },
        { id: "c3", body: "Mine", createdAt: "2026-09-24T02:30:00.000Z", editedAt: null, author: { kind: "user", handle: "me", verified: false, regular: false }, mine: true, replies: [] },
      ],
    },
  };
}

async function renderSection(p: VenuePageResponse) {
  const client = testQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <CommentsSection page={p} signedIn />
    </QueryClientProvider>,
  );
}

describe("CommentsSection", () => {
  const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation(() => undefined);
  afterEach(() => sheet.mockClear());

  it("labels deleted authors and venue replies", async () => {
    await renderSection(page());
    expect(await screen.findByText("Deleted user")).toBeTruthy();
    expect(screen.getByText("Velvet")).toBeTruthy();
    expect(screen.getByText("Venue")).toBeTruthy();
    expect(screen.getByText("10 min ago")).toBeTruthy();
    expect(screen.getByText("20 min ago · edited")).toBeTruthy();
  });

  it("offers Report and Block on others' comments, Edit on your own", async () => {
    await renderSection(page());
    await fireEvent.press(screen.getByLabelText("More options for @maya's comment"));
    expect(sheet.mock.calls[0][0].options).toEqual(["Report comment", "Block @maya", "Cancel"]);
    await fireEvent.press(screen.getByLabelText("More options for Deleted user's comment"));
    expect(sheet.mock.calls[1][0].options).toEqual(["Report comment", "Cancel"]);
    await fireEvent.press(screen.getByLabelText("More options for @me's comment"));
    expect(sheet.mock.calls[2][0].options).toEqual(["Edit", "Cancel"]);
  });

  it("reads each comment as one element, with actions in the VoiceOver rotor", async () => {
    await renderSection(page());
    const row = screen.getByLabelText("@maya, 10 min ago: Line's moving fast");
    expect(row.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual(["View @maya", "Report comment", "Block @maya"]);
    expect(screen.getByLabelText("Reply from Velvet, 5 min ago: Thanks for coming")).toBeTruthy();
  });

  it("doesn't offer Edit once the venue has replied (the API freezes it)", async () => {
    const p = page();
    p.live.comments[2].replies = [{ id: "r2", body: "Thanks", createdAt: now, author: { kind: "user", handle: "velvet_nyc", verified: false, regular: false }, mine: false }];
    await renderSection(p);
    expect(screen.queryByLabelText("More options for @me's comment")).toBeNull();
  });

  it("venue replies can be reported but not blocked", async () => {
    await renderSection(page());
    await fireEvent.press(screen.getByLabelText("More options for Velvet's reply"));
    expect(sheet.mock.calls[0][0].options).toEqual(["Report comment", "Cancel"]);
  });

  it("owners reply instead of posting, with a visible Reply button", async () => {
    await renderSection(page({ ownsVenue: true }));
    expect(screen.queryByLabelText("Comment")).toBeNull();
    expect(screen.getByLabelText("Reply to @maya as Velvet")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("More options for @maya's comment"));
    expect(sheet.mock.calls[0][0].options).toEqual(["Reply as Velvet", "Report comment", "Block @maya", "Cancel"]);
  });
});
