import { ApiError } from "@/api/client";
import type { PresenceState } from "../presence";
import { deferredPingDelay, shouldRepingForMove } from "../presence";
import { outsideMessage, reportBarState } from "../report-bar-state";

jest.mock("expo-location", () => ({}));

const done = (result: Extract<PresenceState, { status: "done" }>["result"]): PresenceState => ({ status: "done", result });
const base = { signedIn: true, ownsVenue: false, permission: "granted" as const };

describe("reportBarState", () => {
  it("hides for the venue's owner, even inside the geofence", () => {
    expect(reportBarState({ ...base, ownsVenue: true, presence: done({ here: true, expiresAt: "2026-09-24T03:00:00Z", distanceM: 10, radiusM: 100 }) })).toEqual({ kind: "hidden" });
  });
  it("asks guests to sign in", () => {
    expect(reportBarState({ ...base, signedIn: false, presence: { status: "idle" } })).toEqual({ kind: "signin" });
  });
  it("is ready when the server says we're here", () => {
    expect(reportBarState({ ...base, presence: done({ here: true, expiresAt: "2026-09-24T03:00:00Z", distanceM: 40, radiusM: 100 }) })).toEqual({ kind: "ready" });
  });
  it("carries the server's distance when outside", () => {
    expect(reportBarState({ ...base, presence: done({ here: false, reason: "outside", distanceM: 140, radiusM: 100 }) })).toEqual({ kind: "outside", distanceM: 140 });
  });
  it("hides for venue accounts", () => {
    expect(reportBarState({ ...base, presence: done({ here: false, reason: "venue_account", distanceM: 0, radiusM: 100 }) })).toEqual({ kind: "hidden" });
  });
  it("asks for location before the first ping", () => {
    expect(reportBarState({ ...base, permission: "undetermined", presence: { status: "idle" } })).toEqual({ kind: "needs-location" });
    expect(reportBarState({ ...base, permission: "denied", presence: { status: "idle" } })).toEqual({ kind: "location-denied" });
  });
  it("lets people try when the ping failed (the server decides on post)", () => {
    expect(reportBarState({ ...base, presence: { status: "error", error: new ApiError(0, "offline", "x") } })).toEqual({ kind: "ready" });
  });
  it("never dims for geofence-exempt accounts (the server lets them post from anywhere)", () => {
    expect(reportBarState({ ...base, geofenceExempt: true, presence: done({ here: false, reason: "outside", distanceM: 1815, radiusM: 100 }) })).toEqual({ kind: "ready" });
    expect(reportBarState({ ...base, geofenceExempt: true, permission: "undetermined", presence: { status: "idle" } })).toEqual({ kind: "ready" });
  });
  it("words the distance like the spec", () => {
    expect(outsideMessage(140)).toBe("You're 140 m away. Get closer to post.");
  });
});

describe("presence re-ping on movement", () => {
  const at = { lat: 40.72, lng: -73.98 };
  it("pings when there's no previous ping", () => {
    expect(shouldRepingForMove(null, at, 0)).toBe(true);
  });
  it("waits at least 30 s between movement pings", () => {
    expect(shouldRepingForMove({ coords: at, at: 0 }, { lat: 40.7205, lng: -73.98 }, 10_000)).toBe(false);
  });
  it("needs more than 25 m of movement", () => {
    expect(shouldRepingForMove({ coords: at, at: 0 }, { lat: 40.7201, lng: -73.98 }, 60_000)).toBe(false);
    expect(shouldRepingForMove({ coords: at, at: 0 }, { lat: 40.7204, lng: -73.98 }, 60_000)).toBe(true);
  });
});

describe("presence deferral", () => {
  const at = { lat: 40.72, lng: -73.98 };
  const far = { lat: 40.7204, lng: -73.98 }; // ~44 m
  it("schedules a ping for the end of the 30 s window when the user arrives too soon", () => {
    expect(deferredPingDelay({ coords: at, at: 0 }, far, 10_000)).toBe(20_000);
  });
  it("doesn't defer small moves or when the window has passed", () => {
    expect(deferredPingDelay({ coords: at, at: 0 }, { lat: 40.7201, lng: -73.98 }, 10_000)).toBeNull();
    expect(deferredPingDelay({ coords: at, at: 0 }, far, 40_000)).toBeNull();
    expect(deferredPingDelay(null, far, 0)).toBeNull();
  });
});
