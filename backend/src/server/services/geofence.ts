import type { Prisma } from "@prisma/client";
import { distanceMeters, GEOFENCE_METERS, isValidLatLng, withinGeofence } from "@/lib/geo";
import { badRequest, forbidden, tooMany } from "@/server/errors";

/** One stamp per person per place per 15 minutes. */
export const STAMP_COOLDOWN_MS = 15 * 60_000;

/** Server-side geofence check from submitted coordinates (rule 1). The radius is the place's own. */
export function assertInsideGeofence(pos: { lat: number; lng: number }, place: { lat: number; lng: number; geofenceMeters?: number }) {
  if (!isValidLatLng(pos)) throw badRequest("Invalid coordinates");
  const radius = place.geofenceMeters ?? GEOFENCE_METERS;
  if (!withinGeofence(pos, place, radius)) {
    const d = Math.round(distanceMeters(pos, place));
    throw forbidden(`You need to be within ${radius} m of this place to stamp it (you're ${d} m away)`);
  }
}

/**
 * Serializes concurrent stamps for the same (user, place) so the cooldown can't be raced. Must run inside a transaction.
 */
export async function lockAndCheckCooldown(tx: Prisma.TransactionClient, key: { userId: string; venueId: string }, now: Date) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${key.userId}:${key.venueId}:STAMP`}))`;
  const since = new Date(now.getTime() - STAMP_COOLDOWN_MS);
  const last = await tx.photo.findFirst({ where: { userId: key.userId, venueId: key.venueId, createdAt: { gt: since } }, orderBy: { createdAt: "desc" } });
  if (last) {
    const waitMin = Math.ceil((last.createdAt.getTime() + STAMP_COOLDOWN_MS - now.getTime()) / 60_000);
    throw tooMany(`You already stamped this place. Try again in ${waitMin} min.`);
  }
}
