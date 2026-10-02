import { describe, expect, it } from "vitest";
import { distanceMeters, withinGeofence, isValidLatLng } from "@/lib/geo";
import { dollarsToCents, formatCents } from "@/lib/money";

describe("geo", () => {
  const venue = { lat: 40.7265, lng: -73.9845 };
  it("measures short distances accurately", () => {
    // 0.0009 deg latitude ~ 100.08m
    expect(distanceMeters(venue, { lat: venue.lat + 0.0009, lng: venue.lng })).toBeCloseTo(100.08, 0);
  });
  it("geofence is inclusive at 100m and rejects beyond", () => {
    expect(withinGeofence(venue, { lat: venue.lat + 0.00089, lng: venue.lng })).toBe(true);
    expect(withinGeofence(venue, { lat: venue.lat + 0.00091, lng: venue.lng })).toBe(false);
  });
  it("validates coordinates", () => {
    expect(isValidLatLng({ lat: 40, lng: -73 })).toBe(true);
    expect(isValidLatLng({ lat: NaN, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: "40", lng: 0 })).toBe(false);
  });
});

describe("money", () => {
  it("converts dollars to integer cents", () => {
    expect(dollarsToCents("20")).toBe(2000);
    expect(dollarsToCents("$12.5")).toBe(1250);
    expect(dollarsToCents("0")).toBe(0);
    expect(dollarsToCents("-5")).toBeNull();
    expect(dollarsToCents("1e3")).toBeNull();
    expect(dollarsToCents("12.345")).toBeNull();
  });
  it("formats cents", () => {
    expect(formatCents(0)).toBe("Free");
    expect(formatCents(2000)).toBe("$20");
    expect(formatCents(1250)).toBe("$12.50");
    expect(formatCents(null)).toBe("—");
  });
});
