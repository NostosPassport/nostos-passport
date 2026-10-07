/** The stamp flow's screens: the journal composer, nearby place selection, photos, stamping and the native camera handoff. */
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import NewStamp from "@/app/(app)/stamp/new";
import StampCamera from "@/app/(app)/stamp/camera";
import { testQueryClient } from "@/test/query-client";
import { landingDraft } from "../landing-draft";
import { photoDraft } from "../photo-draft";

const mockUpload = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockTakePhoto = jest.fn();
let mockPlaces: unknown[] = [];

jest.mock("expo-router", () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), back: (...a: unknown[]) => mockBack(...a), replace: (...a: unknown[]) => mockReplace(...a), dismissAll: jest.fn() },
  Stack: { Screen: () => null },
  useFocusEffect: jest.fn(),
  useNavigation: () => ({ addListener: () => () => undefined, dispatch: jest.fn() }),
}));
jest.mock("@/auth/account-state", () => ({ useAccountState: () => ({ state: "ready", retry: jest.fn(), retrying: false }) }));
jest.mock("@/api/queries", () => ({
  qk: jest.requireActual("@/api/keys").qk,
  useNearbyPlaces: () => ({ data: { places: mockPlaces }, isPending: false, isError: false }),
  usePlaces: () => ({ data: { places: [] } }),
}));
jest.mock("@/api", () => {
  const client = jest.requireActual("@/api/client");
  return { api: { upload: (...a: unknown[]) => mockUpload(...a) }, mediaUrl: (u: string) => u, errorText: client.errorText };
});
jest.mock("@/features/location/location-store", () => ({
  locationStore: { currentForPosting: async () => ({ lat: 40.7, lng: -73.9 }) },
  usePermissionRefresh: jest.fn(),
  useLocationState: () => ({ permission: "granted", simulated: null }),
  useUserCoords: () => ({ lat: 40.7, lng: -73.9 }),
}));
jest.mock("@/features/photos/pick", () => ({
  takePhoto: (...a: unknown[]) => mockTakePhoto(...a),
  CAMERA_NOTE: {
    denied: "Camera access is off. Turn it on in Settings to take a photo for your stamp.",
    "no-camera": "This device doesn't have a camera available.",
    failed: "Couldn't open the camera. Try again.",
  },
}));
jest.mock("@/features/photos/prepare", () => ({ prepareImage: async (uri: string) => ({ uri: `prepared:${uri}`, width: 10, height: 10 }) }));

const near = (over: Record<string, unknown>) => ({ id: "p1", slug: "p1", name: "Katz's", address: "", neighborhood: "East Village", lat: 1, lng: 2, geofenceMeters: 100, neighborhoodId: "n1", fromOsm: false, distanceM: 20, inside: true, ...over });
const wrap = async (ui: React.ReactElement) => render(<QueryClientProvider client={testQueryClient()}>{ui}</QueryClientProvider>);
const flatStamp = { id: "s1", photoUrl: null, photos: [], caption: "hi", song: null, page: 1, slot: 1, createdAt: "2026-10-04T03:41:00.000Z", editedAt: null, place: { id: "p1", slug: "p1", name: "Katz's", neighborhood: "East Village", neighborhoodId: "n1" }, author: { handle: "ava", displayName: "Ava", avatarUrl: null, verified: false }, mine: true, likes: { count: 0, viewerLiked: false }, hidden: false, removed: false };

