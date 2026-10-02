/**
 * The user's location, for display (Nearby sort, map dot) and for the coordinates sent with
 * reports, photos and presence pings. The server decides the geofence from those coordinates.
 *
 * Permission is when-in-use only, and only requested after the pre-permission screen.
 */
import * as Location from "expo-location";
import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { distanceMeters, type Coords } from "@/lib/geo";

export type PermissionState = "unknown" | "undetermined" | "granted" | "denied";

type State = {
  permission: PermissionState;
  /** Real GPS fix. */
  device: (Coords & { accuracy: number | null; at: number }) | null;
  /** Development-only override (see dev-simulator.ts). Always null in release builds. */
  simulated: Coords | null;
  /** Position for distance sorting; moves only in steps of SORT_ANCHOR_M. */
  anchor: Coords | null;
};

export const SORT_ANCHOR_M = 50;

let state: State = { permission: "unknown", device: null, simulated: null, anchor: null };
const listeners = new Set<() => void>();
let watcher: Location.LocationSubscription | null = null;

function set(patch: Partial<Omit<State, "anchor">>) {
  const next = { ...state, ...patch };
  const live = next.simulated ?? (next.device ? { lat: next.device.lat, lng: next.device.lng } : null);
  let anchor = state.anchor;
  if (!live) anchor = null;
  else if (!anchor || patch.simulated !== undefined || distanceMeters(anchor, live) > SORT_ANCHOR_M) anchor = live;
  state = { ...next, anchor };
  for (const l of listeners) l();
}

function toPermission(status: Location.PermissionStatus, canAskAgain: boolean): PermissionState {
  if (status === Location.PermissionStatus.GRANTED) return "granted";
  if (status === Location.PermissionStatus.UNDETERMINED || canAskAgain) return "undetermined";
  return "denied";
}

async function startWatching() {
  if (watcher) return;
  try {
    watcher = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 5000 },
      (pos) => set({ device: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, at: pos.timestamp } }),
    );
  } catch {
    watcher = null;
  }
}

export const locationStore = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  /** Read the current permission without prompting; start watching if already granted. */
  async refreshPermission(): Promise<PermissionState> {
    const res = await Location.getForegroundPermissionsAsync();
    const permission = toPermission(res.status, res.canAskAgain);
    set({ permission });
    if (permission === "granted") void startWatching();
    return permission;
  },

  /** Show the system prompt. Call only from the pre-permission screen. */
  async request(): Promise<PermissionState> {
    const res = await Location.requestForegroundPermissionsAsync();
    const permission = toPermission(res.status, res.canAskAgain);
    set({ permission });
    if (permission === "granted") void startWatching();
    return permission;
  },

  /** Where to send as the user's position: the simulated point in development, else the device fix. */
  current(): Coords | null {
    if (state.simulated) return state.simulated;
    return state.device ? { lat: state.device.lat, lng: state.device.lng } : null;
  },

  /** A fresh fix for posting (falls back to the last watched one). */
  async currentForPosting(): Promise<Coords | null> {
    if (state.simulated) return state.simulated;
    if (state.permission !== "granted") return null;
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const device = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, at: pos.timestamp };
      set({ device });
      return { lat: device.lat, lng: device.lng };
    } catch {
      return locationStore.current();
    }
  },

  /** @internal Used by dev-simulator.ts only. */
  _setSimulated(simulated: Coords | null) {
    if (!__DEV__) return;
    set({ simulated });
  },
};

export function useLocationState(): State {
  return useSyncExternalStore(locationStore.subscribe, locationStore.get, locationStore.get);
}

/** The effective position for display: simulated (dev) or device. */
export function useUserCoords(): Coords | null {
  const s = useLocationState();
  if (s.simulated) return s.simulated;
  return s.device ? { lat: s.device.lat, lng: s.device.lng } : null;
}

/** Re-read the permission when the app returns to the foreground (e.g. back from Settings). */
export function usePermissionRefresh(): void {
  useEffect(() => {
    void locationStore.refreshPermission();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void locationStore.refreshPermission();
    });
    return () => sub.remove();
  }, []);
}

/**
 * The user's position for sorting by distance. It only changes after they move more than
 * `SORT_ANCHOR_M`, so lists don't reshuffle under a finger on every GPS tick. Stable identity.
 */
export function useSortCoords(): Coords | null {
  return useSyncExternalStore(locationStore.subscribe, () => state.anchor, () => state.anchor);
}
