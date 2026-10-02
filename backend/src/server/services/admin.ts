import { assertSocialEnabled } from "@/server/social";
import { z } from "zod";
import type { Db } from "@/lib/db";
import type { Actor } from "@/server/actor";
import { badRequest, notFound } from "@/server/errors";
import { assertAdmin } from "@/server/permissions";

export const userFlagsSchema = z.object({ geofenceExempt: z.boolean() }).strict();

/**
 * Admin-only: mark an account geofence-exempt (App Review / QA). Exempt accounts can stamp from anywhere, but
 * everything they stamp is visible only to themselves.
 */
export async function setUserFlags(db: Db, actor: Actor | null, handle: string, raw: unknown) {
  assertSocialEnabled();
  assertAdmin(actor);
  const { geofenceExempt } = userFlagsSchema.parse(raw);
  const user = await db.user.findUnique({ where: { handle: handle.toLowerCase() }, select: { id: true, deletedAt: true } });
  if (!user || user.deletedAt) throw notFound("User not found");
  return db.user.update({ where: { id: user.id }, data: { geofenceExempt }, select: { handle: true, geofenceExempt: true } });
}

/**
 * Bootstrap staff roles from the command line (`pnpm user:role <email> <USER|MODERATOR|ADMIN>`). Production has
 * no demo seed, so this is how the first admin and moderators are created: sign up normally, then promote.
 */
export const staffRoleSchema = z.enum(["USER", "MODERATOR", "ADMIN"]);

export async function setStaffRoleByEmail(db: Db, email: string, role: unknown) {
  const r = staffRoleSchema.parse(role);
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || user.deletedAt) throw badRequest(`No active account with email ${email}`);
  return db.user.update({ where: { id: user.id }, data: { role: r }, select: { handle: true, role: true } });
}
