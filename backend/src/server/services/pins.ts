/**
 * Pinned stamps: up to 4 of your own, shown as ribbons on the first spread of your passport. Owner only: the only reader is
 * `/api/me/pins`, so nothing here is ever part of anyone else's view of you (rule 2).
 */
import { z } from "zod";
import type { Db } from "@/lib/db";
import type { Actor } from "@/server/actor";
import { badRequest } from "@/server/errors";
import { requireSignedIn } from "@/server/permissions";
import { getStamp } from "@/server/services/stamps";

export const MAX_PINS = 4;
export const pinsSchema = z.object({ stampIds: z.array(z.string().min(1).max(64)).max(MAX_PINS, `Pin up to ${MAX_PINS} stamps`) }).strict();

/** Your pinned stamps, in the order you pinned them. Stamps that were since hidden or removed drop out. */
export async function listPins(db: Db, actor: Actor | null, now = new Date()) {
  const me = requireSignedIn(actor);
  const rows = await db.pinnedStamp.findMany({
    where: { userId: me.userId, stamp: { hiddenAt: null, removedAt: null } },
    orderBy: { position: "asc" },
    select: { stampId: true },
  });
  const stamps = await Promise.all(rows.map((r) => getStamp(db, me, r.stampId, now).then((x) => x.stamp)));
  return { stamps };
}

/** Replace your pins with `stampIds` (in order). Only your own live stamps, no repeats, at most 4. */
export async function setPins(db: Db, actor: Actor | null, raw: unknown, now = new Date()) {
  const me = requireSignedIn(actor);
  const { stampIds } = pinsSchema.parse(raw);
  if (new Set(stampIds).size !== stampIds.length) throw badRequest("Each stamp can be pinned once");
  const own = await db.photo.findMany({ where: { id: { in: stampIds }, userId: me.userId, hiddenAt: null, removedAt: null }, select: { id: true } });
  if (own.length !== stampIds.length) throw badRequest("You can only pin your own stamps");
  await db.$transaction(async (tx) => {
    await tx.pinnedStamp.deleteMany({ where: { userId: me.userId } });
    for (const [position, stampId] of stampIds.entries()) await tx.pinnedStamp.create({ data: { userId: me.userId, stampId, position, pinnedAt: now } });
  });
  return listPins(db, me, now);
}
