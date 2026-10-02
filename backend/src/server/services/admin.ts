import { z } from "zod";
import type { Db } from "@/lib/db";
import type { Actor } from "@/server/actor";
import { badRequest, conflict, notFound } from "@/server/errors";
import { assertAdmin } from "@/server/permissions";

export const reviewClaimSchema = z.object({ approve: z.boolean() }).strict();
export const promoPaidSchema = z.object({ isPaid: z.boolean() }).strict();

export async function reviewClaim(db: Db, actor: Actor | null, claimId: string, raw: unknown, now = new Date()) {
  const admin = assertAdmin(actor);
  const { approve } = reviewClaimSchema.parse(raw);
  const claim = await db.venueClaim.findUnique({ where: { id: claimId }, include: { user: true } });
  if (!claim) throw notFound("Claim not found");
  if (claim.status !== "PENDING") throw badRequest("Claim already reviewed");
  if (approve && (claim.user.role === "MODERATOR" || claim.user.role === "ADMIN")) throw badRequest("Staff accounts can't manage venues");
  return db.$transaction(async (tx) => {
    // Conditional update: if another admin decided first, this one fails instead of overwriting.
    const { count } = await tx.venueClaim.updateMany({
      where: { id: claimId, status: "PENDING" },
      data: { status: approve ? "APPROVED" : "REJECTED", reviewedById: admin.userId, reviewedAt: now },
    });
    if (count !== 1) throw conflict("Claim was already reviewed");
    if (approve) await tx.user.updateMany({ where: { id: claim.userId, role: "USER" }, data: { role: "VENUE_OWNER" } });
    return tx.venueClaim.findUniqueOrThrow({ where: { id: claimId } });
  });
}

/**
 * Admin-only: marks a promo as paid. Paid promos are labelled "Promoted" everywhere. Being paid changes the
 * label only; it has no effect on ranking or visibility of user content (invariant 2).
 */
export async function setPromoPaid(db: Db, actor: Actor | null, promoId: string, raw: unknown) {
  assertAdmin(actor);
  const { isPaid } = promoPaidSchema.parse(raw);
  if (!(await db.promo.findUnique({ where: { id: promoId }, select: { id: true } }))) throw notFound("Promo not found");
  return db.promo.update({ where: { id: promoId }, data: { isPaid } });
}

export async function adminOverview(db: Db, actor: Actor | null, now = new Date()) {
  assertAdmin(actor);
  const [claims, promos] = await Promise.all([
    db.venueClaim.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { handle: true, displayName: true, role: true } },
        venue: {
          select: {
            name: true, slug: true,
            // Show existing owners so an admin never unknowingly hands a venue to a second, unrelated account.
            claims: { where: { status: "APPROVED" }, select: { user: { select: { handle: true } } } },
          },
        },
      },
    }),
    db.promo.findMany({
      where: { endsAt: { gt: now } },
      orderBy: { startsAt: "desc" },
      include: { venue: { select: { name: true, slug: true } } },
    }),
  ]);
  return { claims, promos };
}

export const userFlagsSchema = z.object({ geofenceExempt: z.boolean() }).strict();

/**
 * Admin-only: mark an account geofence-exempt (App Review / QA). Exempt accounts can post from anywhere, but
 * everything they post is excluded from consensus, counts, accuracy and reputation.
 */
export async function setUserFlags(db: Db, actor: Actor | null, handle: string, raw: unknown) {
  assertAdmin(actor);
  const { geofenceExempt } = userFlagsSchema.parse(raw);
  const user = await db.user.findUnique({ where: { handle: handle.toLowerCase() }, select: { id: true, deletedAt: true } });
  if (!user || user.deletedAt) throw notFound("User not found");
  return db.user.update({ where: { id: user.id }, data: { geofenceExempt }, select: { handle: true, geofenceExempt: true } });
}

/**
 * Bootstrap staff roles from the command line (`pnpm user:role <email> <USER|MODERATOR|ADMIN>`). Production has
 * no demo seed, so this is how the first admin and moderators are created: sign up normally, then promote.
 * Venue ownership is never granted here; it goes through claims.
 */
export const staffRoleSchema = z.enum(["USER", "MODERATOR", "ADMIN"]);

export async function setStaffRoleByEmail(db: Db, email: string, role: unknown) {
  const r = staffRoleSchema.parse(role);
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || user.deletedAt) throw notFound(`No active account with email ${email}`);
  if (user.role === "VENUE_OWNER") throw badRequest("This account owns venues; remove its claims before changing its role");
  return db.user.update({ where: { id: user.id }, data: { role: r }, select: { handle: true, role: true } });
}
