/**
 * Venue-owner operations. Venues own the facts: name, address, hours, official cover, dress code, official photo,
 * promos and replies. Nothing here can touch user content (reports, photos, comments, presence, RSVPs).
 *
 * Invariant 4: the accuracy score has no column and no setter. Inputs are strict zod schemas, so a request that
 * tries to send `accuracyScore` (or `isPaid`, or coordinates) is rejected with 400, not silently ignored.
 */
import { z } from "zod";
import type { Db } from "@/lib/db";
import { dollarsToCents } from "@/lib/money";
import { getStorage, newStorageKey, type BlobStorage } from "@/lib/storage";
import type { Actor } from "@/server/actor";
import { assertCleanText, badRequest, conflict, notFound } from "@/server/errors";
import { assertOwnsVenue, requireSignedIn } from "@/server/permissions";
import { processImage } from "@/server/services/photos";
import { zonedTimeToUtc } from "@/lib/time";
import { venueAccuracy, getVenuePage, uploadUrl } from "@/server/services/venues";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24h)");
export const hoursSchema = z
  .array(z.object({ day: z.number().int().min(0).max(6), open: hhmm, close: hhmm }).strict())
  .max(7)
  .refine((h) => new Set(h.map((x) => x.day)).size === h.length, "One entry per day");

export const officialInfoSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    /** May be empty: imported venues without a mapped street address start with "". */
    address: z.string().trim().max(120),
    hours: hoursSchema,
    /** "free", a dollar amount like "15", or "" for "not stated". */
    officialCover: z.string().trim().max(10),
    dressCode: z.string().trim().max(120),
  })
  .partial()
  .strict();

export async function updateOfficialInfo(db: Db, actor: Actor | null, venueId: string, raw: unknown, now = new Date()) {
  const me = assertOwnsVenue(actor, venueId);
  const input = officialInfoSchema.parse(raw);
  assertCleanText({ "venue name": input.name, address: input.address, "dress code": input.dressCode });
  if (!(await db.venue.findUnique({ where: { id: venueId }, select: { id: true } }))) throw notFound("Venue not found");

  let coverCents: number | null | undefined;
  if (input.officialCover !== undefined) {
    const c = input.officialCover.toLowerCase();
    coverCents = c === "" ? null : c === "free" ? 0 : dollarsToCents(c);
    if (c !== "" && coverCents === null) throw badRequest("Cover: enter dollars (e.g. 15), 'free', or leave blank");
    if (coverCents !== null && coverCents > 50_000) throw badRequest("Cover looks too high");
  }

  return db.$transaction(async (tx) => {
    // Lock the row so concurrent edits compare against the latest official cover (history feeds invariant 4).
    const [locked] = await tx.$queryRaw<{ official_cover_cents: number | null }[]>`
      SELECT official_cover_cents FROM venue WHERE id = ${venueId} FOR UPDATE`;
    const previousCover = locked?.official_cover_cents ?? null;
    const updated = await tx.venue.update({
      where: { id: venueId },
      data: {
        name: input.name,
        address: input.address,
        hours: input.hours,
        dressCode: input.dressCode === undefined ? undefined : input.dressCode || null,
        officialCoverCents: coverCents,
      },
    });
    // Cover changes are appended to the history the accuracy score reads; past windows keep their old value.
    if (coverCents !== undefined && coverCents !== previousCover) {
      await tx.venueCoverHistory.create({ data: { venueId, coverCents, effectiveFrom: now, changedById: me.userId } });
    }
    return updated;
  });
}

export async function setOfficialPhoto(db: Db, actor: Actor | null, venueId: string, bytes: Buffer, storage: BlobStorage = getStorage()) {
  assertOwnsVenue(actor, venueId);
  const { bytes: clean, kind } = await processImage(bytes);
  const before = await db.venue.findUnique({ where: { id: venueId }, select: { officialPhotoKey: true } });
  if (!before) throw notFound("Venue not found");
  const key = newStorageKey("official", kind.ext);
  await storage.put(key, clean, kind.mime);
  let updated;
  try {
    updated = await db.venue.update({ where: { id: venueId }, data: { officialPhotoKey: key } });
  } catch (err) {
    await storage.delete(key).catch(() => {});
    throw err;
  }
  if (before.officialPhotoKey && before.officialPhotoKey !== key) await storage.delete(before.officialPhotoKey).catch(() => {});
  return updated;
}

/** Promo times are entered as New York wall-clock time ("YYYY-MM-DDTHH:MM"), matching how hours are shown. */
const nyLocal = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time")
  .transform((s) => {
    const [d, t] = s.split("T") as [string, string];
    const [y, m, day] = d.split("-").map(Number) as [number, number, number];
    const [hh, mm] = t.split(":").map(Number) as [number, number];
    return zonedTimeToUtc(y, m, day, hh, mm);
  });

export const PROMO_MAX_LENGTH_MS = 30 * 86_400_000;
export const PROMO_MAX_LEAD_MS = 90 * 86_400_000;

export const promoSchema = z
  .object({
    title: z.string().trim().min(3).max(80),
    body: z.string().trim().min(3).max(400),
    startsAt: nyLocal,
    endsAt: nyLocal,
  })
  .strict()
  .refine((p) => p.endsAt > p.startsAt, { message: "End must be after start", path: ["endsAt"] })
  .refine((p) => p.endsAt.getTime() - p.startsAt.getTime() <= PROMO_MAX_LENGTH_MS, { message: "Promos can run at most 30 days", path: ["endsAt"] });

