/**
 * OpenStreetMap venue import: pure parsing. Data © OpenStreetMap contributors, ODbL 1.0.
 * Pulls places worth a stamp via Overpass: bars, restaurants, cafes, theatres, museums, parks and more (see PLACE_KINDS).
 */
export const OSM_ATTRIBUTION = {
  text: "© OpenStreetMap contributors",
  url: "https://www.openstreetmap.org/copyright",
  license: "ODbL-1.0",
} as const;

/** South, west, north, east: a superset of both neighborhoods; parseOverpass keeps only points inside them. */
export const EV_LES_BBOX = [40.7115, -73.9945, 40.7345, -73.972] as const;

type Pt = readonly [lat: number, lng: number];
/**
 * Neighborhood outlines (approximate, drawn from street intersections, checked against a live Overpass pull):
 * - East Village: 14th St (both sides) to Houston St; the Bowery frontage, Cooper Square and 4th Ave (north of Astor Pl)
 *   to Avenue D. Lafayette St, Broadway and University Pl (NoHo / the Village) are outside.
 * - Lower East Side: Houston St to Canal St / East Broadway; the Bowery frontage (incl. Chrystie and Forsyth) to the FDR.
 *   Chinatown / Two Bridges (south-west of Canal & East Broadway) is outside.
 * Houston St is a polyline through its real intersections because it bends.
 */
const HOUSTON: readonly Pt[] = [
  [40.7248, -73.9932], // Bowery (west side)
  [40.7236, -73.9904], // 2nd Ave
  [40.7224, -73.9868], // Avenue A
  [40.7213, -73.9837], // Avenue B
  [40.7203, -73.9808], // Avenue C
  [40.7193, -73.9781], // Avenue D
  [40.7185, -73.975], // FDR Drive
];
export const EAST_VILLAGE: readonly Pt[] = [
  [40.7351, -73.9901], // 14th St (north frontage) & 4th Ave
  [40.7317, -73.9818], // 14th St (north frontage) & 1st Ave
  [40.7297, -73.976], // 14th St (north frontage) & Avenue C/D
  ...[...HOUSTON].reverse(), // Houston St, east to west
  [40.7274, -73.9928], // Bowery (west side) & E 4th St
  [40.7299, -73.9908], // Astor Place / Cooper Square
  [40.7351, -73.9903], // 4th Ave up to 14th St
];
export const LOWER_EAST_SIDE: readonly Pt[] = [
  ...HOUSTON, // Houston St, west to east
  [40.7131, -73.9776], // Grand St & FDR
  [40.7133, -73.9895], // East Broadway & Rutgers St
  [40.7166, -73.9962], // Canal St & Bowery (west side)
];

/** Ray-casting point-in-polygon on lat/lng (fine at neighborhood scale). */
export function inPolygon([lat, lng]: Pt, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i]!;
    const [yj, xj] = poly[j]!;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function neighborhoodOf(lat: number, lng: number): "East Village" | "Lower East Side" | null {
  if (inPolygon([lat, lng], EAST_VILLAGE)) return "East Village";
  if (inPolygon([lat, lng], LOWER_EAST_SIDE)) return "Lower East Side";
  return null;
}

/** What counts as a place: OSM key and the values kept. Bars and clubs are no longer the only kind (Nostos is about anywhere). */
export const PLACE_KINDS = {
  amenity: ["bar", "pub", "nightclub", "restaurant", "cafe", "theatre", "cinema", "arts_centre", "library"],
  leisure: ["park", "garden", "playground"],
  tourism: ["museum", "gallery", "attraction", "viewpoint"],
  shop: ["books"],
} as const;

/** The default import area: Manhattan from the Battery up to 59th St. Pass another bbox to the importer for more. */
export const DEFAULT_BBOX = [40.7, -74.02, 40.77, -73.93] as const;

export function overpassQuery(bbox: readonly [number, number, number, number] = EV_LES_BBOX) {
  const b = bbox.join(",");
  const parts = Object.entries(PLACE_KINDS).map(([key, values]) => `nwr["${key}"~"^(${values.join("|")})$"]["name"](${b});`);
  return `[out:json][timeout:180];(${parts.join("")});out center tags;`;
}

