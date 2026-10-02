import NetInfo, { useNetInfo, type NetInfoState } from "@react-native-community/netinfo";
import { useEffect, useRef } from "react";
import { AccessibilityInfo } from "react-native";

import { api } from "@/api";

let configured = false;

/**
 * Reachability is checked against our own health endpoint, not NetInfo's default Google URL (blocked
 * on some networks, which would show a false "offline"). Call once at startup.
 */
export function configureNetwork(): void {
  if (configured) return;
  configured = true;
  NetInfo.configure({ reachabilityUrl: api.webUrl("/api/health"), reachabilityTest: async (r) => r.status === 200 });
}

/** One definition of offline for the banner and for pausing queries. Unknown (null) counts as online. */
export function isOffline(state: Pick<NetInfoState, "isConnected" | "isInternetReachable">): boolean {
  return state.isConnected === false || state.isInternetReachable === false;
}

export function useOffline(): boolean {
  return isOffline(useNetInfo());
}

/** Announce going offline and coming back, once for the whole app (mounted in the root layout). */
export function useOfflineAnnouncer(): void {
  const offline = useOffline();
  const previous = useRef(offline);
  useEffect(() => {
    if (previous.current === offline) return;
    previous.current = offline;
    AccessibilityInfo.announceForAccessibility(offline ? "You're offline." : "Back online.");
  }, [offline]);
}