describe("the composer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    photoDraft.clear();
    landingDraft.clear();
    mockPlaces = [near({})];
  });

  it("opens the approved journal composer when exactly one place contains you", async () => {
    await wrap(<NewStamp />);
    expect(screen.getByText(/Make it/)).toBeTruthy();
    expect(screen.getByText("KATZ'S · YOU'RE HERE")).toBeTruthy();
    expect(screen.getByText("Add a photo, a caption or a song.")).toBeTruthy();
    expect(screen.getByText("Location confirmed · East Village, New York")).toBeTruthy();
  });

  it("splits an ambiguous location into Here and Nearby, with distances in km from 1000 m up", async () => {
    mockPlaces = [
      near({ id: "p1" }),
      near({ id: "p2", slug: "p2", name: "Other Here", distanceM: 40, inside: true }),
      near({ id: "p3", slug: "p3", name: "Far Bar", inside: false, distanceM: 1815 }),
    ];
    await wrap(<NewStamp />);
    expect(screen.getByText("HERE")).toBeTruthy();
    expect(screen.getByText("NEARBY")).toBeTruthy();
    expect(screen.getByText("East Village · 1.8 km away, need to be within 100 m")).toBeTruthy();
  });

  it("auto-picks the one place you're inside, and the stamp action waits for content", async () => {
    await wrap(<NewStamp />);
    expect(screen.getByRole("button", { name: "Stamp this place" }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText("Add a photo, a caption or a song.")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("A few words"), "good pastrami");
    expect(screen.getByRole("button", { name: "Stamp this place" }).props.accessibilityState.disabled).toBe(false);
  });

  it("outside the geofence shows the calm state and keeps stamping disabled", async () => {
    mockPlaces = [near({ inside: false, distanceM: 1815 })];
    await wrap(<NewStamp />);
    await fireEvent.press(screen.getByRole("button", { name: /Katz's, 1\.8 km away/ }));
    await fireEvent.changeText(screen.getByLabelText("A few words"), "almost there");
    expect(screen.getByText(/Not quite there yet\. You're 1\.8 km from Katz's/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stamp this place" }).props.accessibilityState.disabled).toBe(true);
  });

  it("shows the photo count, removes the first photo, sends every remaining photo, then lands", async () => {
    photoDraft.add("file://a.jpg");
    photoDraft.add("file://b.jpg");
    mockUpload.mockResolvedValue({ stamp: flatStamp, progress: null });
    const appended: [string, unknown][] = [];
    jest.spyOn(FormData.prototype, "append").mockImplementation((k: string, v: unknown) => void appended.push([k, v]));
    await wrap(<NewStamp />);
    expect(screen.getByLabelText("First stamp photo")).toBeTruthy();
    expect(screen.getByText("2 / 6")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Take another photo/ })).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Remove first photo"));
    expect(screen.getByText("1 / 6")).toBeTruthy();
    await act(async () => void photoDraft.add("file://c.jpg"));
    await act(async () => {
      await fireEvent.press(screen.getByRole("button", { name: "Stamp this place" }));
    });
    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));
    const sent = appended.filter(([k]) => k === "photos");
    expect(sent).toHaveLength(2);
    expect((sent[0]![1] as { uri: string }).uri).toBe("file://b.jpg");
    expect((sent[1]![1] as { uri: string }).uri).toBe("file://c.jpg");
    await waitFor(() => expect(landingDraft.peek()?.stamp.id).toBe("s1"));
    expect(photoDraft.get()).toEqual([]);
    expect(appended.map(([k]) => k)).toContain("lat");
    jest.restoreAllMocks();
  });

  it("shows the server's own sentence when it refuses, with Try again", async () => {
    mockUpload.mockRejectedValue(Object.assign(new Error("x"), { status: 403, code: "outside_geofence", message: "You need to be within 100 m of this place to stamp it (you're 140 m away)" }));
    await wrap(<NewStamp />);
    await fireEvent.changeText(screen.getByLabelText("A few words"), "hi");
    await act(async () => {
      await fireEvent.press(screen.getByRole("button", { name: "Stamp this place" }));
    });
    await waitFor(() => expect(screen.getByText("Try again")).toBeTruthy());
  });

  it("stops offering another camera action at six photos", async () => {
    for (let i = 0; i < 6; i++) photoDraft.add(`file://${i}.jpg`);
    await wrap(<NewStamp />);
    expect(screen.getByText("6 / 6")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Take another photo/ })).toBeNull();
  });

  it("has no way to pick a photo from the library", async () => {
    await wrap(<NewStamp />);
    expect(screen.queryByText(/Choose photo|library/i)).toBeNull();
  });
});

describe("the native camera handoff", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    photoDraft.clear();
    mockTakePhoto.mockResolvedValue({ uri: "file://shot.jpg", width: 10, height: 10 });
  });

  it("opens the system camera immediately and adds the confirmed photo", async () => {
    await wrap(<StampCamera />);
    await waitFor(() => expect(mockTakePhoto).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(photoDraft.get()).toEqual(["prepared:file://shot.jpg"]));
    expect(screen.getByText("1 of 6")).toBeTruthy();
    expect(screen.getByLabelText("Photo 1")).toBeTruthy();
  });

  it("lets you take more photos and stops offering another at six", async () => {
    await wrap(<StampCamera />);
    await waitFor(() => expect(photoDraft.get()).toHaveLength(1));
    for (let i = 1; i < 6; i++) {
      await act(async () => {
        await fireEvent.press(screen.getByRole("button", { name: "Take another photo" }));
      });
      await waitFor(() => expect(photoDraft.get()).toHaveLength(i + 1));
    }
    expect(screen.getByText("6 of 6")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Take another photo" })).toBeNull();
    expect(mockTakePhoto).toHaveBeenCalledTimes(6);
  });

  it("returns to the composer unchanged when the first camera is cancelled", async () => {
    mockTakePhoto.mockResolvedValue("cancelled");
    await wrap(<StampCamera />);
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(photoDraft.get()).toEqual([]);
  });

  it("keeps existing photos when adding another is cancelled", async () => {
    photoDraft.add("file://x.jpg");
    mockTakePhoto.mockResolvedValue("cancelled");
    await wrap(<StampCamera />);
    await waitFor(() => expect(mockTakePhoto).toHaveBeenCalledTimes(1));
    expect(mockBack).not.toHaveBeenCalled();
    expect(photoDraft.get()).toEqual(["file://x.jpg"]);
    expect(screen.getByLabelText("Photo 1")).toBeTruthy();
  });

  it("lets you remove a photo from the list", async () => {
    photoDraft.add("file://x.jpg");
    mockTakePhoto.mockResolvedValue("cancelled");
    await wrap(<StampCamera />);
    await waitFor(() => expect(mockTakePhoto).toHaveBeenCalledTimes(1));
    await fireEvent.press(screen.getByLabelText("Remove photo 1"));
    expect(photoDraft.get()).toEqual([]);
  });

  it("shows a calm retryable note if the system camera fails and keeps existing photos", async () => {
    photoDraft.add("file://x.jpg");
    mockTakePhoto.mockResolvedValue("failed");
    await wrap(<StampCamera />);
    await waitFor(() => expect(screen.getByText("Couldn't open the camera. Try again.")).toBeTruthy());
    expect(photoDraft.get()).toEqual(["file://x.jpg"]);
    expect(screen.getByRole("button", { name: "Take another photo" })).toBeTruthy();
  });
});
