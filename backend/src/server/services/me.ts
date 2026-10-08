import type { Db } from "@/lib/db";
import type { Actor } from "@/server/actor";
import { badRequest, notFound } from "@/server/errors";
import { requireSignedIn } from "@/server/permissions";
import { CURRENT_TERMS_VERSION } from "@/server/services/auth";
import { avatarUrl } from "@/server/services/people";

export async function getMe(db: Db, actor: Actor | null, now = new Date()) {
  const me = requireSignedIn(actor);
  const user = await db.user.findUnique({ where: { id: me.userId }, select: {
    id: true, email: true, handle: true, displayName: true, role: true, createdAt: true, reputation: true,
    termsAcceptedAt: true, termsVersion: true, geofenceExempt: true, bio: true, avatarKey: true,
  } });
  if (!user) throw notFound("Account not found");
  return {
    user: { id: user.id, email: user.email, handle: user.handle, displayName: user.displayName, role: user.role, memberSince: user.createdAt, reputation: user.reputation, isPrivate: true, bio: user.bio, avatarUrl: await avatarUrl(user.avatarKey, now), verified: false },
    social: { pendingFollowRequests: 0 },
    settings: { geofenceExempt: user.geofenceExempt },
    terms: { acceptedVersion: user.termsVersion, acceptedAt: user.termsAcceptedAt, currentVersion: CURRENT_TERMS_VERSION, needsAcceptance: user.termsVersion !== CURRENT_TERMS_VERSION },
  };
}

export async function acceptCurrentTerms(db: Db, actor: Actor | null, raw: unknown, now = new Date()) {
  const me = requireSignedIn(actor);
  const body = (raw ?? {}) as { version?: unknown };
  if (body.version !== CURRENT_TERMS_VERSION) throw badRequest(`Accept the current terms version (${CURRENT_TERMS_VERSION})`);
  await db.user.update({ where: { id: me.userId }, data: { termsVersion: CURRENT_TERMS_VERSION, termsAcceptedAt: now } });
  return { acceptedVersion: CURRENT_TERMS_VERSION, acceptedAt: now };
}