/** The kind of place an element is (its OSM value), or null if it isn't one we keep. */
export function placeKind(tags: Record<string, string>): string | null {
  for (const [key, values] of Object.entries(PLACE_KINDS)) {
    const v = tags[key];
    if (v && (values as readonly string[]).includes(v)) return v;
  }
  return null;
}

export type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type OsmVenue = { osmId: string; name: string; address: string; neighborhood: string; neighborhoodId?: string; lat: number; lng: number; kind: string };
/** Finds the neighborhood containing a point (from the neighborhoods table). Without one, the old East Village and Lower East Side outlines are used. */
export type Locate = (lat: number, lng: number) => { id: string; name: string } | null;

export function slugify(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "venue"
  );
}

const M_PER_DEG = 111_195;
function closeTogether(a: { lat: number; lng: number }, b: { lat: number; lng: number }, meters: number) {
  const dLat = (a.lat - b.lat) * M_PER_DEG;
  const dLng = (a.lng - b.lng) * M_PER_DEG * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng) <= meters;
}
const normName = (n: string) => slugify(n).replace(/-/g, "");

/**
 * Parses Overpass elements into venues: named bars/pubs/nightclubs with coordinates inside the East Village or
 * Lower East Side outlines. OSM sometimes maps one venue twice (a node and a building way): elements with the
 * same normalized name within 60 m collapse to one, chosen deterministically (has a street address, then node
 * over way over relation, then lowest id). Addresses come from addr:* tags; when absent the address is "".
 * Sorted by osmId.
 */
export function parseOverpass(elements: readonly OverpassElement[], locate?: Locate): OsmVenue[] {
  const candidates: (OsmVenue & { rank: [number, number, number] })[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = (tags.name ?? "").trim().replace(/\s+/g, " ");
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!name || lat == null || lng == null) continue;
    const kind = placeKind(tags);
    if (!kind) continue;
    const hood = locate ? locate(lat, lng) : null;
    const neighborhood = locate ? hood?.name : neighborhoodOf(lat, lng);
    if (!neighborhood) continue;
    const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ").trim().slice(0, 120);
    candidates.push({
      osmId: `${el.type}/${el.id}`, name: name.slice(0, 80), address: street, neighborhood, ...(hood ? { neighborhoodId: hood.id } : {}), lat, lng, kind,
      rank: [street ? 0 : 1, el.type === "node" ? 0 : el.type === "way" ? 1 : 2, el.id],
    });
  }
  candidates.sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.rank[2] - b.rank[2]);
  const kept: typeof candidates = [];
  for (const c of candidates) {
    if (!kept.some((k) => normName(k.name) === normName(c.name) && closeTogether(k, c, 60))) kept.push(c);
  }
  return kept
    .map((c): OsmVenue => ({ osmId: c.osmId, name: c.name, address: c.address, neighborhood: c.neighborhood, ...(c.neighborhoodId ? { neighborhoodId: c.neighborhoodId } : {}), lat: c.lat, lng: c.lng, kind: c.kind }))
    .sort((a, b) => (a.osmId < b.osmId ? -1 : a.osmId > b.osmId ? 1 : 0));
}

/**
 * Deterministic slugs from the OSM data itself: the name's slug if no other venue in the import shares it, else
 * `<slug>-<n|w|r><id>` for every venue with that name. `reserved` holds slugs owned by non-OSM venues (demo or
 * manually created), which also force the suffix. Already-imported venues keep their slug forever (see import).
 */
export function assignSlugs(venues: readonly OsmVenue[], reserved: ReadonlySet<string> = new Set()): Map<string, string> {
  const counts = new Map<string, number>();
  for (const v of venues) counts.set(slugify(v.name), (counts.get(slugify(v.name)) ?? 0) + 1);
  const out = new Map<string, string>();
  for (const v of venues) {
    const base = slugify(v.name);
    const [type, id] = v.osmId.split("/") as [string, string];
    out.set(v.osmId, counts.get(base)! > 1 || reserved.has(base) ? `${base}-${type[0]}${id}` : base);
  }
  return out;
}
