import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import type { FeaturedPhotoView, VenuePageResponse } from "@/api/contracts";
import { testQueryClient } from "@/test/query-client";
import { FeaturedSection } from "../featured-section";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock("@/auth/auth-context", () => ({ useAuth: () => ({ status: "signedIn" }) }));

const photo = (id: string, author: FeaturedPhotoView["author"]): FeaturedPhotoView => ({
  id, url: `https://cdn.example.test/${id}.jpg`, caption: "", createdAt: "2026-09-20T03:00:00.000Z", rating: 9, author, mine: false,
  likes: { count: 7, viewerLiked: false }, night: "2026-09-19", rank: 1,
});

async function renderSection(featured: VenuePageResponse["featured"]) {
  const utils = await render(
    <QueryClientProvider client={testQueryClient()}>
      <FeaturedSection venueId="v1" featured={featured} />
    </QueryClientProvider>,
  );
  await fireEvent(screen.getByTestId("featured-body"), "layout", { nativeEvent: { layout: { width: 300 } } });
  return utils;
}

describe("FeaturedSection", () => {
  it("says what the gallery is when nothing is featured yet", async () => {
    await renderSection({ thisMonth: { month: "2026-09", photos: [], total: 0 }, archive: [] });
    expect(screen.getByText(/Nothing featured yet this month/)).toBeTruthy();
  });

  it("shows photos with author per privacy, See all, and the archive newest first", async () => {
    await renderSection({
      thisMonth: { month: "2026-09", photos: [photo("p1", { kind: "anonymous" }), photo("p2", { kind: "user", handle: "sam", verified: true, regular: true })], total: 14 },
      archive: [{ month: "2026-08", count: 10 }, { month: "2026-07", count: 4 }],
    });
    expect(screen.getByLabelText(/Featured photo by Anonymous, Sat, Sep 19, 7 likes/)).toBeTruthy();
    expect(screen.getByLabelText(/Featured photo by @sam, verified, Regular here/)).toBeTruthy();
    expect(screen.getByText("August's best")).toBeTruthy();
    expect(screen.getByText("July's best")).toBeTruthy();
    await fireEvent.press(screen.getByText("See all 14"));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/venue/featured", params: { id: "v1", month: "2026-09" } });
  });
});
