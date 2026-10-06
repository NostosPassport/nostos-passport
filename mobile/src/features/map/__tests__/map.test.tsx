import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { State } from "react-native-gesture-handler";

import type { Place, UserPlacesResponse } from "@/api/contracts";
import { formatDistance } from "@/lib/format";
import { MapScreen } from "../MapScreen";
import { PinMarker } from "../PinMarker";
import { PlaceSheet } from "../PlaceSheet";
import { pinKind, sheetModel, sheetShouldClose, statsByPlace, visiblePlaces, type MapRegion } from "../map-model";

const mockPush = jest.fn();
let mockPlaces: Place[] = [];
let mockMine: UserPlacesResponse["places"] = [];
let mockHere: { lat: number; lng: number } | null = null;
let mockAttribution: { text: string } | null = null;

jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock("react-native-maps", () => {
  const React = jest.requireActual("react");
  const { View: V, Pressable: P } = jest.requireActual("react-native");
  const MapView = React.forwardRef(function MockMapView(
    { children, onPress, showsUserLocation, ...rest }: { children?: ReactNode; onPress?: () => void; showsUserLocation?: boolean },
    ref: unknown,
  ) {
    React.useImperativeHandle(ref, () => ({ animateToRegion: jest.fn() }));
    return (
      <V {...rest} testID="map">
        {children}
        {showsUserLocation ? <V accessibilityLabel="You are here" /> : null}
        <P testID="map-background" onPress={onPress} />
      </V>
    );
  });
  const Marker = ({ children, onPress, accessibilityLabel }: { children?: ReactNode; onPress?: () => void; accessibilityLabel?: string }) => (
    <P onPress={onPress} accessibilityLabel={accessibilityLabel} accessibilityRole="button">{children}</P>
  );
  return { __esModule: true, default: MapView, Marker };
});
jest.mock("@/api/queries", () => ({
  useMe: () => ({ data: { user: { handle: "ava" } } }),
  usePlaces: () => ({ data: { places: mockPlaces, attribution: mockAttribution } }),
  useUserPlaces: () => ({ data: { places: mockMine } }),
}));
jest.mock("@/features/location/location-store", () => ({ useUserCoords: () => mockHere }));

const place = (id: string, over: Partial<Place> = {}): Place => ({ id, slug: id, name: `Place ${id}`, address: "", neighborhood: "East Village", lat: 40.7222, lng: -73.9855, geofenceMeters: 100, neighborhoodId: "n1", fromOsm: false, ...over });
const mineRow = (p: Place, stamps = 1): UserPlacesResponse["places"][number] => ({
  place: { id: p.id, slug: p.slug, name: p.name, neighborhood: p.neighborhood, lat: p.lat, lng: p.lng }, stamps, latestStamp: { id: "s", createdAt: "2026-10-04T03:41:00.000Z", photoUrl: null, caption: "" },
});
const region: MapRegion = { latitude: 40.7222, longitude: -73.9855, latitudeDelta: 0.02, longitudeDelta: 0.02 };

describe("map model", () => {
  it("lights the places you have stamped and dims the rest", () => {
    const stats = statsByPlace([mineRow(place("a"), 3)]);
    expect(pinKind("a", stats)).toBe("lit");
    expect(pinKind("b", stats)).toBe("dim");
    expect(stats.get("a")).toEqual({ stamps: 3, latestAt: "2026-10-04T03:41:00.000Z" });
  });
  it("draws only places in view, lit ones first, the selected one always, and never more than the cap", () => {
    const near = Array.from({ length: 10 }, (_, i) => place(`n${i}`, { lat: 40.7222 + i * 0.0003 }));
    const far = place("far", { lat: 41.5 });
    const stats = statsByPlace([mineRow(near[9]!)]);
    const out = visiblePlaces([...near, far], region, stats, null);
    expect(out.map((p) => p.id)).not.toContain("far");
    expect(out[0]!.id).toBe("n9");
    expect(visiblePlaces([...near, far], region, stats, "far")[0]!.id).toBe("far");
    expect(visiblePlaces(near, region, stats, null, 4)).toHaveLength(4);
    expect(visiblePlaces([], region, stats, null)).toEqual([]);
  });
  it("describes the sheet in words: stamped or not, how far, and whether you are inside the geofence", () => {
    const p = place("a", { name: "Katz's", address: "205 E Houston St", geofenceMeters: 100 });
    const inside = sheetModel(p, { stamps: 1, latestAt: "2026-10-04T03:41:00.000Z" }, { lat: p.lat, lng: p.lng }, formatDistance);
    expect(inside).toMatchObject({ title: "Katz's", subtitle: "East Village · 205 E Houston St", status: "Stamped once. Last on 03 OCT 2026.", canStamp: true });
    const far = sheetModel(p, undefined, { lat: p.lat + 0.02, lng: p.lng }, formatDistance);
    expect(far.status).toBe("Not stamped yet.");
    expect(far.canStamp).toBe(false);
    expect(far.distance).toMatch(/^2\.2 km away$/);
    expect(sheetModel(p, { stamps: 4, latestAt: "2026-10-04T03:41:00.000Z" }, null, formatDistance)).toMatchObject({ distance: null, canStamp: false, status: "Stamped 4 times. Last on 03 OCT 2026." });
  });
  it("closes the sheet when it is dragged far enough down or flicked", () => {
    expect(sheetShouldClose(100, 0, 220)).toBe(true);
    expect(sheetShouldClose(40, 0, 220)).toBe(false);
    expect(sheetShouldClose(10, 1200, 220)).toBe(true);
    expect(sheetShouldClose(-50, -900, 220)).toBe(false);
  });
});

