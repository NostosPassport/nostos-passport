/**
 * Flags and moderation.
 *
 * - Anyone signed in (users and venue owners) can flag a photo, comment or report. Flagging never hides
 *   anything by itself; it queues the item for moderators and writes a FLAGGED event.
 * - Exception (spec): 3 open flags on a photo from 3 distinct *eligible* users auto-hide it pending review
 *   (AUTO_HIDE event, actor = system). Eligible = role USER, account at least 7 days old, reputation >= 0.5.
 *   Venue accounts (any venue), staff, brand-new sock puppets and low-reputation accounts can still flag
 *   (it goes to the queue) but never count toward the auto-hide.
 * - One OPEN flag per user per item; once a moderator reviews it, the same user may flag it again.
 * - Only MODERATOR/ADMIN can HIDE, DISMISS (flags unfounded; undoes an *auto*-hide only) or RESTORE.
 *   Venue owners get 403 (invariant 1).
 * - Accounts can be reported too (targetType USER, e.g. from a profile). Moderators can SUSPEND an abusive account
 *   (can't sign in, all sessions revoked; its content stays until moderated) or UNSUSPEND it (Guideline 1.2).
 * - Photos of deleted accounts stay hidden for good: RESTORE is refused and DISMISS never un-hides them.
 * - Nothing is ever deleted: hiding sets hidden_at. Every action writes an append-only moderation_event in the
 *   same transaction (invariant 5; the table rejects UPDATE/DELETE at the database level).
 */
import type { ContentType, Prisma } from "@prisma/client";
import { z } from "zod";
import type { Db } from "@/lib/db";
import type { Actor } from "@/server/actor";
import { badRequest, conflict, notFound, tooMany } from "@/server/errors";
import { assertCanModerateContent, assertModerator, requireSignedIn } from "@/server/permissions";
import { uploadUrl } from "@/server/services/venues";

export const AUTO_HIDE_THRESHOLD = 3;
export const AUTO_HIDE_MIN_ACCOUNT_AGE_MS = 7 * 24 * 3600_000;
export const AUTO_HIDE_MIN_REPUTATION = 0.5;
const FLAGS_PER_HOUR = 20;

export const flagSchema = z
  .object({
    targetType: z.enum(["PHOTO", "COMMENT", "REPORT", "USER"]),
    /** Content id; for USER targets, the account's id or handle. */
    targetId: z.string().min(1).max(64),
    reason: z.string().trim().min(3, "Say briefly what's wrong").max(300),
  })
  .strict();

const CONTENT_ACTIONS = ["HIDE", "DISMISS", "RESTORE"] as const;
const USER_ACTIONS = ["SUSPEND", "UNSUSPEND", "DISMISS"] as const;

export const moderateSchema = z
  .object({
    targetType: z.enum(["PHOTO", "COMMENT", "REPORT", "USER"]),
    targetId: z.string().min(1).max(64),
    action: z.enum(["HIDE", "DISMISS", "RESTORE", "SUSPEND", "UNSUSPEND"]),
    note: z.string().trim().max(300).optional(),
  })
  .strict()
  .refine(
    (m) => (m.targetType === "USER" ? (USER_ACTIONS as readonly string[]) : (CONTENT_ACTIONS as readonly string[])).includes(m.action),
    { message: "Accounts can be suspended, unsuspended or dismissed; content can be hidden, dismissed or restored", path: ["action"] },
  );

/** `hiddenAt` is the suspension time for USER targets. `authorDeleted` is true when the author deleted their account. */
type Target = { id: string; userId: string; venueId: string | null; hiddenAt: Date | null; authorDeleted: boolean };

async function loadTarget(db: Prisma.TransactionClient | Db, type: ContentType, idOrHandle: string): Promise<Target | null> {
  if (type === "USER") {
    const u = await db.user.findFirst({
      where: { OR: [{ id: idOrHandle }, { handle: idOrHandle.toLowerCase() }], deletedAt: null },
      select: { id: true, suspendedAt: true },
    });
    return u && { id: u.id, userId: u.id, venueId: null, hiddenAt: u.suspendedAt, authorDeleted: false };
  }
  const select = { id: true, userId: true, venueId: true, hiddenAt: true, user: { select: { deletedAt: true } } } as const;
  const row =
    type === "PHOTO"
      ? await db.photo.findUnique({ where: { id: idOrHandle }, select })
      : type === "COMMENT"
        ? await db.comment.findUnique({ where: { id: idOrHandle }, select })
        : await db.report.findUnique({ where: { id: idOrHandle }, select });
  return row && { id: row.id, userId: row.userId, venueId: row.venueId, hiddenAt: row.hiddenAt, authorDeleted: Boolean(row.user.deletedAt) };
}

