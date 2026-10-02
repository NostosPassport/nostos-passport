/**
 * "Here now" pings: on venue open, every 5 minutes while the venue screen is open, and when the
 * user moves more than 25 m (at most every 30 s), as API.md specifies. The server decides whether
 * the user is inside the geofence; its answer drives the report bar.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { api, ApiError } from "@/api";
import type { PresenceResponse } from "@/api/contracts";
import { invalidateVenue } from "@/api/queries";
import { locationStore } from "@/features/location/location-store";
import { distanceMeters, type Coords } from "@/lib/geo";

export const PRESENCE_INTERVAL_MS = 5 * 60_000;
export const PRESENCE_MOVE_M = 25;
export const PRESENCE_MIN_GAP_MS = 30_000;

export type PresenceState =
  | { status: "idle" }
  | { status: "no-location" }
  | { status: "checking" }
  | { status: "done"; result: PresenceResponse }
  | { status: "error"; error: ApiError };

/** The last ping *attempt* (successful or not): the 30 s gap applies to attempts. */
export type LastAttempt = { coords: Coords; at: number } | null;

/** Should a movement trigger a new ping now? */
export function shouldRepingForMove(last: LastAttempt, now: Coords, nowMs: number): boolean {
  if (!last) return true;
  if (nowMs - last.at < PRESENCE_MIN_GAP_MS) return false;
  return distanceMeters(last.coords, now) > PRESENCE_MOVE_M;
}

/** Moved far enough, but too soon: when to try again. */
export function deferredPingDelay(last: LastAttempt, now: Coords, nowMs: number): number | null {
  if (!last || distanceMeters(last.coords, now) <= PRESENCE_MOVE_M) return null;
  const wait = PRESENCE_MIN_GAP_MS - (nowMs - last.at);
  return wait > 0 ? wait : null;
}

// Other screens (the report sheet after a 403) can ask the open venue to re-check presence.
const pingRequests = new Set<(venueId: string) => void>();
export function requestPresencePing(venueId: string): void {
  pingRequests.forEach((l) => l(venueId));
}

export function usePresence(venueId: string | undefined, enabled: boolean): PresenceState {
  const queryClient = useQueryClient();
  const [state, setState] = useState<PresenceState>({ status: "idle" });
  const last = useRef<LastAttempt>(null);
  const inFlight = useRef(false);
  const wasHere = useRef<boolean | null>(null);

  useEffect(() => {
    if (!enabled || !venueId) return;
    let alive = true;
    let deferred: ReturnType<typeof setTimeout> | null = null;

    const ping = async (coords?: Coords | null) => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const at = coords ?? (await locationStore.currentForPosting());
        if (!alive) return;
        if (!at) {
          setState({ status: "no-location" });
          return;
        }
        // Record the attempt before sending, so failures are throttled too.
        const first = last.current === null;
        last.current = { coords: at, at: Date.now() };
        if (first) setState({ status: "checking" });
        const result = await api.venues.presence(venueId, at);
        if (!alive) return;
        setState({ status: "done", result });
        if (wasHere.current !== result.here) {
          wasHere.current = result.here;
          void invalidateVenue(queryClient, venueId);
        }
      } catch (e) {
        if (alive && e instanceof ApiError) setState({ status: "error", error: e });
      } finally {
        inFlight.current = false;
      }
    };

    void ping();
    const timer = setInterval(() => void ping(), PRESENCE_INTERVAL_MS);
    const unsubscribe = locationStore.subscribe(() => {
      const now = locationStore.current();
      if (!now) return;
      if (shouldRepingForMove(last.current, now, Date.now())) {
        if (deferred) clearTimeout(deferred);
        deferred = null;
        void ping(now);
        return;
      }
      // Arrived within the 30 s window: check once the window ends instead of dropping the move.
      const wait = deferredPingDelay(last.current, now, Date.now());
      if (wait !== null && !deferred) {
        deferred = setTimeout(() => {
          deferred = null;
          void ping();
        }, wait);
      }
    });
    const onRequest = (id: string) => {
      if (id === venueId && (!last.current || Date.now() - last.current.at >= PRESENCE_MIN_GAP_MS)) void ping();
    };
    pingRequests.add(onRequest);
    const appState = AppState.addEventListener("change", (s) => {
      if (s === "active" && last.current && Date.now() - last.current.at > PRESENCE_INTERVAL_MS) void ping();
    });
    return () => {
      alive = false;
      clearInterval(timer);
      if (deferred) clearTimeout(deferred);
      unsubscribe();
      pingRequests.delete(onRequest);
      appState.remove();
    };
  }, [venueId, enabled, queryClient]);

  // Location turned off (or the simulator cleared) mid-screen: forget the old answer.
  return enabled ? state : { status: "idle" };
}