describe("pins and sheet", () => {
  it("draws a lit pin as a stamp in a ring and a dim pin as a dot, without crashing", async () => {
    const input = { placeId: "a", placeName: "A", neighborhoodId: null, neighborhoodName: "" };
    await render(<View><PinMarker kind="lit" selected={false} input={input} /><PinMarker kind="lit" selected input={input} /><PinMarker kind="dim" selected={false} input={input} /><PinMarker kind="dim" selected input={input} /></View>);
  });
  it("shows nothing without a place, and the place's words with one; Stamp here only when you can", async () => {
    const onStamp = jest.fn();
    const onClose = jest.fn();
    const base = { title: "Katz's", subtitle: "East Village", status: "Not stamped yet.", distance: "30 m away", canStamp: false };
    const none = await render(<PlaceSheet model={null} onClose={onClose} onStamp={onStamp} />);
    expect(none.toJSON()).toBeNull();
    await none.unmount();
    const a = await render(<PlaceSheet model={base} onClose={onClose} onStamp={onStamp} />);
    expect(screen.getByText("Katz's")).toBeTruthy();
    expect(screen.getByText("Not stamped yet.")).toBeTruthy();
    expect(screen.queryByText("Stamp here")).toBeNull();
    await a.unmount();
    await render(<PlaceSheet model={{ ...base, canStamp: true }} onClose={onClose} onStamp={onStamp} />);
    await fireEvent.press(screen.getByRole("button", { name: "Stamp here" }));
    expect(onStamp).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("closes when swiped down", async () => {
    const onClose = jest.fn();
    await render(<PlaceSheet model={{ title: "A", subtitle: "", status: "Not stamped yet.", distance: null, canStamp: false }} onClose={onClose} onStamp={jest.fn()} />);
    await fireGestureHandler(getByGestureTestId("sheet-pan"), [
      { state: State.BEGAN, translationY: 0, velocityY: 0 },
      { state: State.ACTIVE, translationY: 120, velocityY: 200 },
      { state: State.END, translationY: 120, velocityY: 200 },
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("MapScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlaces = [place("a", { name: "Katz's" }), place("b", { name: "Cafe", lat: 40.7226 })];
    mockMine = [mineRow(mockPlaces[0]!, 2)];
    mockHere = { lat: 40.7222, lng: -73.9855 };
    mockAttribution = null;
  });

  it("labels lit and dim pins in words, and marks where you are", async () => {
    await render(<MapScreen />);
    expect(screen.getByLabelText("Katz's, stamped")).toBeTruthy();
    expect(screen.getByLabelText("Cafe, not stamped yet")).toBeTruthy();
    expect(screen.getByLabelText("You are here")).toBeTruthy();
  });
  it("opens the sheet for a pin, offers Stamp here when you are inside, and goes to the composer", async () => {
    await render(<MapScreen />);
    await fireEvent.press(screen.getByLabelText("Katz's, stamped"));
    expect(screen.getByText("Stamped 2 times. Last on 03 OCT 2026.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Stamp here" }));
    expect(mockPush).toHaveBeenCalledWith("/stamp/new");
  });
  it("closes the sheet when the map is tapped", async () => {
    await render(<MapScreen />);
    await fireEvent.press(screen.getByLabelText("Cafe, not stamped yet"));
    expect(screen.getByText("Not stamped yet.")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("map-background"));
    expect(screen.queryByText("Not stamped yet.")).toBeNull();
  });
  it("shows the OpenStreetMap credit when the data carries one, and not otherwise", async () => {
    mockAttribution = { text: "© OpenStreetMap contributors" };
    const a = await render(<MapScreen />);
    expect(screen.getByText("© OpenStreetMap contributors")).toBeTruthy();
    await a.unmount();
    mockAttribution = null;
    await render(<MapScreen />);
    expect(screen.queryByText(/OpenStreetMap/)).toBeNull();
  });
  it("is still a map with no places and no position", async () => {
    mockPlaces = [];
    mockMine = [];
    mockHere = null;
    await render(<MapScreen />);
    expect(screen.getByTestId("map")).toBeTruthy();
    expect(screen.queryByLabelText("You are here")).toBeNull();
  });
});
