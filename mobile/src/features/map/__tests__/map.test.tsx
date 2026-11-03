import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { View } from "react-native";

import type { Place, UserPlacesResponse } from "@/api/contracts";
import { MapScreen } from "../MapScreen";
import { PinMarker } from "../PinMarker";

const mockPush = jest.fn();
const mockAnimateToRegion = jest.fn();
let mockPlaces: Place[] = [];
let mockMine: UserPlacesResponse["places"] = [];
let mockHere: { lat: number; lng: number } | null = null;

jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock("react-native-maps", () => {
  const React = jest.requireActual("react");
  const { View: V, Pressable: P } = jest.requireActual("react-native");
  const MapView = React.forwardRef(function MockMapView(
    { children, showsUserLocation, ...rest }: { children?: ReactNode; showsUserLocation?: boolean },
    ref: unknown,
  ) {
    React.useImperativeHandle(ref, () => ({ animateToRegion: (...args: unknown[]) => mockAnimateToRegion(...args) }));
    return (
      <V {...rest} testID="map">
        {children}
        {showsUserLocation ? <V accessibilityLabel="You are here" /> : null}
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
  usePlaces: () => ({ data: { places: mockPlaces, attribution: null } }),
  useUserPlaces: () => ({ data: { places: mockMine } }),
}));
jest.mock("@/features/location/location-store", () => ({ useUserCoords: () => mockHere }));
jest.mock("../recenter", () => ({ mapRecenter: { subscribe: () => () => undefined } }));

const place = (id: string, over: Partial<Place> = {}): Place => ({
  id,
  slug: id,
  name: `Place ${id}`,
  address: "",
  area: "West Village",
  city: "New York",
  region: "New York",
  country: "United States",
  countryCode: "US",
  timeZone: "America/New_York",
  lat: 40.7314,
  lng: -74.0078,
  geofenceMeters: 100,
  fromOsm: false,
  googlePlaceId: `g-${id}`,
  category: "restaurant",
  cuisines: [],
  primaryType: "restaurant",
  businessStatus: "OPERATIONAL",
  ...over,
});

const mineRow = (p: Place, latestStampId: string): UserPlacesResponse["places"][number] => ({
  place: {
    id: p.id,
    slug: p.slug,
    name: p.name,
    area: p.area,
    city: p.city,
    region: p.region,
    country: p.country,
    countryCode: p.countryCode,
    timeZone: p.timeZone,
    lat: p.lat,
    lng: p.lng,
  },
  stamps: 1,
  latestStamp: {
    id: latestStampId,
    createdAt: "2026-10-19T20:00:00.000Z",
    visitedAt: "2026-10-19T20:00:00.000Z",
    photoUrl: null,
    caption: "",
  },
});

describe("PinMarker", () => {
  it("renders a visited stamp marker", async () => {
    const input = { placeId: "a", placeName: "A", localityKey: "West Village", localityName: "West Village" };
    await render(<View><PinMarker kind="lit" selected={false} input={input} /></View>);
  });
});

describe("MapScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const restaurant = place("restaurant", { name: "Don Angie", category: "restaurant", cuisines: ["Italian"] });
    const bar = place("bar", { name: "Employees Only", category: "bar", primaryType: "cocktail_bar", cuisines: ["Cocktail Bar"], lat: 40.7335 });
    const unvisited = place("unvisited", { name: "Never Stamped", category: "restaurant", lat: 40.735 });
    mockPlaces = [restaurant, bar, unvisited];
    mockMine = [mineRow(restaurant, "stamp-restaurant"), mineRow(bar, "stamp-bar")];
    mockHere = { lat: 40.7314, lng: -74.0078 };
  });

  it("shows only stamped places and the user's location", async () => {
    await render(<MapScreen />);
    expect(screen.getByLabelText("Don Angie, open most recent stamp")).toBeTruthy();
    expect(screen.getByLabelText("Employees Only, open most recent stamp")).toBeTruthy();
    expect(screen.queryByLabelText("Never Stamped, open most recent stamp")).toBeNull();
    expect(screen.getByLabelText("You are here")).toBeTruthy();
  });

  it("opens the most recent stamp when a visited place is tapped", async () => {
    await render(<MapScreen />);
    await fireEvent.press(screen.getByLabelText("Don Angie, open most recent stamp"));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/stamp/[id]", params: { id: "stamp-restaurant" } });
  });

  it("filters stamped places by restaurant and bar without changing the visited data", async () => {
    await render(<MapScreen />);

    await fireEvent.press(screen.getByRole("button", { name: "RESTAURANTS" }));
    expect(screen.getByLabelText("Don Angie, open most recent stamp")).toBeTruthy();
    expect(screen.queryByLabelText("Employees Only, open most recent stamp")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "BARS" }));
    expect(screen.queryByLabelText("Don Angie, open most recent stamp")).toBeNull();
    expect(screen.getByLabelText("Employees Only, open most recent stamp")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "ALL" }));
    expect(screen.getByLabelText("Don Angie, open most recent stamp")).toBeTruthy();
    expect(screen.getByLabelText("Employees Only, open most recent stamp")).toBeTruthy();
  });

  it("filters stamped places to hotels", async () => {
    const hotel = place("hotel", { name: "Public Hotel", category: "hotel", primaryType: "hotel", cuisines: [], lat: 40.7224 });
    mockPlaces = [...mockPlaces, hotel];
    mockMine = [...mockMine, mineRow(hotel, "stamp-hotel")];
    await render(<MapScreen />);

    await fireEvent.press(screen.getByRole("button", { name: "HOTELS" }));
    expect(screen.getByLabelText("Public Hotel, open most recent stamp")).toBeTruthy();
    expect(screen.queryByLabelText("Don Angie, open most recent stamp")).toBeNull();
    expect(screen.queryByLabelText("Employees Only, open most recent stamp")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "RESTAURANTS" }));
    expect(screen.queryByLabelText("Public Hotel, open most recent stamp")).toBeNull();
  });

  it("recenters on the user's live location", async () => {
    await render(<MapScreen />);
    mockAnimateToRegion.mockClear();
    await fireEvent.press(screen.getByRole("button", { name: "Recenter map on my location" }));
    expect(mockAnimateToRegion).toHaveBeenCalledWith(expect.objectContaining({ latitude: 40.7314, longitude: -74.0078 }), 300);
  });

  it("opens the location permission flow when recenter needs location", async () => {
    mockHere = null;
    await render(<MapScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Share location to recenter map" }));
    expect(mockPush).toHaveBeenCalledWith("/location-permission");
  });
});