async function setHidden(tx: Prisma.TransactionClient, type: ContentType, id: string, hiddenAt: Date | null) {
  if (type === "PHOTO") await tx.photo.update({ where: { id }, data: { hiddenAt } });
  else if (type === "COMMENT") await tx.comment.update({ where: { id }, data: { hiddenAt } });
  else if (type === "REPORT") await tx.report.update({ where: { id }, data: { hiddenAt } });
  else {
    await tx.user.update({ where: { id }, data: { suspendedAt: hiddenAt } });
    if (hiddenAt) await tx.session.deleteMany({ where: { userId: id } });
  }
}

async function lockTarget(tx: Prisma.TransactionClient, type: ContentType, id: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`moderation:${type}:${id}`}))`;
}

export async function flagContent(db: Db, actor: Actor | null, raw: unknown, now = new Date()) {
  const me = requireSignedIn(actor);
  const input = flagSchema.parse(raw);
  const pre = await loadTarget(db, input.targetType, input.targetId);
  if (!pre || pre.hiddenAt) throw notFound(input.targetType === "USER" ? "User not found" : "Content not found");
  if (pre.userId === me.userId) throw badRequest(input.targetType === "USER" ? "You can't report yourself" : "You can't flag your own content");
  const targetId = pre.id; // USER targets may be given by handle; always store the id

  return db.$transaction(async (tx) => {
    // Per-user lock makes the hourly limit exact under parallel requests; per-target lock orders flags on one item.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`flagger:${me.userId}`}))`;
    const recent = await tx.flag.count({ where: { flaggerId: me.userId, createdAt: { gt: new Date(now.getTime() - 3600_000) } } });
    if (recent >= FLAGS_PER_HOUR) throw tooMany("You've flagged a lot recently. Try again later.");
    await lockTarget(tx, input.targetType, targetId);
    // Re-check under the lock: it may have been hidden while we waited.
    const target = await loadTarget(tx, input.targetType, targetId);
    if (!target || target.hiddenAt) throw notFound("Content not found");
    const existing = await tx.flag.findFirst({
      where: { targetType: input.targetType, targetId: targetId, flaggerId: me.userId, status: "OPEN" },
    });
    if (existing) throw conflict("You already flagged this");
    const flag = await tx.flag.create({
      data: { targetType: input.targetType, targetId: targetId, venueId: target.venueId, flaggerId: me.userId, reason: input.reason, createdAt: now },
    });
    await tx.moderationEvent.create({
      data: { action: "FLAGGED", targetType: input.targetType, targetId: targetId, actorId: me.userId, note: input.reason, createdAt: now },
    });

    let autoHidden = false;
    if (input.targetType === "PHOTO") {
      // Only eligible regular users count (see header): no venue accounts, staff, new or low-reputation accounts.
      const independent = await tx.flag.findMany({
        where: {
          targetType: "PHOTO",
          targetId: target.id,
          status: "OPEN",
          flagger: {
            role: "USER",
            geofenceExempt: false, // review/QA accounts never help auto-hide real users' photos
            createdAt: { lte: new Date(now.getTime() - AUTO_HIDE_MIN_ACCOUNT_AGE_MS) },
            reputation: { gte: AUTO_HIDE_MIN_REPUTATION },
          },
        },
        distinct: ["flaggerId"],
        select: { flaggerId: true },
      });
      if (independent.length >= AUTO_HIDE_THRESHOLD) {
        await setHidden(tx, "PHOTO", target.id, now);
        await tx.moderationEvent.create({
          data: { action: "AUTO_HIDE", targetType: "PHOTO", targetId: target.id, actorId: null, note: `${independent.length} distinct user flags`, createdAt: now },
        });
        autoHidden = true;
      }
    }
    return { flag, autoHidden };
  });
}

