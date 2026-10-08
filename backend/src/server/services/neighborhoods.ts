/**
 * Collections: neighborhoods and the passport's progress through them. Boundaries are NYC's public Neighborhood Tabulation
 * Areas (see DECISIONS.md). Progress is visited places over total places in the neighborhood, counting only your own live
 * stamps made inside the geofence (App Review stamps don't count). Finishing a set of at least MIN_SET places earns a
 * completion marker that is never taken back. Everything here is owner only.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { pointInRing } from "@/lib/geo";
import type { Actor } from "@/server/actor";
import { requireSignedIn } from "@/server/permissions";

export const MIN_SET = 3;

type Ring = [number, number][];
export type NeighborhoodFile = { code: string; name: string; borough: string; rings: Ring[] }[];

const bboxOf = (rings: Ring[]) => {
  const pts = rings.flat();
  return { minLat: Math.min(...pts.map((p) => p[1])), maxLat: Math.max(...pts.map((p) => p[1])), minLng: Math.min(...pts.map((p) => p[0])), maxLng: Math.max(...pts.map((p) => p[0])) };
};

export async function importNeighborhoods(db: Db, file: NeighborhoodFile | string = path.resolve(process.cwd(), "prisma/data/neighborhoods.json")) {
  const data: NeighborhoodFile = typeof file === "string" ? (JSON.parse(readFileSync(file, "utf8")) as NeighborhoodFile) : file;
  for (const n of data) {
    const row = { name: n.name, borough: n.borough, boundary: n.rings as unknown as Prisma.InputJsonValue, ...bboxOf(n.rings) };
    await db.neighborhood.upsert({ where: { id: n.code }, create: { id: n.code, ...row }, update: row });
  }
  return data.length;
}

type Loaded = { id: string; name: string; rings: Ring[]; minLat: number; maxLat: number; minLng: number; maxLng: number };
export async function loadNeighborhoods(db: Db): Promise<Loaded[]> {
  return (await db.neighborhood.findMany()).map((n) => ({ id: n.id, name: n.name, rings: n.boundary as unknown as Ring[], minLat: n.minLat, maxLat: n.maxLat, minLng: n.minLng, maxLng: n.maxLng }));
}

export function locate(list: readonly Loaded[], lat: number, lng: number): Loaded | null {
  for (const n of list) {
    if (lat < n.minLat || lat > n.maxLat || lng < n.minLng || lng > n.maxLng) continue;
    if (n.rings.some((r) => pointInRing({ lat, lng }, r))) return n;
  }
  return null;
}

export async function assignNeighborhoods(db: Db, list?: Loaded[]) {
  const hoods = list ?? (await loadNeighborhoods(db));
  if (!hoods.length) return 0;
  let n = 0;
  for (const v of await db.venue.findMany({ where: { neighborhoodId: null }, select: { id: true, lat: true, lng: true } })) {
    const h = locate(hoods, v.lat, v.lng);
    if (!h) continue;
    await db.venue.update({ where: { id: v.id }, data: { neighborhoodId: h.id, neighborhood: h.name } });
    n++;
  }
  return n;
}

export type Progress = { neighborhoodId: string; name: string; borough: string; visited: number; total: number; complete: boolean; completedAt: Date | null };

async function progressRows(db: Db, userId: string, neighborhoodIds?: string[]): Promise<Progress[]> {
  const where = neighborhoodIds ? { id: { in: neighborhoodIds } } : { places: { some: {} } };
  const hoods = await db.neighborhood.findMany({ where, select: { id: true, name: true, borough: true, _count: { select: { places: true } } } });
  const visited = await db.photo.findMany({
    where: { userId, removedAt: null, countable: true, venue: { neighborhoodId: neighborhoodIds ? { in: neighborhoodIds } : { not: null } } },
    distinct: ["venueId"],
    select: { venueId: true, venue: { select: { neighborhoodId: true } } },
  });
  const done = await db.neighborhoodCompletion.findMany({ where: { userId }, select: { neighborhoodId: true, completedAt: true } });
  const counts = new Map<string, number>();
  for (const v of visited) counts.set(v.venue.neighborhoodId!, (counts.get(v.venue.neighborhoodId!) ?? 0) + 1);
  const completed = new Map(done.map((d) => [d.neighborhoodId, d.completedAt]));
  return hoods.map((h) => {
    const total = h._count.places;
    const v = counts.get(h.id) ?? 0;
    return { neighborhoodId: h.id, name: h.name, borough: h.borough, visited: v, total, complete: completed.has(h.id) || (total >= MIN_SET && v >= total), completedAt: completed.get(h.id) ?? null };
  });
}

export async function recordProgress(tx: Prisma.TransactionClient, userId: string, venueId: string, stampId: string, now: Date) {
  const venue = await tx.venue.findUnique({ where: { id: venueId }, select: { neighborhoodId: true } });
  if (!venue?.neighborhoodId) return null;
  const before = await db_progress(tx, userId, venue.neighborhoodId, stampId);
  const after = await db_progress(tx, userId, venue.neighborhoodId);
  const had = await tx.neighborhoodCompletion.findUnique({ where: { userId_neighborhoodId: { userId, neighborhoodId: venue.neighborhoodId } } });
  let justCompleted = false;
  if (!had && after.total >= MIN_SET && after.visited >= after.total) {
    await tx.neighborhoodCompletion.create({ data: { userId, neighborhoodId: venue.neighborhoodId, completedAt: now, stampId } });
    justCompleted = true;
  }
  return { ...after, complete: Boolean(had) || justCompleted, justCompleted, newPlace: after.visited > before.visited };
}

async function db_progress(tx: Prisma.TransactionClient, userId: string, neighborhoodId: string, exceptStamp?: string) {
  const h = await tx.neighborhood.findUniqueOrThrow({ where: { id: neighborhoodId }, select: { id: true, name: true, borough: true, _count: { select: { places: true } } } });
  const visited = await tx.photo.findMany({
    where: { userId, removedAt: null, countable: true, venue: { neighborhoodId }, ...(exceptStamp ? { id: { not: exceptStamp } } : {}) },
    distinct: ["venueId"],
    select: { venueId: true },
  });
  return { neighborhoodId: h.id, name: h.name, borough: h.borough, visited: visited.length, total: h._count.places };
}

export async function neighborhoodIndex(db: Db, actor: Actor | null) {
  const me = requireSignedIn(actor);
  const rows = await progressRows(db, me.userId);
  return {
    neighborhoods: rows
      .sort((a, b) => Number(b.visited > 0) - Number(a.visited > 0) || b.visited / b.total - a.visited / a.total || a.name.localeCompare(b.name))
      .map((r) => ({ ...r, percent: r.total ? Math.round((r.visited / r.total) * 100) : 0 })),
    totals: {
      neighborhoodsStarted: rows.filter((r) => r.visited > 0).length,
      neighborhoodsComplete: rows.filter((r) => r.complete).length,
    },
  };
}
