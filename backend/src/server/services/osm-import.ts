import type { Db } from "@/lib/db";
import { assignSlugs, neighborhoodOf, parseOverpass, type OverpassElement } from "@/lib/osm";

export type ImportResult = { fetched: number; created: number; updated: number; unchanged: number };

/**
 * Legacy NYC OSM importer. New product discovery comes from Google Places, but this remains useful for historical
 * OSM rows and development fixtures. The old OSM neighborhood label is stored as generalized `area` metadata.
 */
export async function importOsmVenues(db: Db, elements: readonly OverpassElement[]): Promise<ImportResult> {
  const venues = parseOverpass(elements);
  return db.$transaction(
    async (tx) => {
      const existing = await tx.venue.findMany({
        select: { id: true, slug: true, osmId: true, name: true, address: true, area: true, lat: true, lng: true },
      });
      const byOsm = new Map(existing.filter((v) => v.osmId).map((v) => [v.osmId!, v]));
      const reserved = new Set(existing.filter((v) => !v.osmId).map((v) => v.slug));
      const slugs = assignSlugs(venues, reserved);
      const usedSlugs = new Set(existing.map((v) => v.slug));
      const result: ImportResult = { fetched: venues.length, created: 0, updated: 0, unchanged: 0 };

      for (const v of venues) {
        const current = byOsm.get(v.osmId);
        const area = v.neighborhood || neighborhoodOf(v.lat, v.lng);
        if (!current) {
          const slug = slugs.get(v.osmId)!;
          if (usedSlugs.has(slug)) throw new Error(`Slug collision for ${v.osmId}: "${slug}" is already used`);
          usedSlugs.add(slug);
          await tx.venue.create({
            data: {
              slug,
              osmId: v.osmId,
              name: v.name,
              address: v.address,
              area,
              city: "New York",
              region: "New York",
              country: "United States",
              countryCode: "US",
              timeZone: "America/New_York",
              lat: v.lat,
              lng: v.lng,
            },
          });
          result.created++;
          continue;
        }
        const data: { lat?: number; lng?: number; area?: string | null; name?: string; address?: string } = {};
        if (current.lat !== v.lat || current.lng !== v.lng) {
          data.lat = v.lat;
          data.lng = v.lng;
        }
        if ((area ?? null) !== current.area) data.area = area ?? null;
        if (current.name !== v.name || current.address !== v.address) Object.assign(data, { name: v.name, address: v.address });
        if (Object.keys(data).length) {
          await tx.venue.update({ where: { id: current.id }, data });
          result.updated++;
        } else result.unchanged++;
      }
      return result;
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
}