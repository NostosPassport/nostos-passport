import { Prisma, type ReportType } from "@prisma/client";
import { z } from "zod";
import type { Db } from "@/lib/db";
import { isValidLatLng, withinGeofence, GEOFENCE_METERS, distanceMeters } from "@/lib/geo";
import { dollarsToCents } from "@/lib/money";
import type { Actor } from "@/server/actor";
import { assertCanPostUserContent } from "@/server/permissions";
import { badRequest, forbidden, notFound, tooMany } from "@/server/errors";

export const REPORT_COOLDOWN_MS = 15 * 60_000;
export const MAX_COVER_CENTS = 50_000; // $500 sanity cap

const coords = { lat: z.number().finite(), lng: z.number().finite() };

export const reportInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("VIBE"), vibe: z.enum(["PACKED", "BUSY", "CHILL", "DEAD"]), ...coords }).strict(),
  z.object({ type: z.literal("LINE"), line: z.enum(["NONE", "UNDER_10", "TEN_TO_30", "OVER_30"]), ...coords }).strict(),
  z
    .object({
      type: z.literal("COVER"),
      /** "free", or a dollar amount like "20" or "12.50". Stored as integer cents. */
      cover: z.string().trim().max(10),
      ...coords,
    })
    .strict(),
]);
export type ReportInput = z.infer<typeof reportInputSchema>;

/** Server-side geofence check from submitted coordinates (invariant 3). */
export function assertInsideGeofence(pos: { lat: number; lng: number }, venue: { lat: number; lng: number }) {
  if (!isValidLatLng(pos)) throw badRequest("Invalid coordinates");
  if (!withinGeofence(pos, venue)) {
    const d = Math.round(distanceMeters(pos, venue));
    throw forbidden(`You need to be within ${GEOFENCE_METERS}m of the venue to post (you're ${d}m away)`);
  }
}

/**
 * Serializes concurrent submissions for the same (user, venue, kind) so the 15-minute limit can't be raced.
 * Must run inside a transaction.
 */
export async function lockAndCheckCooldown(
  tx: Prisma.TransactionClient,
  key: { userId: string; venueId: string; kind: ReportType | "PHOTO" },
  now: Date,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${key.userId}:${key.venueId}:${key.kind}`}))`;
  const since = new Date(now.getTime() - REPORT_COOLDOWN_MS);
  const last =
    key.kind === "PHOTO"
      ? await tx.photo.findFirst({ where: { userId: key.userId, venueId: key.venueId, createdAt: { gt: since } }, orderBy: { createdAt: "desc" } })
      : await tx.report.findFirst({ where: { userId: key.userId, venueId: key.venueId, type: key.kind, createdAt: { gt: since } }, orderBy: { createdAt: "desc" } });
  if (last) {
    const waitMin = Math.ceil((last.createdAt.getTime() + REPORT_COOLDOWN_MS - now.getTime()) / 60_000);
    throw tooMany(`You already posted a ${key.kind.toLowerCase()} update here. Try again in ${waitMin} min.`);
  }
}

export async function submitReport(db: Db, actor: Actor | null, venueId: string, rawInput: unknown, now = new Date()) {
  const me = assertCanPostUserContent(actor, venueId);
  const input = reportInputSchema.parse(rawInput);
  const venue = await db.venue.findUnique({ where: { id: venueId }, select: { id: true, lat: true, lng: true } });
  if (!venue) throw notFound("Venue not found");
  // App Review / QA accounts may post from anywhere; their reports are stored but never counted.
  if (me.geofenceExempt) {
    if (!isValidLatLng(input)) throw badRequest("Invalid coordinates");
  } else assertInsideGeofence(input, venue);

  let data: Prisma.ReportUncheckedCreateInput;
  const base = { userId: me.userId, venueId, lat: input.lat, lng: input.lng, createdAt: now, countable: !me.geofenceExempt };
  if (input.type === "VIBE") data = { ...base, type: "VIBE", vibe: input.vibe };
  else if (input.type === "LINE") data = { ...base, type: "LINE", line: input.line };
  else {
    const cents = input.cover.toLowerCase() === "free" ? 0 : dollarsToCents(input.cover);
    if (cents === null || cents > MAX_COVER_CENTS) throw badRequest("Enter the cover in dollars, e.g. 20 or 12.50");
    data = { ...base, type: "COVER", coverCents: cents };
  }

  return db.$transaction(async (tx) => {
    await lockAndCheckCooldown(tx, { userId: me.userId, venueId, kind: input.type }, now);
    return tx.report.create({ data });
  });
}
