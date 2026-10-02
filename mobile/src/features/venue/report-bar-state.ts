/** What the report bar shows. Pure: derived from auth, permission and the server's presence answer. */
import type { PermissionState } from "@/features/location/location-store";
import type { PresenceState } from "./presence";

export type ReportBarState =
  | { kind: "hidden" }
  | { kind: "signin" }
  | { kind: "needs-location" }
  | { kind: "location-denied" }
  | { kind: "checking" }
  | { kind: "ready" }
  | { kind: "outside"; distanceM: number };

export function reportBarState(input: {
  signedIn: boolean;
  ownsVenue: boolean;
  /** App Review / demo accounts the server lets post from anywhere. */
  geofenceExempt?: boolean;
  permission: PermissionState;
  presence: PresenceState;
}): ReportBarState {
  const { signedIn, ownsVenue, permission, presence, geofenceExempt } = input;
  // Owners never see report UI for their own venue (the API refuses anyway).
  if (ownsVenue) return { kind: "hidden" };
  if (!signedIn) return { kind: "signin" };
  // The server skips the geofence for these accounts, so the bar shouldn't dim on distance.
  if (geofenceExempt) return presence.status === "done" && !presence.result.here && presence.result.reason === "venue_account" ? { kind: "hidden" } : { kind: "ready" };
  if (presence.status === "done") {
    if (presence.result.here) return { kind: "ready" };
    if (presence.result.reason === "venue_account") return { kind: "hidden" };
    return { kind: "outside", distanceM: presence.result.distanceM };
  }
  if (permission === "denied") return { kind: "location-denied" };
  if (permission === "undetermined" || presence.status === "no-location") return { kind: "needs-location" };
  // Unknown permission, first ping in flight, or a failed ping: let people try; the server decides on post.
  if (presence.status === "checking" || permission === "unknown") return { kind: "checking" };
  return { kind: "ready" };
}

/** "You're 140 m away. Get closer to post." */
export function outsideMessage(distanceM: number): string {
  return `You're ${Math.round(distanceM)} m away. Get closer to post.`;
}
