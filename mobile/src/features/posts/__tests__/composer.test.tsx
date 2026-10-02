/** The post composer: camera only (no library), the share default, and what it uploads. */
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import PhotoComposer from "@/app/(app)/venue/photo";
import { uploadFields } from "@/features/photos/upload-store";
import { testQueryClient } from "@/test/query-client";
import { captionMax, defaultShare } from "../composer";

let mockPrivate = true;
const mockStart = jest.fn();

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({ id: "v1", name: "Velvet", uri: "file:///shot.jpg" }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("@/components/ui/offline-banner", () => ({ OfflineBanner: () => null }));
jest.mock("@/api/queries", () => ({
  qk: jest.requireActual("@/api/keys").qk,
  invalidateVenue: jest.fn(),
  useMe: () => ({ data: { user: { handle: "me", isPrivate: mockPrivate } } }),
}));
jest.mock("@/features/location/location-store", () => ({
  locationStore: { currentForPosting: async () => ({ lat: 40.72, lng: -73.98 }), get: () => ({ permission: "granted" }) },
}));
jest.mock("@/features/photos/prepare", () => ({ prepareImage: async (uri: string) => ({ uri, width: 1, height: 1 }) }));
jest.mock("@/features/photos/upload-store", () => ({
  ...jest.requireActual("@/features/photos/upload-store"),
  uploadStore: { start: (...args: unknown[]) => mockStart(...args) },
}));

async function renderComposer() {
  return render(
    <QueryClientProvider client={testQueryClient()}>
      <PhotoComposer />
    </QueryClientProvider>,
  );
}

const flush = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));

describe("post composer", () => {
  beforeEach(() => mockStart.mockClear());

  it("offers the camera only, never the photo library", async () => {
    await renderComposer();
    expect(screen.getByText("Retake")).toBeTruthy();
    expect(screen.queryByText("Library")).toBeNull();
    expect(screen.queryByText(/library/i)).toBeNull();
  });

  it("without a rating it's a live photo with no share toggle", async () => {
    await renderComposer();
    expect(screen.getByText("Post live photo")).toBeTruthy();
    expect(screen.queryByLabelText("Share to venue page")).toBeNull();
    await fireEvent.press(screen.getByText("Post live photo"));
    await flush();
    expect(mockStart.mock.calls[0][0]).toMatchObject({ venueId: "v1", post: null });
  });

  it("share defaults off for a private account and posts the rating", async () => {
    mockPrivate = true;
    await renderComposer();
    await fireEvent.press(screen.getByTestId("rating-8"));
    expect(screen.getByLabelText("Share to venue page").props.value).toBe(false);
    await fireEvent.press(screen.getByText("Post"));
    await flush();
    expect(mockStart.mock.calls[0][0].post).toEqual({ rating: 8, shared: false });
  });

  it("share defaults on for a public account, and the person can turn it off", async () => {
    mockPrivate = false;
    await renderComposer();
    await fireEvent.press(screen.getByTestId("rating-6"));
    const toggle = screen.getByLabelText("Share to venue page");
    expect(toggle.props.value).toBe(true);
    await fireEvent(toggle, "valueChange", false);
    await fireEvent.press(screen.getByText("Post"));
    await flush();
    expect(mockStart.mock.calls[0][0].post).toEqual({ rating: 6, shared: false });
  });

  it("rules: share default, caption limits and multipart fields", () => {
    expect(defaultShare(false)).toBe(true);
    expect(defaultShare(true)).toBe(false);
    expect(captionMax(null)).toBe(140);
    expect(captionMax(7)).toBe(280);
    const coords = { lat: 1, lng: 2 };
    expect(uploadFields({ caption: "hi", coords, post: null })).toEqual([["caption", "hi"], ["lat", "1"], ["lng", "2"]]);
    expect(uploadFields({ caption: "", coords, post: { rating: 10, shared: true } })).toContainEqual(["rating", "10"]);
    expect(uploadFields({ caption: "", coords, post: { rating: 10, shared: true } })).toContainEqual(["shared", "true"]);
  });
});
