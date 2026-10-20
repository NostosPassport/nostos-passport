/**
 * OpenStreetMap venue import: pure parsing. Data © OpenStreetMap contributors, ODbL 1.0.
 * New product discovery uses Google Places; this importer remains for development and historical OSM rows.
 */
export const OSM_ATTRIBUTION = {
  text: "© OpenStreetMap contributors",
  url: "https://www.openstreetmap.org/copyright",
  license: "ODbL-1.0",
} as const;

export const PLACE_KINDS = {
  amenity: ["bar", "pub", "nightclub", "restaurant", "cafe", "theatre", "cinema", "arts_centre", "library"],
  leisure: ["park", "garden", "playground"],
  tourism: ["museum", "gallery", "attraction", "viewpoint"],
  shop: ["books"],
} as const;

export const DEFAULT_BBOX = [40.7, -74.02, 40.77, -73.93] as const;

export function overpassQuery(bbox: readonly [number, number, number, number] = DEFAULT_BBOX) {
  const b = bbox.join(",");
  const parts = Object.entries(PLACE_KINDS).map(([key, values]) => `nwr["${key}"~"^(${values.join("|")})$"]["name"](${b});`);
  return `[out:json][timeout:180];(${parts.join("")});out center tags;`;
}

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

export type OsmVenue = { osmId: string; name: string; address: string; area: string | null; lat: number; lng: number; kind: string };

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

export function parseOverpass(elements: readonly OverpassElement[]): OsmVenue[] {
  const candidates: (OsmVenue & { rank: [number, number, number] })[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = (tags.name ?? "").trim().replace(/\s+/g, " ");
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!name || lat == null || lng == null) continue;
    const kind = placeKind(tags);
    if (!kind) continue;
    const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ").trim().slice(0, 120);
    const area = (tags["addr:neighbourhood"] ?? tags["addr:suburb"] ?? "").trim().slice(0, 120) || null;
    candidates.push({
      osmId: `${el.type}/${el.id}`,
      name: name.slice(0, 80),
      address: street,
      area,
      lat,
      lng,
      kind,
      rank: [street ? 0 : 1, el.type === "node" ? 0 : el.type === "way" ? 1 : 2, el.id],
    });
  }
  candidates.sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.rank[2] - b.rank[2]);
  const kept: typeof candidates = [];
  for (const c of candidates) {
    if (!kept.some((k) => normName(k.name) === normName(c.name) && closeTogether(k, c, 60))) kept.push(c);
  }
  return kept
    .map((c): OsmVenue => ({ osmId: c.osmId, name: c.name, address: c.address, area: c.area, lat: c.lat, lng: c.lng, kind: c.kind }))
    .sort((a, b) => (a.osmId < b.osmId ? -1 : a.osmId > b.osmId ? 1 : 0));
}

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
