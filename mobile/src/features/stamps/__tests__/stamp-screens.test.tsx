/** The approved stamp flow: Now/Past, optional visit verification, and unrestricted memory photos. */
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ActionSheetIOS } from "react-native";

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
const mockPickFromLibrary = jest.fn();
const mockPrepareImage = jest.fn();
const mockSaveCameraPhoto = jest.fn();
let mockNearby: ReturnType<typeof near>[] = [];
let mockSearchResults: ReturnType<typeof near>[] = [];
let mockSourceIndex = 0;
let mockPermission: "granted" | "denied" | "undetermined" = "granted";
let mockCoords: { lat: number; lng: number } | null = { lat: 40.7, lng: -73.9 };

jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((_options, callback) => callback(mockSourceIndex));

jest.mock("expo-router", () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), back: (...a: unknown[]) => mockBack(...a), replace: (...a: unknown[]) => mockReplace(...a), dismissAll: jest.fn() },
  Stack: { Screen: () => null },
  useFocusEffect: jest.fn(),
  useNavigation: () => ({ addListener: () => () => undefined, dispatch: jest.fn() }),
}));
jest.mock("@/auth/account-state", () => ({ useAccountState: () => ({ state: "ready", retry: jest.fn(), retrying: false }) }));
jest.mock("@/api/queries", () => ({
  qk: jest.requireActual("@/api/keys").qk,
  useNearbyPlaces: () => ({ data: { places: mockNearby }, isPending: false, isError: false, refetch: jest.fn() }),
  usePlaceSearch: () => ({ data: { places: mockSearchResults }, isPending: false, isError: false, isSuccess: true, refetch: jest.fn() }),
  useCollections: () => ({ data: { collections: [] }, isPending: false, isError: false, refetch: jest.fn() }),
}));
jest.mock("@/api", () => {
  const client = jest.requireActual("@/api/client");
  return { api: { upload: (...a: unknown[]) => mockUpload(...a) }, mediaUrl: (u: string) => u, errorText: client.errorText };
});
jest.mock("@/features/location/location-store", () => ({
  locationStore: { currentForPosting: async () => mockCoords },
  usePermissionRefresh: jest.fn(),
  useLocationState: () => ({ permission: mockPermission, simulated: null }),
  useUserCoords: () => mockCoords,
}));
jest.mock("@/features/photos/pick", () => ({
  takePhoto: (...a: unknown[]) => mockTakePhoto(...a),
  pickFromLibrary: (...a: unknown[]) => mockPickFromLibrary(...a),
  CAMERA_NOTE: {
    denied: "Camera access is off. Turn it on in Settings to take a photo for your stamp.",
    "no-camera": "This device doesn't have a camera available.",
    failed: "Couldn't open the camera. Try again.",
  },
}));
jest.mock("@/features/photos/prepare", () => ({ prepareImage: (...a: unknown[]) => mockPrepareImage(...a) }));
jest.mock("@/features/photos/save-camera-photo", () => ({ saveAcceptedCameraPhoto: (...a: unknown[]) => mockSaveCameraPhoto(...a) }));

