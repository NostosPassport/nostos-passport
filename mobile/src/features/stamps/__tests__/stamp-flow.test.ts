import type { NearbyPlacesResponse } from "@/api/contracts";
import { HONESTY, MAX_STAMP_PHOTOS, addPhoto, photoCount, photosLeft, placeRowText, placeSections, removePhotoAt, stampReadiness } from "../stamp-flow";

type Nearby = NearbyPlacesResponse["places"][number];
const place = (over: Partial<Nearby> = {}): Nearby => ({ id: "p", slug: "p", name: "Katz's", address: "", neighborhood: "East Village", lat: 1, lng: 2, geofenceMeters: 100, neighborhoodId: null, fromOsm: false, googlePlaceId: null, category: null, cuisines: [], primaryType: null, businessStatus: null, distanceM: 20, inside: true, ...over });

describe("photos", () => {
  it("holds six at most, and a seventh leaves the list as it was", () => {
    let list: string[] = [];
    for (let i = 0; i < 9; i++) list = addPhoto(list, `p${i}`);
    expect(list).toEqual(["p0", "p1", "p2", "p3", "p4", "p5"]);
    expect(MAX_STAMP_PHOTOS).toBe(6);
  });
  it("removes the one you choose and keeps the order", () => {
    expect(removePhotoAt(["a", "b", "c"], 1)).toEqual(["a", "c"]);
    expect(removePhotoAt(["a"], 5)).toEqual(["a"]);
  });
  it("counts what is left, and says n of 6", () => {
    expect(photosLeft([])).toBe(6);
    expect(photosLeft(["a", "b"])).toBe(4);
    expect(photosLeft(Array(9).fill("x"))).toBe(0);
    expect(photoCount(2)).toBe("2 of 6");
    expect(photoCount(9)).toBe("6 of 6");
  });
});

describe("the places list", () => {
  it("separates currently verifiable nearby places from other nearby places", () => {
    const secs = placeSections([place({ id: "a" }), place({ id: "b", inside: false, distanceM: 150 }), place({ id: "c" })]);
    expect(secs.map((s) => [s.title, s.places.map((p) => p.id)])).toEqual([["Nearby · verified", ["a", "c"]], ["Nearby", ["b"]]]);
    expect(placeSections([place({ inside: false })]).map((s) => s.title)).toEqual(["Nearby"]);
    expect(placeSections([])).toEqual([]);
  });
  it("uses positive verification language and simple distance for places outside the radius", () => {
    expect(placeRowText(place({ inside: false, distanceM: 140 })).subtitle).toBe("East Village · 140 m away");
    expect(placeRowText(place({ inside: false, distanceM: 1815 })).subtitle).toBe("East Village · 1.8 km away");
    expect(placeRowText(place({ inside: false, distanceM: 999 })).subtitle).toContain("999 m away");
    expect(placeRowText(place({ inside: false, distanceM: 1000 })).subtitle).toContain("1.0 km away");
    expect(placeRowText(place()).spoken).toBe("Katz's, Visit can be verified");
  });
});

describe("when the Stamp button is on", () => {
  it("does not use geofence position as a creation gate", () => {
    expect(stampReadiness({ problem: null, busy: false })).toEqual({ ready: true, hint: null });
    expect(stampReadiness({ problem: "Add a photo, a caption or a song.", busy: false })).toEqual({ ready: false, hint: "Add a photo, a caption or a song." });
  });
  it("is off while stamping, and says nothing", () => {
    expect(stampReadiness({ problem: null, busy: true })).toEqual({ ready: false, hint: null });
  });
});

describe("the honesty note", () => {
  it("makes location optional and describes verification without claiming photo authenticity", () => {
    expect(HONESTY.body).toMatch(/location/i);
    expect(HONESTY.body).toMatch(/verified/i);
    expect(HONESTY.body).toMatch(/always stamp without location/i);
    expect(HONESTY.body).not.toMatch(/photo.*verified|verified.*photo/i);
  });
});
