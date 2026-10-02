import { locationStore, SORT_ANCHOR_M } from "../location-store";

const mockListeners: ((p: { coords: { latitude: number; longitude: number; accuracy: number }; timestamp: number }) => void)[] = [];

jest.mock("expo-location", () => ({
  PermissionStatus: { GRANTED: "granted", UNDETERMINED: "undetermined", DENIED: "denied" },
  Accuracy: { High: 4 },
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted", canAskAgain: true })),
  requestForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(async (_opts: unknown, cb: (typeof mockListeners)[number]) => {
    mockListeners.push(cb);
    return { remove: jest.fn() };
  }),
  getCurrentPositionAsync: jest.fn(),
}));

const move = (lat: number, lng: number) => mockListeners.forEach((cb) => cb({ coords: { latitude: lat, longitude: lng, accuracy: 5 }, timestamp: Date.now() }));

describe("sort anchor", () => {
  it("only moves after the user travels more than the threshold", async () => {
    await locationStore.refreshPermission();
    await new Promise((r) => setTimeout(r, 0));
    move(40.72, -73.98);
    const first = locationStore.get().anchor;
    expect(first).toEqual({ lat: 40.72, lng: -73.98 });

    // ~11 m north: same anchor object, so memoized sorts don't rerun.
    move(40.7201, -73.98);
    expect(locationStore.get().anchor).toBe(first);
    expect(locationStore.current()).toEqual({ lat: 40.7201, lng: -73.98 });

    // ~111 m north: anchor follows.
    move(40.721, -73.98);
    expect(locationStore.get().anchor).toEqual({ lat: 40.721, lng: -73.98 });
    expect(SORT_ANCHOR_M).toBe(50);
  });
});
