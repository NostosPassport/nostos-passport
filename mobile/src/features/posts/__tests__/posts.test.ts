import type { FeaturedMonthResponse, PhotoView, PostView } from "@/api/contracts";
import { qk } from "@/api/keys";
import { testQueryClient } from "@/test/query-client";
import { postChanges, ratingEditable } from "../post-edit";
import { setLikes, toggledLikes } from "../use-like";

jest.mock("@/api", () => ({ api: {}, errorText: () => "" }));
jest.mock("@/auth/auth-context", () => ({ useAuth: () => ({ status: "signedIn" }) }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

const photo = (id: string, likes: PhotoView["likes"]): PhotoView => ({
  id, url: "u", caption: "", createdAt: "2026-09-24T02:00:00.000Z", rating: likes ? 8 : null, author: { kind: "anonymous" }, mine: false, likes,
});

describe("likes", () => {
  it("toggles optimistically and never goes below zero", () => {
    expect(toggledLikes({ count: 3, viewerLiked: false })).toEqual({ count: 4, viewerLiked: true });
    expect(toggledLikes({ count: 0, viewerLiked: true })).toEqual({ count: 0, viewerLiked: false });
  });

  it("updates one post everywhere it's cached, and leaves live-only photos alone", () => {
    const client = testQueryClient();
    const post = { post: { id: "p1", likes: { count: 1, viewerLiked: false } } as PostView };
    client.setQueryData(qk.post("p1"), post);
    client.setQueryData(qk.venue("velvet"), {
      live: { livePhotos: [photo("p1", { count: 1, viewerLiked: false }), photo("x", null)], earlierPhotos: [] },
      featured: { thisMonth: { month: "2026-09", photos: [{ ...photo("p1", { count: 1, viewerLiked: false }), night: "2026-09-20", rank: 1 }], total: 1 }, archive: [] },
    });
    const month: FeaturedMonthResponse = { month: "2026-08", nights: [{ night: "2026-08-02", photos: [{ ...photo("p1", { count: 1, viewerLiked: false }), likes: { count: 1, viewerLiked: false }, night: "2026-08-02", rank: 2 }] }] };
    client.setQueryData(qk.featuredMonth("v1", "2026-08"), month);

    setLikes(client, "p1", { count: 2, viewerLiked: true });

    const liked = { count: 2, viewerLiked: true };
    expect(client.getQueryData<typeof post>(qk.post("p1"))?.post.likes).toEqual(liked);
    const page = client.getQueryData<{ live: { livePhotos: PhotoView[] }; featured: { thisMonth: { photos: PhotoView[] } } }>(qk.venue("velvet"));
    expect(page?.live.livePhotos[0].likes).toEqual(liked);
    expect(page?.live.livePhotos[1].likes).toBeNull();
    expect(page?.featured.thisMonth.photos[0].likes).toEqual(liked);
    expect(client.getQueryData<FeaturedMonthResponse>(qk.featuredMonth("v1", "2026-08"))?.nights[0].photos[0].likes).toEqual(liked);
  });
});

describe("post edits", () => {
  const initial = { rating: 7, caption: "Good night", shared: true };

  it("sends only what changed, with the caption trimmed", () => {
    expect(postChanges(initial, { ...initial, caption: " Good night " }, true)).toEqual({});
    expect(postChanges(initial, { rating: 9, caption: "Great night", shared: false }, true)).toEqual({ rating: 9, caption: "Great night", shared: false });
  });

  it("never sends a rating once it's locked", () => {
    expect(postChanges(initial, { ...initial, rating: 2 }, false)).toEqual({});
  });

  it("lets you change the rating only on your own post, before the end of its night", () => {
    const now = new Date("2026-09-24T06:00:00.000Z");
    expect(ratingEditable({ mine: true, ratingEditableUntil: "2026-09-24T09:00:00.000Z" }, now)).toBe(true);
    expect(ratingEditable({ mine: true, ratingEditableUntil: "2026-09-24T05:00:00.000Z" }, now)).toBe(false);
    expect(ratingEditable({ mine: false, ratingEditableUntil: null }, now)).toBe(false);
  });
});
