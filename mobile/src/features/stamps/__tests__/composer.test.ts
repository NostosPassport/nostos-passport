import { hasContent, stampChanges, orderPlaces, placeDistanceLabel, stampFields, stampProblem, CAPTION_MAX } from "../composer";
import { formatDistance } from "@/lib/format";

const song = { title: "Heroes", artist: "David Bowie", artUrl: "https://is1-ssl.mzstatic.com/a.jpg", sourceId: "1" };
const place = (over: Partial<{ id: string; inside: boolean; distanceM: number; geofenceMeters: number }>) =>
  ({ id: "p", slug: "p", name: "P", address: "", neighborhood: "East Village", lat: 1, lng: 2, geofenceMeters: 100, neighborhoodId: null, fromOsm: false, googlePlaceId: null, category: null, cuisines: [], primaryType: null, businessStatus: null, distanceM: 10, inside: true, ...over });

describe("stamp content rule", () => {
  it("needs at least one of photo, caption or song", () => {
    expect(hasContent({ photoUris: [], caption: "", song: null })).toBe(false);
    expect(hasContent({ photoUris: [], caption: "   ", song: null })).toBe(false);
    expect(hasContent({ photoUris: ["file://p.jpg"], caption: "", song: null })).toBe(true);
    expect(hasContent({ photoUris: [], caption: "hi", song: null })).toBe(true);
    expect(hasContent({ photoUris: [], caption: "", song })).toBe(true);
  });

  it("says what's missing, in order: place first, then content, then length", () => {
    const empty = { photoUris: [], caption: "", song: null };
    expect(stampProblem(empty, null)).toBe("Choose a place.");
    expect(stampProblem(empty, "p1")).toBe("Add a photo, a caption or a song.");
    expect(stampProblem({ ...empty, caption: "x".repeat(CAPTION_MAX + 1) }, "p1")).toMatch(/280 characters/);
    expect(stampProblem({ ...empty, caption: "ok" }, "p1")).toBeNull();
  });
});

describe("stampFields", () => {
  const visit = new Date("2026-10-08T16:00:00.000Z");
  it("sends optional coordinates only for Now, and visit date only for Past", () => {
    expect(stampFields({ caption: "", song: null }, "now", visit, { lat: 40.7, lng: -73.9 })).toEqual([
      ["mode", "now"], ["lat", "40.7"], ["lng", "-73.9"],
    ]);
    expect(stampFields({ caption: "", song: null }, "now", visit, null)).toEqual([["mode", "now"]]);
    expect(stampFields({ caption: "", song: null }, "past", visit, { lat: 1, lng: 2 })).toEqual([
      ["mode", "past"], ["visitedAt", visit.toISOString()],
    ]);
  });

  it("includes only optional memory fields that exist", () => {
    expect(stampFields({ caption: "  hello  ", song }, "now", visit, { lat: 1, lng: 2 })).toEqual([
      ["mode", "now"], ["lat", "1"], ["lng", "2"], ["caption", "hello"], ["songTitle", "Heroes"], ["songArtist", "David Bowie"],
      ["songArtUrl", "https://is1-ssl.mzstatic.com/a.jpg"], ["songSourceId", "1"],
    ]);
    expect(stampFields({ caption: "", song: { ...song, artUrl: null, sourceId: null } }, "now", visit, null).map((f) => f[0])).toEqual(["mode", "songTitle", "songArtist"]);
  });
});

describe("choosing a place", () => {
  it("lists places you're inside first, then the nearest ones", () => {
    const ordered = orderPlaces([place({ id: "far", inside: false, distanceM: 250 }), place({ id: "near", inside: false, distanceM: 150 }), place({ id: "here", inside: true, distanceM: 30 })]);
    expect(ordered.map((p) => p.id)).toEqual(["here", "near", "far"]);
  });

  it("uses verification-positive language without blocking distant places", () => {
    expect(placeDistanceLabel(place({ inside: true }), formatDistance)).toBe("Visit can be verified");
    expect(placeDistanceLabel(place({ inside: false, distanceM: 140 }), formatDistance)).toBe("140 m away");
    expect(placeDistanceLabel(place({ inside: false, distanceM: 1815 }), formatDistance)).toBe("1.8 km away");
  });
});

describe("stampChanges (editing)", () => {
  const original = new Date("2026-10-08T16:00:00.000Z");
  const before = { caption: "before", song, visitedAt: original.toISOString() };
  it("sends nothing when nothing changed, and only what did", () => {
    expect(stampChanges(before, "before", song, original)).toEqual({});
    expect(stampChanges(before, "  before  ", { ...song }, original)).toEqual({});
    expect(stampChanges(before, "after", song, original)).toEqual({ caption: "after" });
    expect(stampChanges(before, "before", null, original)).toEqual({ song: null });
    expect(stampChanges({ caption: "", song: null, visitedAt: original.toISOString() }, "", { ...song, title: "New" }, original)).toEqual({ song: { title: "New", artist: "David Bowie", artUrl: song.artUrl, sourceId: "1" } });
    expect(stampChanges(before, "", null, original)).toEqual({ caption: "", song: null });
  });

  it("sends a visit-date edit independently", () => {
    const changed = new Date("2026-10-07T16:00:00.000Z");
    expect(stampChanges(before, "before", song, changed)).toEqual({ visitedAt: changed.toISOString() });
  });
});
