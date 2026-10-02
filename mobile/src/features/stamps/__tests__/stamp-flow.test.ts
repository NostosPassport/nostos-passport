import type { NearbyPlacesResponse } from "@/api/contracts";
import { HONESTY, MAX_STAMP_PHOTOS, addPhoto, calmState, photoCount, photosLeft, placeRowText, placeSections, removePhotoAt, stampReadiness } from "../stamp-flow";

type Nearby = NearbyPlacesResponse["places"][number];
const place = (over: Partial<Nearby> = {}): Nearby => ({ id: "p", slug: "p", name: "Katz's", address: "", neighborhood: "East Village", lat: 1, lng: 2, geofenceMeters: 100, neighborhoodId: null, fromOsm: false, distanceM: 20, inside: true, ...over });

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
  it("splits Here from Nearby and leaves out an empty group", () => {
    const secs = placeSections([place({ id: "a" }), place({ id: "b", inside: false, distanceM: 150 }), place({ id: "c" })]);
    expect(secs.map((s) => [s.title, s.places.map((p) => p.id)])).toEqual([["Here", ["a", "c"]], ["Nearby", ["b"]]]);
    expect(placeSections([place({ inside: false })]).map((s) => s.title)).toEqual(["Nearby"]);
    expect(placeSections([])).toEqual([]);
  });
  it("says how far you are, in kilometers from 1000 m up", () => {
    expect(placeRowText(place({ inside: false, distanceM: 140 })).subtitle).toBe("East Village · 140 m away, need to be within 100 m");
    expect(placeRowText(place({ inside: false, distanceM: 1815 })).subtitle).toBe("East Village · 1.8 km away, need to be within 100 m");
    expect(placeRowText(place({ inside: false, distanceM: 999 })).subtitle).toContain("999 m away");
    expect(placeRowText(place({ inside: false, distanceM: 1000 })).subtitle).toContain("1.0 km away");
    expect(placeRowText(place()).spoken).toBe("Katz's, You're here");
  });
});

describe("the calm disabled state", () => {
  it("is quiet and says how far away and how close you need to be, in km when far", () => {
    expect(calmState(place({ inside: false, distanceM: 1815, geofenceMeters: 100 }))).toEqual({
      title: "Not quite there yet",
      body: "You're 1.8 km from Katz's. Stamping opens when you're within 100 m.",
    });
    expect(calmState(place({ inside: false, distanceM: 140 }))!.body).toContain("140 m from Katz's");
  });
  it("is absent when you're inside or have chosen nothing", () => {
    expect(calmState(place())).toBeNull();
    expect(calmState(null)).toBeNull();
  });
  it("never reads like an error", () => {
    const body = JSON.stringify(calmState(place({ inside: false, distanceM: 500 })));
    expect(body).not.toMatch(/error|failed|wrong|denied|can't|cannot|invalid/i);
  });
});

describe("when the Stamp button is on", () => {
  it("is on when you're inside and the stamp has something in it", () => {
    expect(stampReadiness({ place: place(), problem: null, busy: false })).toEqual({ ready: true, hint: null, calm: null });
  });
  it("is off while stamping, and says nothing", () => {
    expect(stampReadiness({ place: place(), problem: null, busy: true })).toMatchObject({ ready: false, hint: null });
  });
  it("outside the geofence it is off and shows the calm state instead of a hint", () => {
    const r = stampReadiness({ place: place({ inside: false, distanceM: 300 }), problem: "Add a photo, a caption or a song.", busy: false });
    expect(r.ready).toBe(false);
    expect(r.hint).toBeNull();
    expect(r.calm?.title).toBe("Not quite there yet");
  });
  it("inside but empty it says what to add; with no place chosen it says to choose", () => {
    expect(stampReadiness({ place: place(), problem: "Add a photo, a caption or a song.", busy: false })).toMatchObject({ ready: false, hint: "Add a photo, a caption or a song." });
    expect(stampReadiness({ place: null, problem: "Choose where you are.", busy: false })).toMatchObject({ ready: false, hint: "Choose where you are." });
  });
});

describe("the honesty note", () => {
  it("is plain and does not claim the position is never stored, because the server saves it with the stamp", () => {
    expect(HONESTY.body).not.toMatch(/never stored|not stored|isn't stored|don't store|never saved/i);
    expect(HONESTY.body).toMatch(/saved with the stamp/);
    expect(HONESTY.body).toMatch(/never shown/);
  });
});
