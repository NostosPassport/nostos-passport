/**
 * Account deletion (App Store Guideline 5.1.1(v)). User content can never be deleted (invariant 5), so
 * deleting an account **anonymizes** it, in one transaction:
 *  - email, display name and password hash are scrubbed; handle becomes `deleted-<random>` (hyphens are not
 *    allowed in real handles, so it can never collide); `deleted_at` is set; role drops to USER;
 *  - all sessions are revoked; follows (both directions), likes and blocks (both directions) are removed;
 *  - the user's stamps (personal images) are hidden for good, each with a system `ACCOUNT_DELETED` moderation
 *    event, and the image files are deleted from storage after the transaction commits;
 *  - social layer: their likes, follow requests (both directions) and rate-limit rows are removed; bio and
 *    profile photo are cleared (the file is deleted after commit); a verified badge is revoked with a system
 *    entry in the append-only verification log. Their posts are photos, so they're hidden with the rest.
 * Deleted accounts can't sign in and their handle can't be looked up. No content row is deleted, so the
 * existing DB triggers need no changes.
 */
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { getStorage } from "@/lib/storage";
import type { Actor } from "@/server/actor";
import { notFound, ServiceError } from "@/server/errors";
import { requireSignedIn } from "@/server/permissions";
import { lockVerification } from "@/server/services/verification";

export const deleteAccountSchema = z.object({ password: z.string().min(1, "Enter your password").max(200) }).strict();

export const DELETED_DISPLAY_NAME = "Deleted user";

export async function deleteAccount(db: Db, actor: Actor | null, raw: unknown, now = new Date()) {
  const me = requireSignedIn(actor);
  const { password } = deleteAccountSchema.parse(raw);
  const user = await db.user.findUnique({ where: { id: me.userId } });
  if (!user || user.deletedAt) throw notFound("Account not found");
  if (!(await verifyPassword(password, user.passwordHash))) throw new ServiceError(403, "wrong_password", "That password isn't right");

  const tag = randomBytes(8).toString("hex");
  let photoKeys: string[] = [];
  const avatarKey = user.avatarKey;
  await db.$transaction(async (tx) => {
    // Every photo: visible ones are hidden now; already-hidden ones get the event too, so the record shows they
    // can never be restored (moderation refuses RESTORE for deleted authors).
    const photos = await tx.photo.findMany({ where: { userId: user.id }, select: { id: true, storageKey: true } });
    const extra = await tx.stampPhoto.findMany({ where: { stampId: { in: photos.map((p) => p.id) } }, select: { storageKey: true } });
    photoKeys = [...new Set([...photos.flatMap((p) => (p.storageKey ? [p.storageKey] : [])), ...extra.map((e) => e.storageKey)])];
    if (photos.length) {
      await tx.photo.updateMany({ where: { userId: user.id, hiddenAt: null }, data: { hiddenAt: now } });
      await tx.moderationEvent.createMany({
        data: photos.map((p) => ({ action: "ACCOUNT_DELETED" as const, targetType: "PHOTO" as const, targetId: p.id, actorId: null, note: "Author deleted their account", createdAt: now })),
      });
    }
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.follow.deleteMany({ where: { OR: [{ followerId: user.id }, { followeeId: user.id }] } });
    await tx.followRequest.deleteMany({ where: { OR: [{ requesterId: user.id }, { targetId: user.id }] } });
    await tx.photoLike.deleteMany({ where: { userId: user.id } });
    await tx.pinnedStamp.deleteMany({ where: { userId: user.id } });
    await tx.rateEvent.deleteMany({ where: { userId: user.id } });
    // Under the badge lock, re-read: a grant racing this deletion is either logged-and-revoked here or refused.
    await lockVerification(tx, user.id);
    const { verifiedAt } = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { verifiedAt: true } });
    if (verifiedAt) {
      await tx.verificationEvent.create({ data: { userId: user.id, action: "REVOKE", note: "Account deleted", actorId: null, createdAt: now } });
    }
    await tx.block.deleteMany({ where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] } });
    await tx.loginAttempt.deleteMany({ where: { email: user.email } });
    await tx.user.update({
      where: { id: user.id },
      data: {
        email: `deleted-${tag}@deleted.invalid`,
        handle: `deleted-${tag}`,
        displayName: DELETED_DISPLAY_NAME,
        passwordHash: "!deleted",
        role: "USER",
        geofenceExempt: false,
        bio: "",
        avatarKey: null,
        verifiedAt: null,
        isPrivate: true,
        deletedAt: now,
      },
    });
  });
  // After commit: delete the image files themselves (rows stay, hidden, as the record). Best effort; a failure
  // here leaves an unreachable, never-signed file that the storage lifecycle can clean up.
  const storage = getStorage();
  await Promise.all([...photoKeys, ...(avatarKey ? [avatarKey] : [])].map((k) => storage.delete(k).catch(() => {})));
  return { deleted: true as const };
}
