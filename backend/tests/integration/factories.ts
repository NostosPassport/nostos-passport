import { createHmac, randomUUID } from "node:crypto";
import type { EmailChallengePurpose } from "@prisma/client";
import { prisma } from "@/lib/db";
import { loadActor, type Actor } from "@/server/actor";
import { DAY_MS } from "@/lib/time";

let n = 0;
const FAKE_HASH = "scrypt$32768$8$1$AAAA$AAAA";
const TEST_CODE_SECRET = "nostos-development-auth-code-secret-change-before-production";

export async function makeUser(opts: { ageDays?: number; handle?: string; geofenceExempt?: boolean } = {}) {
  n++;
  const handle = opts.handle ?? `user${n}_${Math.random().toString(36).slice(2, 7)}`;
  return prisma.user.create({
    data: {
      email: `${handle}@test.dev`,
      handle,
      displayName: handle,
      passwordHash: FAKE_HASH,
      geofenceExempt: opts.geofenceExempt ?? false,
      createdAt: new Date(Date.now() - (opts.ageDays ?? 30) * DAY_MS),
    },
  });
}

export async function seedEmailChallenge(email: string, purpose: EmailChallengePurpose, code = "123456", now = new Date()) {
  const id = randomUUID();
  const secret = process.env.AUTH_CODE_SECRET?.trim() || TEST_CODE_SECRET;
  const codeHash = createHmac("sha256", secret).update(`${id}:${code}`).digest("hex");
  await prisma.emailChallenge.create({
    data: {
      id,
      email: email.trim().toLowerCase(),
      codeHash,
      purpose,
      ip: "integration-test",
      expiresAt: new Date(now.getTime() + 10 * 60_000),
      createdAt: now,
    },
  });
  return { challengeId: id, code };
}

export const VENUE_POS = { lat: 40.7265, lng: -73.9845 };

export async function makeVenue(opts: { slug?: string; lat?: number; lng?: number; geofenceMeters?: number } = {}) {
  n++;
  const slug = opts.slug ?? `venue-${n}-${Math.random().toString(36).slice(2, 6)}`;
  return prisma.venue.create({
    data: {
      slug,
      name: `Venue ${n}`,
      address: `${n} Test St`,
      area: "East Village",
      city: "New York",
      region: "New York",
      country: "United States",
      countryCode: "US",
      timeZone: "America/New_York",
      lat: opts.lat ?? VENUE_POS.lat,
      lng: opts.lng ?? VENUE_POS.lng,
      ...(opts.geofenceMeters ? { geofenceMeters: opts.geofenceMeters } : {}),
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

export const INSIDE = { lat: VENUE_POS.lat + 0.00018, lng: VENUE_POS.lng };
export const OUTSIDE = { lat: VENUE_POS.lat + 0.01, lng: VENUE_POS.lng };

import { PNG } from "pngjs";
import { createStamp } from "@/server/services/stamps";

export function pngBytes(fill = 120) {
  const p = new PNG({ width: 4, height: 4 });
  p.data.fill(fill);
  return PNG.sync.write(p);
}

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