/** Moderator decision. Venue owners and regular users get 403. */
export async function moderate(db: Db, actor: Actor | null, raw: unknown, now = new Date()) {
  const mod = assertCanModerateContent(actor);
  const input = moderateSchema.parse(raw);
  const pre = await loadTarget(db, input.targetType, input.targetId);
  if (!pre) throw notFound(input.targetType === "USER" ? "User not found" : "Content not found");
  const targetId = pre.id;
  return db.$transaction(async (tx) => {
    await lockTarget(tx, input.targetType, targetId);
    const target = await loadTarget(tx, input.targetType, targetId);
    if (!target) throw notFound("Content not found");
    const log = (action: "HIDE" | "DISMISS" | "RESTORE" | "SUSPEND" | "UNSUSPEND") =>
      tx.moderationEvent.create({ data: { action, targetType: input.targetType, targetId, actorId: mod.userId, note: input.note ?? null, createdAt: now } });
    const resolveFlags = () =>
      tx.flag.updateMany({ where: { targetType: input.targetType, targetId, status: "OPEN" }, data: { status: "RESOLVED" } });

    if (input.targetType === "USER") {
      if (target.userId === mod.userId) throw badRequest("You can't moderate your own account");
      if (input.action === "SUSPEND") {
        if (!target.hiddenAt) await setHidden(tx, "USER", targetId, now);
        await resolveFlags();
        await log("SUSPEND");
      } else if (input.action === "UNSUSPEND") {
        if (!target.hiddenAt) throw badRequest("This account isn't suspended");
        await setHidden(tx, "USER", targetId, null);
        await log("UNSUSPEND");
      } else {
        await resolveFlags();
        await log("DISMISS");
      }
      return loadTarget(tx, "USER", targetId);
    }

    if (input.action === "HIDE") {
      if (!target.hiddenAt) await setHidden(tx, input.targetType, target.id, now);
      await resolveFlags();
      await log("HIDE");
    } else if (input.action === "DISMISS") {
      // Flags were unfounded: close them. Undo the hide only if the system auto-hid it; a moderator's own HIDE
      // stays until someone explicitly RESTOREs it.
      await resolveFlags();
      await log("DISMISS");
      if (target.hiddenAt && !target.authorDeleted) {
        const lastHide = await tx.moderationEvent.findFirst({
          where: { targetType: input.targetType, targetId: target.id, action: { in: ["AUTO_HIDE", "HIDE", "RESTORE"] } },
          orderBy: { createdAt: "desc" },
        });
        if (lastHide?.action === "AUTO_HIDE") {
          await setHidden(tx, input.targetType, target.id, null);
          await log("RESTORE");
        }
      }
    } else {
      if (!target.hiddenAt) throw badRequest("This content isn't hidden");
      if (target.authorDeleted && input.targetType === "PHOTO") {
        throw conflict("The author deleted their account, so their photos stay hidden");
      }
      await setHidden(tx, input.targetType, target.id, null);
      await resolveFlags();
      await log("RESTORE");
    }
    return loadTarget(tx, input.targetType, targetId);
  });
}

export type QueueItem = Awaited<ReturnType<typeof moderationQueue>>[number];

