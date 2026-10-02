/**
 * The verified badge: handpicked by an admin, no application flow. Every grant and revoke needs a note and is
 * written to the append-only `verification_event` log (a trigger rejects UPDATE and DELETE) in the same transaction
 * as the change.
 *
 * Badge only: verification never changes ranking, featuring eligibility, consensus or anything else. Nothing reads
 * `verified_at` except the code that displays the badge.
 */
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import type { Db } from "@/lib/db";
import type { Actor } from "@/server/actor";
import { conflict, notFound } from "@/server/errors";
import { assertAdmin } from "@/server/permissions";

/** Serializes badge changes for one account (the admin tools and account deletion). */
export async function lockVerification(tx: Prisma.TransactionClient, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`verify:${userId}`}))`;
}

export const verificationSchema = z
  .object({
    verified: z.boolean(),
    note: z.string().trim().min(3, "Add a note (why)").max(300, "Note: 300 characters max"),
  })
  .strict();

export async function setVerified(db: Db, actor: Actor | null, handle: string, raw: unknown, now = new Date()) {
  const admin = assertAdmin(actor);
  const { verified, note } = verificationSchema.parse(raw);
  const user = await db.user.findUnique({ where: { handle: handle.toLowerCase() }, select: { id: true } });
  if (!user) throw notFound("User not found");
  return db.$transaction(async (tx) => {
    // Same lock as account deletion, and re-read under it: a grant can't land on an account being deleted.
    await lockVerification(tx, user.id);
    const current = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { verifiedAt: true, deletedAt: true } });
    if (current.deletedAt) throw notFound("User not found");
    if ((current.verifiedAt !== null) === verified) throw conflict(verified ? "Already verified" : "Not verified");
    // The log entry first: the database refuses a badge change without one in the same transaction.
    await tx.verificationEvent.create({ data: { userId: user.id, action: verified ? "GRANT" : "REVOKE", note, actorId: admin.userId, createdAt: now } });
    const updated = await tx.user.update({ where: { id: user.id }, data: { verifiedAt: verified ? now : null }, select: { handle: true, verifiedAt: true } });
    return { handle: updated.handle, verified: updated.verifiedAt !== null, verifiedAt: updated.verifiedAt };
  });
}

/** Admin user search for the verification tools. Staff see real accounts (email included), private or not. */
export async function adminSearchUsers(db: Db, actor: Actor | null, q: string) {
  assertAdmin(actor);
  const query = q.trim().toLowerCase().replace(/^@/, "");
  if (query.length < 2) return [];
  const users = await db.user.findMany({
    where: {
      deletedAt: null,
      OR: [{ handle: { contains: query } }, { displayName: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }],
    },
    orderBy: { handle: "asc" },
    take: 25,
    select: { handle: true, displayName: true, email: true, role: true, isPrivate: true, verifiedAt: true, suspendedAt: true, createdAt: true },
  });
  return users.map((u) => ({
    handle: u.handle, displayName: u.displayName, email: u.email, role: u.role, isPrivate: u.isPrivate,
    verified: u.verifiedAt !== null, verifiedAt: u.verifiedAt, suspended: u.suspendedAt !== null, memberSince: u.createdAt,
  }));
}

/** The verification log, newest first (optionally for one account). */
export async function verificationLog(db: Db, actor: Actor | null, handle?: string | null, take = 100) {
  assertAdmin(actor);
  const user = handle ? await db.user.findUnique({ where: { handle: handle.toLowerCase() }, select: { id: true } }) : null;
  if (handle && !user) throw notFound("User not found");
  const rows = await db.verificationEvent.findMany({
    where: user ? { userId: user.id } : {},
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { handle: true } }, actor: { select: { handle: true } } },
  });
  return rows.map((e) => ({ id: e.id, handle: e.user.handle, action: e.action, note: e.note, by: e.actor?.handle ?? "system", at: e.createdAt }));
}
