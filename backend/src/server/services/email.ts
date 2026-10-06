import { Prisma } from "@prisma/client";
import { z } from "zod";

import { verifyPassword } from "@/lib/auth/password";
import type { Db } from "@/lib/db";
import type { Actor } from "@/server/actor";
import { conflict, notFound, ServiceError } from "@/server/errors";
import { requireSignedIn } from "@/server/permissions";

export const changeEmailSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
    password: z.string().min(1, "Enter your password").max(200),
  })
  .strict();

export async function changeEmail(db: Db, actor: Actor | null, raw: unknown) {
  const me = requireSignedIn(actor);
  const { email, password } = changeEmailSchema.parse(raw);
  const user = await db.user.findUnique({ where: { id: me.userId }, select: { email: true, passwordHash: true, deletedAt: true } });
  if (!user || user.deletedAt) throw notFound("Account not found");
  if (!(await verifyPassword(password, user.passwordHash))) throw new ServiceError(403, "wrong_password", "That password isn't right");
  if (user.email === email) return { ok: true as const };

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing && existing.id !== me.userId) throw conflict("Email already registered");

  try {
    await db.$transaction([
      db.user.update({ where: { id: me.userId }, data: { email } }),
      db.loginAttempt.deleteMany({ where: { email: user.email } }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw conflict("Email already registered");
    throw err;
  }
  return { ok: true as const };
}