/** Owners create promos; the paid flag is admin-only and always starts false. */
export async function createPromo(db: Db, actor: Actor | null, venueId: string, raw: unknown, now = new Date()) {
  const me = assertOwnsVenue(actor, venueId);
  const p = promoSchema.parse(raw);
  assertCleanText({ "promo title": p.title, "promo text": p.body });
  if (p.endsAt <= now) throw badRequest("That promo would already be over");
  if (p.startsAt.getTime() - now.getTime() > PROMO_MAX_LEAD_MS) throw badRequest("Promos can be scheduled at most 90 days ahead");
  return db.promo.create({ data: { venueId, title: p.title, body: p.body, startsAt: p.startsAt, endsAt: p.endsAt, isPaid: false, createdById: me.userId } });
}

export async function endPromo(db: Db, actor: Actor | null, promoId: string, now = new Date()) {
  requireSignedIn(actor);
  const promo = await db.promo.findUnique({ where: { id: promoId } });
  if (!promo) throw notFound("Promo not found");
  assertOwnsVenue(actor, promo.venueId);
  if (promo.endsAt <= now) return promo;
  // Not started yet: cancel it by collapsing its window into the past (start < end <= now).
  const startsAt = promo.startsAt < now ? promo.startsAt : new Date(now.getTime() - 1);
  return db.promo.update({ where: { id: promoId }, data: { startsAt, endsAt: now } });
}

export const claimSchema = z.object({ venueId: z.string().min(1) }).strict();

/** Any plain USER can ask to manage a venue; an ADMIN approves it. */
export async function requestClaim(db: Db, actor: Actor | null, raw: unknown) {
  const me = requireSignedIn(actor);
  const { venueId } = claimSchema.parse(raw);
  if (me.role === "MODERATOR" || me.role === "ADMIN") throw badRequest("Staff accounts can't manage venues");
  if (!(await db.venue.findUnique({ where: { id: venueId }, select: { id: true } }))) throw notFound("Venue not found");
  const existing = await db.venueClaim.findUnique({ where: { venueId_userId: { venueId, userId: me.userId } } });
  if (existing?.status === "APPROVED") throw conflict("You already manage this venue");
  if (existing?.status === "PENDING") throw conflict("Your claim is already waiting for review");
  if (existing) {
    // Previously rejected: re-open it for a fresh review.
    return db.venueClaim.update({ where: { id: existing.id }, data: { status: "PENDING", reviewedById: null, reviewedAt: null, createdAt: new Date() } });
  }
  return db.venueClaim.create({ data: { venueId, userId: me.userId } });
}

export async function ownerOverview(db: Db, actor: Actor | null) {
  const me = requireSignedIn(actor);
  const [venues, claims] = await Promise.all([
    db.venue.findMany({ where: { id: { in: me.ownedVenueIds } }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
    db.venueClaim.findMany({ where: { userId: me.userId, status: { not: "APPROVED" } }, include: { venue: { select: { name: true } } } }),
  ]);
  return { venues, claims };
}

/** Everything the owner dashboard for one venue needs. Live data is read-only here. */
export async function ownerVenueDashboard(db: Db, actor: Actor | null, venueId: string, now = new Date()) {
  assertOwnsVenue(actor, venueId);
  const venue = await db.venue.findUnique({
    where: { id: venueId },
    select: { id: true, slug: true, name: true, address: true, hours: true, officialCoverCents: true, dressCode: true, officialPhotoKey: true },
  });
  if (!venue) throw notFound("Venue not found");
  const [page, promos, coverHistory, accuracy, recentReports, hiddenReplies] = await Promise.all([
    getVenuePage(db, venue.slug, actor, now),
    db.promo.findMany({
      where: { venueId },
      orderBy: { startsAt: "desc" },
      take: 20,
      select: { id: true, title: true, body: true, isPaid: true, startsAt: true, endsAt: true },
    }),
    db.venueCoverHistory.findMany({
      where: { venueId },
      orderBy: { effectiveFrom: "desc" },
      take: 10,
      select: { id: true, coverCents: true, effectiveFrom: true },
    }),
    venueAccuracy(db, venueId, now),
    // Individual live reports, so the owner can flag ones they believe are false. Deliberately anonymous:
    // id, type, value and age only, never who reported it (no retaliation, no pressuring reporters).
    db.report.findMany({
      where: { venueId, hiddenAt: null, countable: true, createdAt: { gt: new Date(now.getTime() - 3 * 3600_000), lte: now } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, type: true, vibe: true, line: true, coverCents: true, createdAt: true },
    }),
    // The venue's own replies that a moderator hid, so the owner knows (they are not shown publicly).
    db.comment.findMany({
      where: { venueId, isVenueReply: true, hiddenAt: { not: null } },
      orderBy: { hiddenAt: "desc" },
      take: 10,
      select: { id: true, body: true, hiddenAt: true },
    }),
  ]);
  const { officialPhotoKey, ...venueInfo } = venue;
  return {
    venue: { ...venueInfo, officialPhotoUrl: officialPhotoKey ? await uploadUrl(officialPhotoKey, now) : null },
    page, promos, coverHistory, accuracy, recentReports, hiddenReplies,
  };
}

/** Public shape of a promo in API responses (no creator id). */
export function promoView(p: { id: string; title: string; body: string; isPaid: boolean; startsAt: Date; endsAt: Date }) {
  return { id: p.id, title: p.title, body: p.body, isPaid: p.isPaid, startsAt: p.startsAt, endsAt: p.endsAt };
}
