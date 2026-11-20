import type { UserPlacesResponse } from "@/api/contracts";
import { NEIGHBOURHOOD_SPAN } from "@/lib/geo";
import { groupPins, isSameSpot, userRegion } from "../map-model";

const row = (id: string, lat: number, lng: number): UserPlacesResponse["places"][number] => ({
  place: { id, slug: id, name: id, area: null, city: null, region: null, country: null, countryCode: null, timeZone: "UTC", lat, lng },
  stamps: 1,
  latestStamp: { id: `s-${id}`, createdAt: "2026-10-19T20:00:00.000Z", visitedAt: "2026-10-19T20:00:00.000Z", photoUrl: null, caption: "" },
});

describe("userRegion", () => {
  it("zooms in to a neighbourhood when the map is wider", () => {
    const region = userRegion({ lat: 1, lng: 2 }, { latitude: 0, longitude: 0, latitudeDelta: 20, longitudeDelta: 20 });
    expect(region).toEqual({ latitude: 1, longitude: 2, ...NEIGHBOURHOOD_SPAN });
  });

  it("keeps a tighter zoom", () => {
    const region = userRegion({ lat: 1, lng: 2 }, { latitude: 0, longitude: 0, latitudeDelta: 0.005, longitudeDelta: 0.004 });
    expect(region.latitudeDelta).toBe(0.005);
    expect(region.longitudeDelta).toBe(0.004);
  });
});

describe("groupPins", () => {
  const frame = { width: 400, height: 400 };
  const rows = [row("a", 40.7, -74), row("b", 40.7004, -74.0004), row("c", 40.8, -74)];

  it("merges pins that would overlap at this zoom and keeps distant ones apart", () => {
    const groups = groupPins(rows, { latitude: 40.75, longitude: -74, latitudeDelta: 0.2, longitudeDelta: 0.2 }, frame, 28);
    expect(groups.map((g) => g.key)).toEqual(["a+b", "c"]);
  });

  it("separates them again when zoomed in", () => {
    const groups = groupPins(rows, { latitude: 40.7, longitude: -74, latitudeDelta: 0.002, longitudeDelta: 0.002 }, frame, 28);
    expect(groups.map((g) => g.key)).toEqual(["a", "b", "c"]);
  });

  it("has stable keys whatever the input order", () => {
    const region = { latitude: 40.75, longitude: -74, latitudeDelta: 0.2, longitudeDelta: 0.2 };
    expect(groupPins([...rows].reverse(), region, frame, 28).map((g) => g.key)).toEqual(["a+b", "c"]);
  });
});

describe("isSameSpot", () => {
  it("is true only for places a few metres apart", () => {
    expect(isSameSpot([row("a", 40.7, -74), row("b", 40.70001, -74.00001)])).toBe(true);
    expect(isSameSpot([row("a", 40.7, -74), row("b", 40.7004, -74.0004)])).toBe(false);
  });
});
