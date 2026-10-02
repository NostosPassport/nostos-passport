import type { Db } from "@/lib/db";
import { assignSlugs, neighborhoodOf, parseOverpass, type OverpassElement } from "@/lib/osm";

export type ImportResult = { fetched: number; created: number; updated: number; unchanged: number; skippedClaimed: number };

/**
 * Idempotent upsert on osm_id, in one transaction (all or nothing).
 * - New venues start unclaimed with no official cover and no hours ("No official cover posted" / "Hours not posted").
 * - Slugs are assigned once, from OSM data alone (see assignSlugs), and never change afterwards.
 * - On re-import, coordinates always follow OSM (they define the geofence) and the neighborhood is recomputed from
 *   them. Name and address are refreshed only for unclaimed venues: once claimed, the owner owns those facts.
 * - Venues that disappear from OSM are left alone (they may have reports, photos and comments).
 */
export async function importOsmVenues(db: Db, elements: readonly OverpassElement[]): Promise<ImportResult> {
  const venues = parseOverpass(elements);
  return db.$transaction(
    async (tx) => {
      const existing = await tx.venue.findMany({
        select: { id: true, slug: true, osmId: true, name: true, address: true, neighborhood: true, lat: true, lng: true, claims: { where: { status: "APPROVED" }, select: { id: true } } },
      });
      const byOsm = new Map(existing.filter((v) => v.osmId).map((v) => [v.osmId!, v]));
      const reserved = new Set(existing.filter((v) => !v.osmId).map((v) => v.slug));
      const slugs = assignSlugs(venues, reserved);
      const usedSlugs = new Set(existing.map((v) => v.slug));
      const result: ImportResult = { fetched: venues.length, created: 0, updated: 0, unchanged: 0, skippedClaimed: 0 };

      for (const v of venues) {
        const current = byOsm.get(v.osmId);
        if (!current) {
          const slug = slugs.get(v.osmId)!;
          if (usedSlugs.has(slug)) throw new Error(`Slug collision for ${v.osmId}: "${slug}" is already used`);
          usedSlugs.add(slug);
          await tx.venue.create({
            data: { slug, osmId: v.osmId, name: v.name, address: v.address, neighborhood: v.neighborhood, lat: v.lat, lng: v.lng, hours: [], officialCoverCents: null },
          });
          result.created++;
          continue;
        }
        const claimed = current.claims.length > 0;
        const data: { lat?: number; lng?: number; neighborhood?: string; name?: string; address?: string } = {};
        if (current.lat !== v.lat || current.lng !== v.lng) {
          data.lat = v.lat;
          data.lng = v.lng;
        }
        const hood = neighborhoodOf(v.lat, v.lng) ?? current.neighborhood;
        if (hood !== current.neighborhood) data.neighborhood = hood;
        const namesDiffer = current.name !== v.name || current.address !== v.address;
        if (namesDiffer && !claimed) Object.assign(data, { name: v.name, address: v.address });
        if (namesDiffer && claimed) result.skippedClaimed++;
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