/** Open flags grouped by target, oldest first, with enough context to decide. Moderators only. */
export async function moderationQueue(db: Db, actor: Actor | null) {
  assertModerator(actor);
  const flags = await db.flag.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    include: { flagger: { select: { handle: true, role: true, claims: { where: { status: "APPROVED" }, select: { venueId: true } } } }, venue: { select: { name: true, slug: true } } },
  });
  const groups = new Map<string, typeof flags>();
  for (const f of flags) {
    const key = `${f.targetType}:${f.targetId}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }

  const ids = (t: ContentType) => [...groups.values()].filter((g) => g[0]!.targetType === t).map((g) => g[0]!.targetId);
  const user = { select: { handle: true, reputation: true, deletedAt: true } } as const;
  const authorOf = (u: { handle: string; deletedAt: Date | null }) => (u.deletedAt ? "Deleted user" : u.handle);
  const [photos, comments, reports, users, events] = await Promise.all([
    db.photo.findMany({ where: { id: { in: ids("PHOTO") } }, include: { user } }),
    db.comment.findMany({ where: { id: { in: ids("COMMENT") } }, include: { user } }),
    db.report.findMany({ where: { id: { in: ids("REPORT") } }, include: { user } }),
    db.user.findMany({ where: { id: { in: ids("USER") } }, select: { id: true, handle: true, displayName: true, reputation: true, suspendedAt: true, createdAt: true, deletedAt: true } }),
    db.moderationEvent.findMany({
      where: { targetId: { in: [...groups.values()].map((g) => g[0]!.targetId) } },
      orderBy: { createdAt: "asc" },
      include: { actor: { select: { handle: true } } },
    }),
  ]);
  const byId = new Map<string, { kind: ContentType; preview: string; url?: string; author: string; authorRep: number; hiddenAt: Date | null; createdAt: Date }>();
  for (const p of photos) byId.set(p.id, { kind: "PHOTO", preview: p.caption, url: await uploadUrl(p.storageKey), author: authorOf(p.user), authorRep: p.user.reputation, hiddenAt: p.hiddenAt, createdAt: p.createdAt });
  for (const c of comments) byId.set(c.id, { kind: "COMMENT", preview: c.body, author: authorOf(c.user), authorRep: c.user.reputation, hiddenAt: c.hiddenAt, createdAt: c.createdAt });
  for (const u of users) {
    byId.set(u.id, { kind: "USER", preview: `Account: ${u.displayName}`, author: authorOf(u), authorRep: u.reputation, hiddenAt: u.suspendedAt, createdAt: u.createdAt });
  }
  for (const r of reports) {
    const value = r.type === "VIBE" ? r.vibe : r.type === "LINE" ? r.line : `cover ${r.coverCents! / 100} USD`;
    byId.set(r.id, { kind: "REPORT", preview: `${r.type.toLowerCase()}: ${value}`, author: authorOf(r.user), authorRep: r.user.reputation, hiddenAt: r.hiddenAt, createdAt: r.createdAt });
  }

  return [...groups.values()]
    .map((g) => {
      const first = g[0]!;
      const content = byId.get(first.targetId);
      return {
        targetType: first.targetType,
        targetId: first.targetId,
        venue: first.venue,
        content: content ?? null,
        flags: g.map((f) => ({
          id: f.id,
          reason: f.reason,
          createdAt: f.createdAt,
          by: f.flagger.handle,
          byRole: f.flagger.role,
          byVenueOwner: f.flagger.claims.some((c) => c.venueId === f.venueId),
          byOtherVenueOwner: f.flagger.role === "VENUE_OWNER" && !f.flagger.claims.some((c) => c.venueId === f.venueId),
        })),
        history: events.filter((e) => e.targetId === first.targetId).map((e) => ({ action: e.action, by: e.actor?.handle ?? "system", note: e.note, at: e.createdAt })),
      };
    })
    // Auto-hidden items first (they're hidden pending review), then oldest flag first.
    .sort((a, b) => Number(Boolean(b.content?.hiddenAt)) - Number(Boolean(a.content?.hiddenAt)) || a.flags[0]!.createdAt.getTime() - b.flags[0]!.createdAt.getTime());
}

export async function recentModerationLog(db: Db, actor: Actor | null, take = 30) {
  assertModerator(actor);
  return db.moderationEvent.findMany({ orderBy: { createdAt: "desc" }, take, include: { actor: { select: { handle: true } } } });
}

/**
 * Recently hidden content and suspended accounts, newest first, so moderators can review and RESTORE /
 * UNSUSPEND (hidden items leave the queue once their flags are resolved). Photos of deleted accounts are
 * excluded: they can never be restored.
 */
export async function recentlyHidden(db: Db, actor: Actor | null, take = 50) {
  assertModerator(actor);
  const user = { select: { handle: true, deletedAt: true } } as const;
  const venue = { select: { name: true, slug: true } } as const;
  const hidden = { hiddenAt: { not: null } } as const;
  const [photos, comments, reports, users] = await Promise.all([
    db.photo.findMany({ where: { ...hidden, user: { deletedAt: null } }, orderBy: { hiddenAt: "desc" }, take, include: { user, venue } }),
    db.comment.findMany({ where: hidden, orderBy: { hiddenAt: "desc" }, take, include: { user, venue } }),
    db.report.findMany({ where: hidden, orderBy: { hiddenAt: "desc" }, take, include: { user, venue } }),
    db.user.findMany({ where: { suspendedAt: { not: null }, deletedAt: null }, orderBy: { suspendedAt: "desc" }, take, select: { id: true, handle: true, displayName: true, suspendedAt: true } }),
  ]);
  const who = (u: { handle: string; deletedAt: Date | null }) => (u.deletedAt ? "Deleted user" : u.handle);
  type Item = { targetType: ContentType; targetId: string; venue: { name: string; slug: string } | null; preview: string; url?: string; author: string; hiddenAt: Date };
  const items: Item[] = [
    ...(await Promise.all(photos.map(async (p) => ({ targetType: "PHOTO" as const, targetId: p.id, venue: p.venue, preview: p.caption, url: await uploadUrl(p.storageKey), author: who(p.user), hiddenAt: p.hiddenAt! })))),
    ...comments.map((c) => ({ targetType: "COMMENT" as const, targetId: c.id, venue: c.venue, preview: c.body, author: who(c.user), hiddenAt: c.hiddenAt! })),
    ...reports.map((r) => ({
      targetType: "REPORT" as const, targetId: r.id, venue: r.venue,
      preview: `${r.type.toLowerCase()}: ${r.type === "VIBE" ? r.vibe : r.type === "LINE" ? r.line : `cover ${r.coverCents! / 100} USD`}`,
      author: who(r.user), hiddenAt: r.hiddenAt!,
    })),
    ...users.map((u) => ({ targetType: "USER" as const, targetId: u.id, venue: null, preview: `Account: ${u.displayName}`, author: u.handle, hiddenAt: u.suspendedAt! })),
  ];
  return items.sort((a, b) => b.hiddenAt.getTime() - a.hiddenAt.getTime()).slice(0, take);
}