function near(over: Record<string, unknown> = {}) {
  return {
    id: "p1",
    slug: "p1",
    name: "Katz's",
    address: "205 E Houston St",
    neighborhood: "East Village",
    lat: 40.7222,
    lng: -73.9874,
    geofenceMeters: 100,
    neighborhoodId: "n1",
    fromOsm: false,
    googlePlaceId: "ChIJKatz",
    category: "restaurant" as const,
    cuisines: ["Deli"],
    primaryType: "deli",
    businessStatus: "OPERATIONAL",
    distanceM: 20,
    inside: true,
    ...over,
  };
}
const wrap = async (ui: React.ReactElement) => render(<QueryClientProvider client={testQueryClient()}>{ui}</QueryClientProvider>);
const chooseKatz = async () => {
  await fireEvent.changeText(screen.getByLabelText("Search restaurants and bars"), "Katz");
  await fireEvent.press(screen.getAllByRole("button", { name: /^Katz's,/ })[0]!);
  await screen.findByText(/Make it/);
};
const choosePast = async () => {
  await fireEvent.press(screen.getByRole("button", { name: /PAST/ }));
  await screen.findByLabelText("Visit date");
};
const flatStamp = {
  id: "s1", photoUrl: null, photos: [], caption: "hi", song: null, page: 1, slot: 1,
  createdAt: "2026-10-08T19:41:00.000Z", visitedAt: "2026-10-08T19:41:00.000Z", verifiedAt: "2026-10-08T19:41:00.000Z", verified: true, editedAt: null,
  place: { id: "p1", slug: "p1", name: "Katz's", neighborhood: "East Village", neighborhoodId: "n1" },
};
const pickedLibraryPhoto = { uri: "file://library.jpg", width: 100, height: 100, assetId: "asset-1", fileName: "Screenshot 2026.png", mimeType: "image/png", exif: {} };

describe("the composer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    photoDraft.clear();
    landingDraft.clear();
    mockPermission = "granted";
    mockCoords = { lat: 40.7, lng: -73.9 };
    mockNearby = [near()];
    mockSearchResults = [near()];
    mockUpload.mockResolvedValue({ stamp: flatStamp, progress: null });
  });

  it("starts with Now/Past and Google-backed restaurant/bar search", async () => {
    await wrap(<NewStamp />);
    expect(screen.getByText(/Make a/)).toBeTruthy();
    expect(screen.getByText("NOW")).toBeTruthy();
    expect(screen.getByText("PAST")).toBeTruthy();
    expect(screen.getByText("Choose a place")).toBeTruthy();
    expect(screen.getByLabelText("Search restaurants and bars")).toBeTruthy();
    expect(screen.getByText("Google Maps")).toBeTruthy();
  });

  it("shows cuisine and verification as a positive Now-state but only requires content to stamp", async () => {
    await wrap(<NewStamp />);
    await chooseKatz();
    expect(screen.getByText(/Make it/)).toBeTruthy();
    expect(screen.getByText("KATZ'S · TODAY")).toBeTruthy();
    expect(screen.getByText("Deli")).toBeTruthy();
    expect(screen.getByText("Visit eligible for Nostos verification")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stamp this place" }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText("A few words"), "good pastrami");
    expect(screen.getByRole("button", { name: "Stamp this place" }).props.accessibilityState.disabled).toBe(false);
  });

  it("allows a Now stamp outside the geofence and simply treats it as unverified", async () => {
    mockNearby = [near({ inside: false, distanceM: 1815 })];
    await wrap(<NewStamp />);
    await chooseKatz();
    expect(screen.getByText(/This visit will be unverified/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("A few words"), "still my memory");
    expect(screen.getByRole("button", { name: "Stamp this place" }).props.accessibilityState.disabled).toBe(false);
  });

  it("keeps the app usable without location and sends no coordinates", async () => {
    mockPermission = "denied";
    mockCoords = null;
    mockNearby = [];
    const appended: [string, unknown][] = [];
    const appendSpy = jest.spyOn(FormData.prototype, "append").mockImplementation((k: string, v: unknown) => void appended.push([k, v]));
    await wrap(<NewStamp />);
    expect(screen.getByText(/You can stamp without sharing location/)).toBeTruthy();
    await chooseKatz();
    await fireEvent.changeText(screen.getByLabelText("A few words"), "no location");
    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Stamp this place" })));
    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));
    expect(appended.map(([k]) => k)).toContain("mode");
    expect(appended.map(([k]) => k)).not.toContain("lat");
    expect(appended.map(([k]) => k)).not.toContain("lng");
    appendSpy.mockRestore();
  });

  it("creates Past stamps with a visit date and never sends location", async () => {
    const appended: [string, unknown][] = [];
    const appendSpy = jest.spyOn(FormData.prototype, "append").mockImplementation((k: string, v: unknown) => void appended.push([k, v]));
    await wrap(<NewStamp />);
    await choosePast();
    await fireEvent.changeText(screen.getByLabelText("Visit date"), "09/20/2026");
    await chooseKatz();
    expect(screen.getByText(/KATZ'S · 09\/20\/2026/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("A few words"), "from September");
    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Stamp this place" })));
    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));
    expect(appended).toContainEqual(["mode", "past"]);
    expect(appended.map(([k]) => k)).toContain("visitedAt");
    expect(appended.map(([k]) => k)).not.toContain("lat");
    appendSpy.mockRestore();
  });

  it("rejects future Past dates before upload", async () => {
    await wrap(<NewStamp />);
    await choosePast();
    await fireEvent.changeText(screen.getByLabelText("Visit date"), "12/31/2099");
    await chooseKatz();
    await fireEvent.changeText(screen.getByLabelText("A few words"), "future");
    expect(screen.getByRole("button", { name: "Stamp this place" }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText(/Choose a date from the last year/)).toBeTruthy();
  });

  it("opens the photo manager without venue-authentication parameters", async () => {
    await wrap(<NewStamp />);
    await chooseKatz();
    await fireEvent.press(screen.getByLabelText("Add a photo"));
    expect(mockPush).toHaveBeenCalledWith("/stamp/camera");
  });

  it("sends draft photos, visit fields and memory content, then lands", async () => {
    photoDraft.add("file://a.jpg");
    photoDraft.add("file://b.jpg");
    const appended: [string, unknown][] = [];
    const appendSpy = jest.spyOn(FormData.prototype, "append").mockImplementation((k: string, v: unknown) => void appended.push([k, v]));
    await wrap(<NewStamp />);
    await chooseKatz();
    await fireEvent.press(screen.getByLabelText("Remove photo 1"));
    await act(async () => void photoDraft.add("file://c.jpg"));
    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Stamp this place" })));
    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));
    expect(appended.filter(([k]) => k === "photos")).toHaveLength(2);
    expect(appended).toContainEqual(["mode", "now"]);
    expect(appended.map(([k]) => k)).toContain("lat");
    await waitFor(() => expect(landingDraft.peek()?.stamp.id).toBe("s1"));
    expect(photoDraft.get()).toEqual([]);
    appendSpy.mockRestore();
  });

  it("stops offering another photo action at six photos", async () => {
    for (let i = 0; i < 6; i++) photoDraft.add(`file://${i}.jpg`);
    await wrap(<NewStamp />);
    await chooseKatz();
    expect(screen.getByText("6 / 6")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Add another photo/ })).toBeNull();
  });
});

