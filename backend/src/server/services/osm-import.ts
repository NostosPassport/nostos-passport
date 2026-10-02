import type { Db } from "@/lib/db";
import { assignSlugs, neighborhoodOf, parseOverpass, type OverpassElement } from "@/lib/osm";
import { loadNeighborhoods, locate } from "@/server/services/neighborhoods";

export type ImportResult = { fetched: number; created: number; updated: number; unchanged: number };

/**
 * Idempotent upsert on osm_id, in one transaction (all or nothing).
 * - New places get the default geofence.
 * - Slugs are assigned once, from OSM data alone (see assignSlugs), and never change afterwards.
 * - On re-import, coordinates always follow OSM (they define the geofence) and the neighborhood is recomputed from
 *   them. Name and address follow OSM.
 * - Places that disappear from OSM are left alone (they may have stamps).
 */
export async function importOsmVenues(db: Db, elements: readonly OverpassElement[]): Promise<ImportResult> {
  // With neighborhood boundaries loaded, any place inside NYC is kept and filed under its neighborhood.
  const hoods = await loadNeighborhoods(db);
  const venues = parseOverpass(elements, hoods.length ? (lat, lng) => locate(hoods, lat, lng) : undefined);
  return db.$transaction(
    async (tx) => {
      const existing = await tx.venue.findMany({
        select: { id: true, slug: true, osmId: true, name: true, address: true, neighborhood: true, lat: true, lng: true, neighborhoodId: true },
      });
      const byOsm = new Map(existing.filter((v) => v.osmId).map((v) => [v.osmId!, v]));
      const reserved = new Set(existing.filter((v) => !v.osmId).map((v) => v.slug));
      const slugs = assignSlugs(venues, reserved);
      const usedSlugs = new Set(existing.map((v) => v.slug));
      const result: ImportResult = { fetched: venues.length, created: 0, updated: 0, unchanged: 0 };

      for (const v of venues) {
        const current = byOsm.get(v.osmId);
        if (!current) {
          const slug = slugs.get(v.osmId)!;
          if (usedSlugs.has(slug)) throw new Error(`Slug collision for ${v.osmId}: "${slug}" is already used`);
          usedSlugs.add(slug);
          await tx.venue.create({
            data: { slug, osmId: v.osmId, name: v.name, address: v.address, neighborhood: v.neighborhood, lat: v.lat, lng: v.lng, neighborhoodId: v.neighborhoodId ?? null },
          });
          result.created++;
          continue;
        }
        const data: { lat?: number; lng?: number; neighborhood?: string; neighborhoodId?: string; name?: string; address?: string } = {};
        if (current.lat !== v.lat || current.lng !== v.lng) {
          data.lat = v.lat;
          data.lng = v.lng;
        }
        const hood = v.neighborhoodId ? v.neighborhood : (neighborhoodOf(v.lat, v.lng) ?? current.neighborhood);
        if (hood !== current.neighborhood) data.neighborhood = hood;
        if (v.neighborhoodId && v.neighborhoodId !== current.neighborhoodId) data.neighborhoodId = v.neighborhoodId;
        const namesDiffer = current.name !== v.name || current.address !== v.address;
        if (namesDiffer) Object.assign(data, { name: v.name, address: v.address });
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
