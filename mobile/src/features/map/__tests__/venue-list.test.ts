import type { MapVenue } from "@/api/contracts";
import { markerLabel } from "../venue-marker";
import { liveCount, searchVenues, sortVenues, summaryLine } from "../venue-list";

jest.mock("react-native-maps", () => ({ Marker: () => null }));

const base: MapVenue = {
  id: "", slug: "", name: "", address: "", neighborhood: "East Village", lat: 40.72, lng: -73.98,
  vibe: "NO_DATA", vibeReports: 0, hereNow: 0, goingTonight: 0, friendsGoing: 0, activity: 0, promoted: false, fromOsm: true,
};
const v = (o: Partial<MapVenue>): MapVenue => ({ ...base, id: o.name ?? "x", slug: (o.name ?? "x").toLowerCase(), ...o });

const velvet = v({ name: "Velvet", vibe: "PACKED", activity: 12, goingTonight: 3, lat: 40.7265, lng: -73.9815, address: "1 Avenue A" });
const cafe = v({ name: "Café Mogador", vibe: "CHILL", activity: 3, goingTonight: 30, lat: 40.7271, lng: -73.9846, address: "101 St Marks Pl" });
const dive = v({ name: "Sophie's", vibe: "NO_DATA", activity: 0, goingTonight: 0, promoted: true, lat: 40.7223, lng: -73.9837, neighborhood: "Lower East Side" });
const all = [dive, cafe, velvet];

describe("sortVenues", () => {
  it("Live now sorts by the API's activity", () => {
    expect(sortVenues(all, "live", null).map((x) => x.name)).toEqual(["Velvet", "Café Mogador", "Sophie's"]);
  });
  it("Going tonight sorts by goingTonight", () => {
    expect(sortVenues(all, "going", null).map((x) => x.name)).toEqual(["Café Mogador", "Velvet", "Sophie's"]);
  });
  it("Nearby sorts by distance from the user", () => {
    const nearSophies = { lat: 40.7222, lng: -73.9838 };
    expect(sortVenues(all, "nearby", nearSophies)[0].name).toBe("Sophie's");
  });
  it("Promoted never changes the order", () => {
    const promotedVelvet = { ...velvet, promoted: true };
    const plainDive = { ...dive, promoted: false };
    expect(sortVenues([plainDive, cafe, promotedVelvet], "live", null).map((x) => x.id)).toEqual(sortVenues(all, "live", null).map((x) => x.id));
  });
  it("does not mutate its input", () => {
    const input = [...all];
    sortVenues(input, "live", null);
    expect(input).toEqual(all);
  });
});

describe("searchVenues", () => {
  it("matches name, address and neighborhood, ignoring accents and apostrophes", () => {
    expect(searchVenues(all, "cafe").map((x) => x.name)).toEqual(["Café Mogador"]);
    expect(searchVenues(all, "sophies").map((x) => x.name)).toEqual(["Sophie's"]);
    expect(searchVenues(all, "st marks").map((x) => x.name)).toEqual(["Café Mogador"]);
    expect(searchVenues(all, "lower east").map((x) => x.name)).toEqual(["Sophie's"]);
  });
  it("ranks name prefix matches first", () => {
    const vel = v({ name: "The Velvet Room" });
    expect(searchVenues([vel, velvet], "velvet").map((x) => x.name)).toEqual(["Velvet", "The Velvet Room"]);
  });
  it("returns everything for an empty query", () => {
    expect(searchVenues(all, "  ")).toHaveLength(3);
  });
});

describe("summary", () => {
  it("counts live venues", () => {
    expect(liveCount(all)).toBe(2);
    expect(summaryLine(all)).toBe("2 spots live nearby");
    expect(summaryLine([dive])).toBe("No live reports nearby yet");
    expect(summaryLine([velvet])).toBe("1 spot live nearby");
  });
  it("labels markers in words for VoiceOver", () => {
    expect(markerLabel({ ...velvet, friendsGoing: 2 })).toBe("Velvet, Packed, 2 friends going");
    expect(markerLabel(dive)).toBe("Sophie's, no reports in the last hour, promoted");
  });
});
