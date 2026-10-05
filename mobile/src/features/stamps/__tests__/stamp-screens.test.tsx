/** The stamp flow's screens: the journal composer, nearby place selection, photos, stamping and the in-app camera. */
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
let mockPlaces: unknown[] = [];
let mockPerm = { granted: true, canAskAgain: true };
const mockTake = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn(), replace: (...a: unknown[]) => mockReplace(...a), dismissAll: jest.fn() },
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
jest.mock("@/features/photos/prepare", () => ({ prepareImage: async (uri: string) => ({ uri: `prepared:${uri}`, width: 10, height: 10 }) }));
jest.mock("expo-camera", () => {
  const { forwardRef, useEffect, useImperativeHandle } = jest.requireActual("react");
  const CameraView = forwardRef(function Cam(props: { onCameraReady?: () => void }, ref: unknown) {
    useImperativeHandle(ref, () => ({ takePictureAsync: mockTake }));
    useEffect(() => props.onCameraReady?.(), []); // eslint-disable-line react-hooks/exhaustive-deps
    return null;
  });
  return { CameraView, useCameraPermissions: () => [mockPerm, jest.fn()] };
});

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

describe("the in-app camera", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    photoDraft.clear();
    mockPerm = { granted: true, canAskAgain: true };
    mockTake.mockResolvedValue({ uri: "file://shot.jpg", width: 10, height: 10 });
  });

  it("takes a photo into the stamp, counts them, and stops at six", async () => {
    await wrap(<StampCamera />);
    expect(screen.getByText("0 of 6")).toBeTruthy();
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        await fireEvent.press(screen.getByRole("button", { name: /Take photo|Six photos taken/ }));
      });
      await waitFor(() => expect(photoDraft.get()).toHaveLength(i + 1));
    }
    expect(screen.getByText("6 of 6")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Six photos taken" }).props.accessibilityState.disabled).toBe(true);
    expect(mockTake).toHaveBeenCalledTimes(6);
    expect(photoDraft.get()[0]).toBe("prepared:file://shot.jpg");
  });
  it("asks the camera not to record where it was", async () => {
    await wrap(<StampCamera />);
    await act(async () => {
      await fireEvent.press(screen.getByRole("button", { name: "Take photo" }));
    });
    await waitFor(() => expect(mockTake).toHaveBeenCalled());
    expect(mockTake.mock.calls[0]![0]).toMatchObject({ exif: false });
  });
  it("lets you remove a photo from the strip", async () => {
    photoDraft.add("file://x.jpg");
    await wrap(<StampCamera />);
    await fireEvent.press(screen.getByLabelText("Remove photo 1"));
    expect(photoDraft.get()).toEqual([]);
  });
  it("says why it needs the camera, calmly, when access is off, and offers Settings when it can't ask again", async () => {
    mockPerm = { granted: false, canAskAgain: false };
    await wrap(<StampCamera />);
    expect(screen.getByText(/inside the app, so they show where you really are/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Settings" })).toBeTruthy();
  });
  it("tells you when a shot fails and keeps what you have", async () => {
    mockTake.mockRejectedValue(new Error("camera busy"));
    await wrap(<StampCamera />);
    await act(async () => {
      await fireEvent.press(screen.getByRole("button", { name: "Take photo" }));
    });
    await waitFor(() => expect(screen.getByText("Couldn't take that photo. Try again.")).toBeTruthy());
    expect(photoDraft.get()).toEqual([]);
  });
});
