/**
 * Presence ("here now") and RSVPs ("going tonight"). Follows and profiles are in people.ts.
 *
 * Privacy: individual presence is never shown to anyone, only counts. Your "going tonight" plans are visible
 * only to yourself and to *mutual* follows (you follow them and they follow you back). A one-way follow
 * needs no consent, so it must not reveal where someone will be tonight.
 * Checks and balances: a venue's own accounts can't inflate its here-now or going counts.
 */
import { z } from "zod";
import type { Db } from "@/lib/db";
import { distanceMeters, GEOFENCE_METERS, isValidLatLng, withinGeofence } from "@/lib/geo";
import { nightKey } from "@/lib/time";
import type { Actor } from "@/server/actor";
import { badRequest, forbidden, notFound } from "@/server/errors";
import { ownsVenue, requireSignedIn } from "@/server/permissions";
import { PRESENCE_TTL_MS } from "@/server/services/venues";

export const presenceSchema = z.object({ lat: z.number().finite(), lng: z.number().finite() }).strict();

/**
 * Called when a signed-in user opens a venue page (and every few minutes while it stays open).
 * Inside the 100m geofence: upsert their single presence row to this venue with last_seen_at = now.
 * Outside: no write; a presence at this venue simply expires 45 minutes after its last refresh.
 */
export async function recordPresence(db: Db, actor: Actor | null, venueId: string, raw: unknown, now = new Date()) {
  const me = requireSignedIn(actor);
  const pos = presenceSchema.parse(raw);
  if (!isValidLatLng(pos)) throw badRequest("Invalid coordinates");
  const venue = await db.venue.findUnique({ where: { id: venueId }, select: { id: true, lat: true, lng: true } });
  if (!venue) throw notFound("Venue not found");
  // Server-computed distance, so the app can dim its report bar ("You're 140 m away") without re-implementing the geofence.
  const distanceM = Math.round(distanceMeters(pos, venue));
  const geo = { distanceM, radiusM: GEOFENCE_METERS };
  if (ownsVenue(me, venueId)) return { here: false as const, reason: "venue_account" as const, ...geo };
  if (!withinGeofence(pos, venue) && !me.geofenceExempt) {
    // Left the venue: stop counting them here immediately rather than waiting out the 45 minutes.
    await db.presence.deleteMany({ where: { userId: me.userId, venueId } });
    return { here: false as const, reason: "outside" as const, ...geo };
  }
  await db.presence.upsert({
    where: { userId: me.userId },
    create: { userId: me.userId, venueId, lastSeenAt: now, countable: !me.geofenceExempt },
    update: { venueId, lastSeenAt: now, countable: !me.geofenceExempt },
  });
  return { here: true as const, expiresAt: new Date(now.getTime() + PRESENCE_TTL_MS), ...geo };
}

export async function setGoingTonight(db: Db, actor: Actor | null, venueId: string, going: boolean, now = new Date()) {
  const me = requireSignedIn(actor);
  if (!(await db.venue.findUnique({ where: { id: venueId }, select: { id: true } }))) throw notFound("Venue not found");
  if (ownsVenue(me, venueId)) throw forbidden("Venue accounts can't RSVP to their own venue");
  const night = nightKey(now);
  if (going) {
    await db.rsvp.upsert({
      where: { userId_venueId_night: { userId: me.userId, venueId, night } },
      create: { userId: me.userId, venueId, night, createdAt: now, countable: !me.geofenceExempt },
      update: {},
    });
  } else {
    await db.rsvp.deleteMany({ where: { userId: me.userId, venueId, night } });
  }
  const count = await db.rsvp.count({ where: { venueId, night, countable: true } });
  return { going, night, goingTonight: count };
}

/** Deletes expired presence rows so "here now" check-ins aren't retained after they stop counting (run by cron). */
export async function pruneExpiredPresence(db: Db, now = new Date()) {
  const { count } = await db.presence.deleteMany({ where: { lastSeenAt: { lte: new Date(now.getTime() - PRESENCE_TTL_MS) } } });
  return count;
}
