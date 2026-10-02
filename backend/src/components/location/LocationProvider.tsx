"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Pos = { lat: number; lng: number };
type Source = "simulated" | "gps" | null;

type LocationState = {
  pos: Pos | null;
  source: Source;
  error: string | null;
  /** Dev-only location simulator. Always false in production builds. */
  simulatorAvailable: boolean;
  setSimulated: (pos: Pos | null) => void;
  requestGps: () => void;
};

// process.env.NODE_ENV is inlined at build time, so the simulator is compiled out of production bundles.
export const SIMULATOR_AVAILABLE = process.env.NODE_ENV === "development";
const SIM_KEY = "lc_sim_location";

const Ctx = createContext<LocationState | null>(null);

function readSim(): Pos | null {
  if (!SIMULATOR_AVAILABLE) return null;
  try {
    const raw = localStorage.getItem(SIM_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pos;
    return Number.isFinite(p.lat) && Number.isFinite(p.lng) ? p : null;
  } catch {
    return null;
  }
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [sim, setSim] = useState<Pos | null>(null);
  const [gps, setGps] = useState<Pos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return; // simulator compiled out of production
    setSim(readSim());
    const onStorage = (e: StorageEvent) => e.key === SIM_KEY && setSim(readSim());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const requestGps = useCallback(() => setWatching(true), []);

  useEffect(() => {
    if (!watching) return;
    if (!("geolocation" in navigator)) {
      setError("Location isn't available in this browser");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setGps({ lat: p.coords.latitude, lng: p.coords.longitude });
        setError(null);
      },
      (e) => setError(e.code === e.PERMISSION_DENIED ? "Location permission denied" : "Couldn't get your location"),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [watching]);

  const setSimulated = useCallback((p: Pos | null) => {
    if (!SIMULATOR_AVAILABLE) return;
    try {
      if (p) localStorage.setItem(SIM_KEY, JSON.stringify(p));
      else localStorage.removeItem(SIM_KEY);
    } catch {
      /* storage unavailable: keep in memory only */
    }
    setSim(p);
  }, []);

  const value = useMemo<LocationState>(() => {
    const pos = sim ?? gps;
    return {
      pos,
      source: sim ? "simulated" : gps ? "gps" : null,
      error,
      simulatorAvailable: SIMULATOR_AVAILABLE,
      setSimulated,
      requestGps,
    };
  }, [sim, gps, error, setSimulated, requestGps]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocation(): LocationState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLocation must be used inside <LocationProvider>");
  return v;
}
