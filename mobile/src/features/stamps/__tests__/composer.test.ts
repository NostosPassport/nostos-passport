import { autoPlace, hasContent, stampChanges, orderPlaces, placeDistanceLabel, stampFields, stampProblem, CAPTION_MAX } from "../composer";
import { formatDistance } from "@/lib/format";

const song = { title: "Heroes", artist: "David Bowie", artUrl: "https://is1-ssl.mzstatic.com/a.jpg", sourceId: "1" };
const place = (over: Partial<{ id: string; inside: boolean; distanceM: number; geofenceMeters: number }>) =>
  ({ id: "p", slug: "p", name: "P", address: "", neighborhood: "East Village", lat: 1, lng: 2, geofenceMeters: 100, fromOsm: false, distanceM: 10, inside: true, ...over });

describe("stamp content rule", () => {
  it("needs at least one of photo, caption or song", () => {
    expect(hasContent({ photoUri: null, caption: "", song: null })).toBe(false);
    expect(hasContent({ photoUri: null, caption: "   ", song: null })).toBe(false);
    expect(hasContent({ photoUri: "file://p.jpg", caption: "", song: null })).toBe(true);
    expect(hasContent({ photoUri: null, caption: "hi", song: null })).toBe(true);
    expect(hasContent({ photoUri: null, caption: "", song })).toBe(true);
  });

  it("says what's missing, in order: place first, then content, then length", () => {
    const empty = { photoUri: null, caption: "", song: null };
    expect(stampProblem(empty, null)).toBe("Choose where you are.");
    expect(stampProblem(empty, "p1")).toBe("Add a photo, a caption or a song.");
    expect(stampProblem({ ...empty, caption: "x".repeat(CAPTION_MAX + 1) }, "p1")).toMatch(/280 characters/);
    expect(stampProblem({ ...empty, caption: "ok" }, "p1")).toBeNull();
  });
});

describe("stampFields", () => {
  it("sends coordinates always, and only the parts that exist", () => {
    expect(stampFields({ caption: "", song: null }, { lat: 40.7, lng: -73.9 })).toEqual([["lat", "40.7"], ["lng", "-73.9"]]);
    expect(stampFields({ caption: "  hello  ", song }, { lat: 1, lng: 2 })).toEqual([
      ["lat", "1"], ["lng", "2"], ["caption", "hello"], ["songTitle", "Heroes"], ["songArtist", "David Bowie"],
      ["songArtUrl", "https://is1-ssl.mzstatic.com/a.jpg"], ["songSourceId", "1"],
    ]);
    expect(stampFields({ caption: "", song: { ...song, artUrl: null, sourceId: null } }, { lat: 1, lng: 2 }).map((f) => f[0])).toEqual(["lat", "lng", "songTitle", "songArtist"]);
  });
});

describe("choosing a place", () => {
  it("picks a place for you only when exactly one geofence has you inside", () => {
    expect(autoPlace([place({ id: "a" })])?.id).toBe("a");
    expect(autoPlace([place({ id: "a" }), place({ id: "b" })])).toBeNull();
    expect(autoPlace([place({ id: "a", inside: false })])).toBeNull();
    expect(autoPlace([])).toBeNull();
  });

  it("lists places you're inside first, then the nearest ones", () => {
    const ordered = orderPlaces([place({ id: "far", inside: false, distanceM: 250 }), place({ id: "near", inside: false, distanceM: 150 }), place({ id: "here", inside: true, distanceM: 30 })]);
    expect(ordered.map((p) => p.id)).toEqual(["here", "near", "far"]);
  });

  it("says how far away, in km from 1000 m up", () => {
    expect(placeDistanceLabel(place({ inside: true }), formatDistance)).toBe("You're here");
    expect(placeDistanceLabel(place({ inside: false, distanceM: 140, geofenceMeters: 100 }), formatDistance)).toBe("140 m away, need to be within 100 m");
    expect(placeDistanceLabel(place({ inside: false, distanceM: 1815, geofenceMeters: 100 }), formatDistance)).toBe("1.8 km away, need to be within 100 m");
  });
});

describe("stampChanges (editing)", () => {
  const before = { caption: "before", song };
  it("sends nothing when nothing changed, and only what did", () => {
    expect(stampChanges(before, "before", song)).toEqual({});
    expect(stampChanges(before, "  before  ", { ...song })).toEqual({});
    expect(stampChanges(before, "after", song)).toEqual({ caption: "after" });
    expect(stampChanges(before, "before", null)).toEqual({ song: null });
    expect(stampChanges({ caption: "", song: null }, "", { ...song, title: "New" })).toEqual({ song: { title: "New", artist: "David Bowie", artUrl: song.artUrl, sourceId: "1" } });
    expect(stampChanges(before, "", null)).toEqual({ caption: "", song: null });
  });
});