describe("the photo source flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    photoDraft.clear();
    mockSourceIndex = 0;
    mockTakePhoto.mockResolvedValue({ uri: "file://shot.jpg", width: 10, height: 10, assetId: null, fileName: null, mimeType: "image/jpeg", exif: null });
    mockPickFromLibrary.mockResolvedValue(pickedLibraryPhoto);
    mockPrepareImage.mockImplementation(async (uri: string) => ({ uri: `prepared:${uri}`, width: 10, height: 10 }));
    mockSaveCameraPhoto.mockResolvedValue("saved");
  });

  it("watermarks a native-camera photo and adds it to the draft", async () => {
    await wrap(<StampCamera />);
    await fireEvent.press(screen.getByRole("button", { name: "Add a photo" }));
    await waitFor(() => expect(mockTakePhoto).toHaveBeenCalledTimes(1));
    expect(mockPrepareImage).toHaveBeenCalledWith("file://shot.jpg", { watermark: true });
    await waitFor(() => expect(photoDraft.get()).toEqual(["prepared:file://shot.jpg"]));
    expect(mockSaveCameraPhoto).toHaveBeenCalledWith("prepared:file://shot.jpg");
  });

  it("accepts a Photo Library image without EXIF/source/time/location validation", async () => {
    mockSourceIndex = 1;
    await wrap(<StampCamera />);
    await fireEvent.press(screen.getByRole("button", { name: "Add a photo" }));
    await waitFor(() => expect(mockPickFromLibrary).toHaveBeenCalledTimes(1));
    expect(mockPrepareImage).toHaveBeenCalledWith("file://library.jpg");
    await waitFor(() => expect(photoDraft.get()).toEqual(["prepared:file://library.jpg"]));
  });

  it("leaves the photo screen unchanged when the chooser or camera is cancelled", async () => {
    mockSourceIndex = 2;
    await wrap(<StampCamera />);
    await fireEvent.press(screen.getByRole("button", { name: "Add a photo" }));
    expect(photoDraft.get()).toEqual([]);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("lets you add up to six photos", async () => {
    await wrap(<StampCamera />);
    for (let i = 0; i < 6; i++) {
      await act(async () => void fireEvent.press(screen.getByRole("button", { name: i === 0 ? "Add a photo" : "Add another photo" })));
      await waitFor(() => expect(photoDraft.get()).toHaveLength(i + 1));
    }
    expect(screen.getByText("6 of 6")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add another photo" })).toBeNull();
  });

  it("keeps existing photos when the native camera fails", async () => {
    photoDraft.add("file://x.jpg");
    mockTakePhoto.mockResolvedValue("failed");
    await wrap(<StampCamera />);
    await fireEvent.press(screen.getByRole("button", { name: "Add another photo" }));
    await waitFor(() => expect(screen.getByText("Couldn't open the camera. Try again.")).toBeTruthy());
    expect(photoDraft.get()).toEqual(["file://x.jpg"]);
  });
});
