import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { loadActor, type Actor } from "@/server/actor";
import { DAY_MS } from "@/lib/time";

let n = 0;
// Precomputed scrypt hash is not needed here: factories never log in with a password.
const FAKE_HASH = "scrypt$32768$8$1$AAAA$AAAA";

/** Accounts are private by default, as in the product; pass `isPrivate: false` for a public one. */
export async function makeUser(opts: { role?: Role; ageDays?: number; reputation?: number; handle?: string; isPrivate?: boolean } = {}) {
  n++;
  const handle = opts.handle ?? `user${n}_${Math.random().toString(36).slice(2, 7)}`;
  return prisma.user.create({
    data: {
      email: `${handle}@test.dev`, handle, displayName: handle, passwordHash: FAKE_HASH, role: opts.role ?? "USER",
      reputation: opts.reputation ?? 0.5, isPrivate: opts.isPrivate ?? true, createdAt: new Date(Date.now() - (opts.ageDays ?? 30) * DAY_MS),
    },
  });
}

export const VENUE_POS = { lat: 40.7265, lng: -73.9845 };

export async function makeVenue(opts: { slug?: string; lat?: number; lng?: number; geofenceMeters?: number } = {}) {
  n++;
  const slug = opts.slug ?? `venue-${n}-${Math.random().toString(36).slice(2, 6)}`;
  return prisma.venue.create({
    data: {
      slug, name: `Venue ${n}`, address: `${n} Test St`, neighborhood: "East Village",
      lat: opts.lat ?? VENUE_POS.lat, lng: opts.lng ?? VENUE_POS.lng, ...(opts.geofenceMeters ? { geofenceMeters: opts.geofenceMeters } : {}),
    },
  });
}

export async function actorFor(userId: string): Promise<Actor> {
  return (await loadActor(prisma, userId))!;
}

export async function makeActor(opts: Parameters<typeof makeUser>[0] = {}) {
  const u = await makeUser(opts);
  return actorFor(u.id);
}

/** ~20m from VENUE_POS: inside the 100m geofence. */
export const INSIDE = { lat: VENUE_POS.lat + 0.00018, lng: VENUE_POS.lng };
/** ~1.1km away: outside the geofence. */
export const OUTSIDE = { lat: VENUE_POS.lat + 0.01, lng: VENUE_POS.lng };

/** Verifies an account the only way the database allows: a log entry, then the badge, in one transaction. */
export async function verify(userId: string, note = "Test verification") {
  await prisma.$transaction(async (tx) => {
    await tx.verificationEvent.create({ data: { userId, action: "GRANT", note } });
    await tx.user.update({ where: { id: userId }, data: { verifiedAt: new Date() } });
  });
}

import { PNG } from "pngjs";
import { createStamp } from "@/server/services/stamps";

/** A tiny valid PNG (what a phone would send, minus the size). */
export function pngBytes(fill = 120) {
  const p = new PNG({ width: 4, height: 4 });
  p.data.fill(fill);
  return PNG.sync.write(p);
}

/** Stamps a place as `actor`, inside the geofence unless `at` says otherwise. Defaults to a photo and a caption. */
export function makeStamp(
  actor: Actor,
  venueId: string,
  opts: { at?: { lat: number; lng: number }; caption?: string; photo?: boolean; meta?: Record<string, unknown>; now?: Date } = {},
) {
  const at = opts.at ?? INSIDE;
  return createStamp(
    prisma,
    actor,
    venueId,
    { bytes: opts.photo === false ? null : pngBytes(), meta: { caption: opts.caption ?? "hello", lat: String(at.lat), lng: String(at.lng), ...opts.meta } },
    opts.now,
  );
}
