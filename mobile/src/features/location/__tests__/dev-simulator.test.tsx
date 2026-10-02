/* eslint-disable @typescript-eslint/no-require-imports -- jest.isolateModules needs require() */
/**
 * The location simulator must be impossible to reach in production builds, where `__DEV__` is false.
 */
jest.mock("expo-location", () => ({
  PermissionStatus: { GRANTED: "granted", UNDETERMINED: "undetermined", DENIED: "denied" },
  Accuracy: { High: 4 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

type G = { __DEV__: boolean };

function loadWithDev(dev: boolean) {
  const g = globalThis as unknown as G;
  const previous = g.__DEV__;
  g.__DEV__ = dev;
  let mods!: {
    sim: typeof import("../dev-simulator");
    store: typeof import("../location-store");
    chip: typeof import("../sim-chip");
    rtl: typeof import("@testing-library/react-native/pure");
    React: typeof import("react");
  };
  jest.isolateModules(() => {
    mods = {
      sim: require("../dev-simulator"),
      store: require("../location-store"),
      chip: require("../sim-chip"),
      // Same module registry as the component, so there is one copy of React.
      rtl: require("@testing-library/react-native/pure"),
      React: require("react"),
    };
  });
  return {
    ...mods,
    restore: () => {
      g.__DEV__ = previous;
    },
  };
}

describe("dev location simulator", () => {
  it("works in development", () => {
    const { sim, store, restore } = loadWithDev(true);
    try {
      expect(sim.devSimulator).not.toBeNull();
      expect(sim.simulateAtPress).toBeDefined();
      sim.simulateAtPress!({ latitude: 40.72, longitude: -73.98 });
      expect(store.locationStore.current()).toEqual({ lat: 40.72, lng: -73.98 });
      sim.devSimulator!.clear();
      expect(store.locationStore.get().simulated).toBeNull();
    } finally {
      restore();
    }
  });

  it("does not exist in production builds", async () => {
    const { sim, store, chip, rtl, React, restore } = loadWithDev(false);
    try {
      expect(sim.devSimulator).toBeNull();
      // No long-press handler is attached to the map at all.
      expect(sim.simulateAtPress).toBeUndefined();
      // Even the store's internal setter refuses.
      store.locationStore._setSimulated({ lat: 1, lng: 2 });
      expect(store.locationStore.get().simulated).toBeNull();
      expect(store.locationStore.current()).toBeNull();
      // And the chip never renders.
      const screen = await rtl.render(React.createElement(chip.SimulatedLocationChip));
      expect(screen.queryByTestId("sim-chip")).toBeNull();
      expect(screen.queryByText("Simulated location")).toBeNull();
    } finally {
      restore();
    }
  });
});
