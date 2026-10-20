import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { assignSlugs, overpassQuery, parseOverpass, slugify, type OverpassElement } from "@/lib/osm";

const sample = (JSON.parse(readFileSync("tests/fixtures/overpass-sample.json", "utf8")) as { elements: OverpassElement[] }).elements;

describe("OSM parsing", () => {
  it("queries supported place kinds inside the requested bounding box", () => {
    const q = overpassQuery();
    expect(q).toContain('"amenity"~"^(bar|pub|nightclub|restaurant|cafe|');
    expect(q).toContain('"leisure"~"^(park|garden|playground)$"');
    expect(q).toContain('"tourism"~');
    expect(q).toContain('"shop"~"^(books)$"');
    expect(q).toContain("40.7,-74.02,40.77,-73.93");
    expect(q).toContain("out center tags");
  });

  it("keeps named supported places regardless of NYC neighborhood membership", () => {
    const venues = parseOverpass(sample);
    expect(venues.map((v) => v.osmId)).toEqual([
      "node/1001",
      "node/1002",
      "node/1004",
      "node/1005",
      "node/1006",
      "way/2001",
    ]);
    expect(venues.find((v) => v.osmId === "way/2001")).toMatchObject({ lat: 40.721, lng: -73.986, kind: "pub" });
    expect(venues.find((v) => v.osmId === "node/1001")).toMatchObject({ address: "12 Avenue A", area: null });
    expect(venues.find((v) => v.osmId === "node/1004")).toMatchObject({ name: "Midtown Place", area: null });
  });

  it("keeps optional OSM area metadata without requiring it", () => {
    const withArea: OverpassElement = {
      type: "node",
      id: 7,
      lat: 41.9028,
      lon: 12.4964,
      tags: { amenity: "restaurant", name: "Roman Spot", "addr:neighbourhood": "Monti" },
    };
    expect(parseOverpass([withArea])[0]).toMatchObject({ name: "Roman Spot", area: "Monti" });
  });

  it("collapses the same venue mapped twice deterministically", () => {
    const dup: OverpassElement[] = [
      { type: "way", id: 247, center: { lat: 40.7266, lon: -73.9846 }, tags: { amenity: "bar", name: "Yawning Cobra", "addr:housenumber": "1", "addr:street": "Avenue A" } },
      { type: "node", id: 1233, lat: 40.7265, lon: -73.9845, tags: { amenity: "bar", name: "yawning  cobra" } },
      { type: "node", id: 555, lat: 40.7201, lon: -73.9888, tags: { amenity: "bar", name: "Yawning Cobra" } },
    ];
    const out = parseOverpass(dup);
    expect(out.map((v) => v.osmId).sort()).toEqual(["node/555", "way/247"]);
    expect(parseOverpass([...dup].reverse())).toEqual(out);
  });

  it("makes deterministic slugs from OSM data alone", () => {
    expect(slugify("Café Ñandú & Friends")).toBe("cafe-nandu-and-friends");
    expect(slugify("McSorley's Old Ale House")).toBe("mcsorleys-old-ale-house");
    expect(slugify("!!!")).toBe("venue");
    const venues = parseOverpass(sample);
    const slugs = assignSlugs(venues);
    expect(slugs.get("node/1001")).toBe("test-tavern-n1001");
    expect(slugs.get("way/2001")).toBe("test-tavern-w2001");
    expect(slugs.get("node/1002")).toBe("basement-club");
    expect(assignSlugs([...venues].reverse())).toEqual(slugs);
    expect(assignSlugs(venues, new Set(["basement-club"])).get("node/1002")).toBe("basement-club-n1002");
  });
});
