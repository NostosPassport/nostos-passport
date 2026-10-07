import { Prisma } from "@prisma/client";
import { z } from "zod";

import type { Db } from "@/lib/db";
import type { Actor } from "@/server/actor";
import { conflict, notFound } from "@/server/errors";
import { requireSignedIn } from "@/server/permissions";
import { consumeEmailChallenge, sendAccountEmailChangedNotice, startEmailChallenge } from "@/server/services/email-code";

export const startEmailChangeSchema = z
  .object({ email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200) })
  .strict();

export const changeEmailSchema = z
  .object({ challengeId: z.string().uuid(), code: z.string().trim().regex(/^\d{6}$/, "Enter the six-digit code") })
  .strict();

export async function startEmailChange(db: Db, actor: Actor | null, raw: unknown, meta: { ip: string; now?: Date }) {
  const me = requireSignedIn(actor);
  const { email } = startEmailChangeSchema.parse(raw);
  const user = await db.user.findUnique({ where: { id: me.userId }, select: { email: true, deletedAt: true } });
  if (!user || user.deletedAt) throw notFound("Account not found");
  if (user.email === email) throw conflict("That's already your account email");
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing && existing.id !== me.userId) throw conflict("Email already registered");
  return startEmailChallenge(db, { email, purpose: "CHANGE_EMAIL", ip: meta.ip, now: meta.now });
}

export async function changeEmail(db: Db, actor: Actor | null, raw: unknown, now = new Date()) {
  const me = requireSignedIn(actor);
  const data = changeEmailSchema.parse(raw);
  const user = await db.user.findUnique({ where: { id: me.userId }, select: { email: true, deletedAt: true } });
  if (!user || user.deletedAt) throw notFound("Account not found");

  const { email } = await consumeEmailChallenge(db, {
    challengeId: data.challengeId,
    code: data.code,
    purpose: "CHANGE_EMAIL",
    now,
  });
  if (email === user.email) return { ok: true as const, email };

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing && existing.id !== me.userId) throw conflict("Email already registered");

  try {
    await db.user.update({ where: { id: me.userId }, data: { email, emailVerifiedAt: now } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw conflict("Email already registered");
    throw err;
  }

  void sendAccountEmailChangedNotice(user.email, email).catch((error) => console.error("[auth-email] change notice failed", error));
  return { ok: true as const, email };
}
