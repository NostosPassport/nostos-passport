/** The profile screen, the author label and the follow button: what each viewer may see. */
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";

import type { AuthorView, ProfileResponse } from "@/api/contracts";
import { testQueryClient } from "@/test/query-client";
import { authorHandle, authorLabel } from "../author";
import { authorSpoken } from "../author-line";
import { privacyNote, profileChanges, profileProblem, shouldOfferApproveAll } from "../edit-profile";
import { confirmApproveAll } from "../use-requests";
import { placesRegion } from "../places";
import { ProfileScreen } from "../profile-screen";
import { followButton } from "../use-follow";

let mockProfile: ProfileResponse;
const mockPosts = { data: { pages: [{ posts: [], nextBefore: null }] }, isPending: false, hasNextPage: false, isFetchNextPageError: false, refetch: jest.fn() };

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() }, Stack: { Screen: () => null } }));
jest.mock("react-native-maps", () => ({ __esModule: true, default: () => null, Marker: () => null }));
jest.mock("@/auth/auth-context", () => ({ useAuth: () => ({ status: "signedIn" }) }));
jest.mock("@/api/queries", () => ({
  qk: jest.requireActual("@/api/keys").qk,
  useUserProfile: () => ({ data: mockProfile, isError: false }),
  useUserPosts: () => mockPosts,
  useUserPlaces: () => ({ data: { places: [] }, isPending: false }),
  useMe: () => ({ data: { social: { pendingFollowRequests: 3 } } }),
}));
jest.mock("@/api", () => {
  const client = jest.requireActual("@/api/client");
  return { api: {}, mediaUrl: (u: string) => u, ApiError: client.ApiError, errorText: client.errorText };
});

const relationship: ProfileResponse["relationship"] = { isSelf: false, follow: "none", followsYou: false, mutual: false };

function full(over: Partial<Extract<ProfileResponse, { access: "full" }>["user"]> = {}, rel = relationship): ProfileResponse {
  return {
    access: "full",
    user: {
      handle: "sam", displayName: "Sam Lee", avatarUrl: null, bio: "Mostly Lantern & Lark.", verified: true, isPrivate: false, isVenueAccount: false,
      memberSince: "2026-01-01T00:00:00.000Z", reputation: null, counts: { posts: 12, followers: 40, following: 9 }, venues: [], ...over,
    },
    relationship: rel,
    goingTonight: null,
    regularAt: [{ name: "Lantern & Lark", slug: "lantern-lark" }],
    featured: [{ venue: { name: "Lantern & Lark", slug: "lantern-lark" }, month: "2026-08", count: 2 }],
  };
}

async function renderProfile(own = false) {
  return render(
    <QueryClientProvider client={testQueryClient()}>
      <ProfileScreen handle="sam" own={own} />
    </QueryClientProvider>,
  );
}

