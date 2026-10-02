import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { assignSlugs, neighborhoodOf, overpassQuery, parseOverpass, slugify, type OverpassElement } from "@/lib/osm";

const sample = (JSON.parse(readFileSync("tests/fixtures/overpass-sample.json", "utf8")) as { elements: OverpassElement[] }).elements;

describe("OSM parsing", () => {
  it("queries bars, pubs and nightclubs in a box covering both neighborhoods", () => {
    const q = overpassQuery();
    expect(q).toContain('"amenity"~"^(bar|pub|nightclub)$"');
    expect(q).toContain("40.7115,-73.9945,40.7345,-73.972");
    expect(q).toContain("out center tags");
  });

  it("keeps named bars/pubs/nightclubs inside EV/LES, uses way centers, blank address when unmapped", () => {
    const venues = parseOverpass(sample);
    expect(venues.map((v) => v.osmId)).toEqual(["node/1001", "node/1002", "node/1006", "way/2001"]);
    expect(venues.find((v) => v.osmId === "way/2001")).toMatchObject({ lat: 40.721, lng: -73.986, kind: "pub" });
    expect(venues.find((v) => v.osmId === "node/1001")).toMatchObject({ address: "12 Avenue A", neighborhood: "East Village" });
    expect(venues.find((v) => v.osmId === "node/1002")).toMatchObject({ address: "", neighborhood: "Lower East Side" });
  });

  it("classifies real venues from a live Overpass pull (2026-09-24)", () => {
    const cases: [string, number, number, string | null][] = [
      ["Beauty Bar, 231 E 14th St", 40.7329, -73.9858, "East Village"],
      ["Webster Hall, 125 E 11th St", 40.7318, -73.9891, "East Village"],
      ["Yawning Cobra, 356 Bowery", 40.7269, -73.9919, "East Village"],
      ["Swift Hibernian Lounge, 34 E 4th St", 40.7273, -73.9923, "East Village"],
      ["Nuyorican Poets Cafe, E 3rd St", 40.7219, -73.9832, "East Village"],
      ["Home Sweet Home, 131 Chrystie St", 40.7195, -73.9934, "Lower East Side"],
      ["David's Bar, 76 Forsyth St", 40.7172, -73.9933, "Lower East Side"],
      ["The Highlight Room, 145 Bowery", 40.7189, -73.9941, "Lower East Side"],
      ["169 Bar, 169 East Broadway", 40.7139, -73.9898, "Lower East Side"],
      ["Reservoir, 70 University Pl", 40.7332, -73.9936, null],
      ["Joe's Pub, 425 Lafayette St", 40.7292, -73.9916, null],
      ["Great Jones Distilling, 686 Broadway", 40.7279, -73.9942, null],
      ["Jac's on Bond, 26 Bond St", 40.7265, -73.9936, null],
      ["Mr. Fong's, 40 Market St", 40.7124, -73.9943, null],
      ["Sake Bar Asoko, 127 East Broadway", 40.7138, -73.992, null],
    ];
    for (const [name, lat, lng, want] of cases) expect(neighborhoodOf(lat, lng), name).toBe(want);
  });

  it("uses real neighborhood outlines: NoHo/Village and Chinatown are out, and Houston splits EV/LES", () => {
    expect(neighborhoodOf(40.7219, -73.9832)).toBe("East Village"); // E 3rd St between Aves B & C
    expect(neighborhoodOf(40.7185, -73.988)).toBe("Lower East Side"); // Delancey & Essex
    expect(neighborhoodOf(40.7337, -73.9934)).toBeNull(); // University Pl (Village)
    expect(neighborhoodOf(40.7263, -73.9942)).toBeNull(); // Lafayette / Bond (NoHo)
    expect(neighborhoodOf(40.7137, -73.9937)).toBeNull(); // East Broadway (Chinatown)
    const outside: OverpassElement = { type: "node", id: 9, lat: 40.7337, lon: -73.9934, tags: { amenity: "bar", name: "Village Spot" } };
    expect(parseOverpass([outside])).toEqual([]);
  });

  it("collapses the same venue mapped twice (node + building) deterministically", () => {
    const dup: OverpassElement[] = [
      { type: "way", id: 247, center: { lat: 40.7266, lon: -73.9846 }, tags: { amenity: "bar", name: "Yawning Cobra", "addr:housenumber": "1", "addr:street": "Avenue A" } },
      { type: "node", id: 1233, lat: 40.7265, lon: -73.9845, tags: { amenity: "bar", name: "yawning  cobra" } },
      { type: "node", id: 555, lat: 40.7201, lon: -73.9888, tags: { amenity: "bar", name: "Yawning Cobra" } }, // far away: a different bar
    ];
    const out = parseOverpass(dup);
    expect(out.map((v) => v.osmId).sort()).toEqual(["node/555", "way/247"]); // the one with an address wins
    expect(parseOverpass([...dup].reverse())).toEqual(out);
  });

  it("makes deterministic slugs from OSM data alone", () => {
    expect(slugify("Café Ñandú & Friends")).toBe("cafe-nandu-and-friends");
    expect(slugify("McSorley's Old Ale House")).toBe("mcsorleys-old-ale-house");
    expect(slugify("!!!")).toBe("venue");
    const venues = parseOverpass(sample);
    const slugs = assignSlugs(venues);
    // Two venues named "Test Tavern": both get suffixes, independent of import order or DB state.
    expect(slugs.get("node/1001")).toBe("test-tavern-n1001");
    expect(slugs.get("way/2001")).toBe("test-tavern-w2001");
    expect(slugs.get("node/1002")).toBe("basement-club");
    expect(assignSlugs([...venues].reverse())).toEqual(slugs);
    expect(assignSlugs(venues, new Set(["basement-club"])).get("node/1002")).toBe("basement-club-n1002");
  });
});
