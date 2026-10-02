/**
 * Development-only location simulator: long-press the map to pretend you're there.
 *
 * `devSimulator` is `null` whenever `__DEV__` is false. Release builds are minified with
 * `__DEV__ === false`, so the branch below is removed and nothing can set a fake location.
 * The server still enforces the geofence against whatever coordinates arrive.
 */
import type { Coords } from "@/lib/geo";
import { locationStore } from "./location-store";

export type DevSimulator = {
  set: (coords: Coords) => void;
  clear: () => void;
};

export const devSimulator: DevSimulator | null = __DEV__
  ? {
      set: (coords) => locationStore._setSimulated(coords),
      clear: () => locationStore._setSimulated(null),
    }
  : null;

/** Map long-press handler, or undefined outside development (the map then has no long-press at all). */
export const simulateAtPress: ((coordinate: { latitude: number; longitude: number }) => void) | undefined = devSimulator
  ? (c) => devSimulator!.set({ lat: c.latitude, lng: c.longitude })
  : undefined;
