import { randomBytes } from "node:crypto";
import { z } from "zod";

import type { Db } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import type { Actor } from "@/server/actor";
import { notFound } from "@/server/errors";
import { requireSignedIn } from "@/server/permissions";
import { consumeEmailChallenge, startEmailChallenge } from "@/server/services/email-code";

export const deleteAccountSchema = z.object({ challengeId: z.string().uuid(), code: z.string().trim().regex(/^\d{6}$/, "Enter the six-digit code") }).strict();
export const DELETED_DISPLAY_NAME = "Deleted user";

export async function startDeleteAccount(db: Db, actor: Actor | null, meta: { ip: string; now?: Date }) {
  const me = requireSignedIn(actor);
  const user = await db.user.findUnique({ where: { id: me.userId }, select: { email: true, displayName: true, deletedAt: true } });
  if (!user || user.deletedAt) throw notFound("Account not found");
  return startEmailChallenge(db, { email: user.email, purpose: "DELETE_ACCOUNT", ip: meta.ip, displayName: user.displayName, now: meta.now });
}

export async function deleteAccount(db: Db, actor: Actor | null, raw: unknown, now = new Date()) {
  const me = requireSignedIn(actor);
  const data = deleteAccountSchema.parse(raw);
  const user = await db.user.findUnique({ where: { id: me.userId } });
  if (!user || user.deletedAt) throw notFound("Account not found");

  await consumeEmailChallenge(db, { challengeId: data.challengeId, code: data.code, purpose: "DELETE_ACCOUNT", expectedEmail: user.email, now });

  const tag = randomBytes(8).toString("hex");
  let photoKeys: string[] = [];
  const avatarKey = user.avatarKey;
  await db.$transaction(async (tx) => {
    const photos = await tx.photo.findMany({ where: { userId: user.id }, select: { id: true, storageKey: true } });
    const extra = await tx.stampPhoto.findMany({ where: { stampId: { in: photos.map((p) => p.id) } }, select: { storageKey: true } });
    photoKeys = [...new Set([...photos.flatMap((p) => (p.storageKey ? [p.storageKey] : [])), ...extra.map((e) => e.storageKey)])];
    await tx.photo.updateMany({ where: { userId: user.id, removedAt: null }, data: { removedAt: now } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.pinnedStamp.deleteMany({ where: { userId: user.id } });
    await tx.rateEvent.deleteMany({ where: { userId: user.id } });
    await tx.loginAttempt.deleteMany({ where: { email: user.email } });
    await tx.emailChallenge.deleteMany({ where: { email: user.email } });
    await tx.user.update({
      where: { id: user.id },
      data: {
        email: `deleted-${tag}@deleted.invalid`,
        handle: `deleted-${tag}`,
        displayName: DELETED_DISPLAY_NAME,
        passwordHash: null,
        emailVerifiedAt: null,
        ageVerifiedAt: null,
        geofenceExempt: false,
        bio: "",
        avatarKey: null,
        deletedAt: now,
      },
    });
  });

  const storage = getStorage();
  await Promise.all([...photoKeys, ...(avatarKey ? [avatarKey] : [])].map((k) => storage.delete(k).catch(() => {})));
  return { deleted: true as const };
}