describe("ProfileScreen", () => {
  it("limited: handle, badge and 'This account is private', and nothing else", async () => {
    mockProfile = { access: "limited", user: { handle: "sam", verified: true, isPrivate: true }, relationship };
    await renderProfile();
    expect(screen.getByText("This account is private")).toBeTruthy();
    expect(screen.getByLabelText("@sam, verified")).toBeTruthy();
    expect(screen.getByLabelText("Follow @sam")).toBeTruthy();
    expect(screen.queryByText("Posts")).toBeNull();
    expect(screen.queryByText(/Regular at/)).toBeNull();
    expect(screen.queryByText(/Featured at/)).toBeNull();
  });

  it("limited with a pending request shows Requested", async () => {
    mockProfile = { access: "limited", user: { handle: "sam", verified: false, isPrivate: true }, relationship: { ...relationship, follow: "requested" } };
    await renderProfile();
    expect(screen.getByLabelText("Cancel follow request to @sam")).toBeTruthy();
    expect(screen.getByText("Your request is waiting for their approval.")).toBeTruthy();
  });

  it("full: name, bio, counts, Regular badges, Featured entries and the tabs", async () => {
    mockProfile = full({}, { ...relationship, follow: "following" });
    await renderProfile();
    expect(screen.getByLabelText("Sam Lee, @sam, verified")).toBeTruthy();
    expect(screen.getByText("Mostly Lantern & Lark.")).toBeTruthy();
    expect(screen.getByLabelText("40 followers")).toBeTruthy();
    expect(screen.getByLabelText("Regular at Lantern & Lark")).toBeTruthy();
    expect(screen.getByText(/Featured at Lantern & Lark, August/)).toBeTruthy();
    expect(screen.getByLabelText("Unfollow @sam")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Posts" })).toBeTruthy();
  });

  it("your own: Edit profile and requests with the waiting count, no Follow button", async () => {
    mockProfile = full({ isPrivate: true }, { ...relationship, isSelf: true });
    await renderProfile(true);
    expect(screen.getByText("Edit profile")).toBeTruthy();
    expect(screen.getByLabelText("Follow requests, 3 waiting")).toBeTruthy();
    expect(screen.getByText("Private account")).toBeTruthy();
    expect(screen.queryByLabelText("Follow @sam")).toBeNull();
  });
});

describe("author label", () => {
  const user: AuthorView = { kind: "user", handle: "sam", verified: true, regular: true };
  it("shows a handle, Anonymous or Deleted user, and only a handle links", () => {
    expect(authorLabel(user)).toBe("@sam");
    expect(authorHandle(user)).toBe("sam");
    expect(authorLabel({ kind: "anonymous" })).toBe("Anonymous");
    expect(authorHandle({ kind: "anonymous" })).toBeNull();
    expect(authorLabel({ kind: "deleted" })).toBe("Deleted user");
  });
  it("speaks badges only for handles", () => {
    expect(authorSpoken(user)).toBe("@sam, verified, Regular here");
    expect(authorSpoken({ kind: "anonymous" })).toBe("Anonymous");
  });
});

describe("follow button", () => {
  it("has Follow, Requested and Following states", () => {
    expect(followButton("none", "sam")).toMatchObject({ title: "Follow", variant: "primary", label: "Follow @sam" });
    expect(followButton("requested", "sam")).toMatchObject({ title: "Requested", variant: "secondary", label: "Cancel follow request to @sam" });
    expect(followButton("following", "sam")).toMatchObject({ title: "Following", variant: "secondary", label: "Unfollow @sam" });
  });
});

describe("edit profile", () => {
  const initial = { displayName: "Sam", bio: "", isPrivate: true };
  it("sends only changed fields", () => {
    expect(profileChanges(initial, { ...initial, displayName: " Sam " })).toEqual({});
    expect(profileChanges(initial, { displayName: "Sam Lee", bio: "Hi", isPrivate: false })).toEqual({ displayName: "Sam Lee", bio: "Hi", isPrivate: false });
  });
  it("offers approve-all only after going public with requests waiting", () => {
    expect(shouldOfferApproveAll({ isPrivate: false }, 4)).toBe(true);
    expect(shouldOfferApproveAll({ isPrivate: false }, 0)).toBe(false);
    expect(shouldOfferApproveAll({ bio: "x" }, 4)).toBe(false);
  });
  it("explains the toggle, including handles on past venue photos when public", () => {
    expect(privacyNote(false)).toMatch(/past venue photos/);
    expect(privacyNote(true)).toMatch(/Anonymous/);
    expect(profileProblem({ ...initial, displayName: " " })).toBe("Add a display name.");
    expect(profileProblem({ ...initial, bio: "x".repeat(151) })).toMatch(/150/);
  });
});

describe("places map", () => {
  it("frames every place, with a minimum span", () => {
    const at = (lat: number, lng: number) => ({ venue: { name: "", slug: `${lat}`, lat, lng, neighborhood: "" }, posts: 1, lastRating: 7, lastPostedAt: "2026-09-01T00:00:00.000Z" });
    expect(placesRegion([])).toBeNull();
    expect(placesRegion([at(40.72, -73.98)])).toMatchObject({ latitude: 40.72, longitude: -73.98, latitudeDelta: 0.01 });
    const r = placesRegion([at(40.7, -74), at(40.8, -73.9)])!;
    expect(r.latitude).toBeCloseTo(40.75);
    expect(r.latitudeDelta).toBeCloseTo(0.14);
  });
});

describe("approve-all prompt", () => {
  it("asks with the count, and closes Edit profile whichever button is pressed", () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    const approve = jest.fn();
    const done = jest.fn();
    confirmApproveAll(4, approve, done);
    const [title, , buttons] = alert.mock.calls[0];
    expect(title).toBe("Approve 4 pending requests?");
    buttons?.find((b) => b.text === "Not now")?.onPress?.();
    expect(approve).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledTimes(1);
    buttons?.find((b) => b.text === "Approve")?.onPress?.();
    expect(approve).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledTimes(2);
    alert.mockRestore();
  });
});
