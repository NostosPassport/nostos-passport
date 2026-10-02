import type { Db } from "@/lib/db";
import type { Actor } from "@/server/actor";
import { badRequest, notFound } from "@/server/errors";
import { requireSignedIn } from "@/server/permissions";
import { CURRENT_TERMS_VERSION } from "@/server/services/auth";
import { avatarUrl } from "@/server/services/people";

/** The signed-in account as the app needs it at launch: identity, role and settings. */
export async function getMe(db: Db, actor: Actor | null, now = new Date()) {
  const me = requireSignedIn(actor);
  const user = await db.user.findUnique({
    where: { id: me.userId },
    select: {
      id: true, email: true, handle: true, displayName: true, role: true, createdAt: true, reputation: true,
      termsAcceptedAt: true, termsVersion: true, geofenceExempt: true, isPrivate: true, bio: true, avatarKey: true, verifiedAt: true,
    },
  });
  if (!user) throw notFound("Account not found");
  const pendingFollowRequests = await db.followRequest.count({ where: { targetId: me.userId, requester: { deletedAt: null, suspendedAt: null } } });
  return {
    user: {
      id: user.id, email: user.email, handle: user.handle, displayName: user.displayName, role: user.role,
      memberSince: user.createdAt,
      /** Private: returned only to the account itself (and moderators on profiles). */
      reputation: user.reputation,
      isPrivate: user.isPrivate,
      bio: user.bio,
      avatarUrl: await avatarUrl(user.avatarKey, now),
      verified: user.verifiedAt !== null,
    },
    social: { pendingFollowRequests },
    /** Read-only account settings the app displays. None are user-editable yet. */
    settings: {
      /** App Review / QA account: can stamp anywhere, but its stamps are visible only to itself. Set by an admin only. */
      geofenceExempt: user.geofenceExempt,
    },
    terms: {
      acceptedVersion: user.termsVersion,
      acceptedAt: user.termsAcceptedAt,
      currentVersion: CURRENT_TERMS_VERSION,
      /** True when the app should ask the user to accept the current Terms and Privacy Policy. */
      needsAcceptance: user.termsVersion !== CURRENT_TERMS_VERSION,
    },
  };
}

/** Records acceptance of the current Terms/Privacy (when /api/me says needsAcceptance). */
export async function acceptCurrentTerms(db: Db, actor: Actor | null, raw: unknown, now = new Date()) {
  const me = requireSignedIn(actor);
  const body = (raw ?? {}) as { version?: unknown };
  if (body.version !== CURRENT_TERMS_VERSION) throw badRequest(`Accept the current terms version (${CURRENT_TERMS_VERSION})`);
  await db.user.update({ where: { id: me.userId }, data: { termsVersion: CURRENT_TERMS_VERSION, termsAcceptedAt: now } });
  return { acceptedVersion: CURRENT_TERMS_VERSION, acceptedAt: now };
}
