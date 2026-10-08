import { z } from "zod";
import type { Db } from "@/lib/db";
import type { Actor } from "@/server/actor";
import { badRequest } from "@/server/errors";
import { requireSignedIn } from "@/server/permissions";
import { getStamp } from "@/server/services/stamps";

export const MAX_PINS = 4;
export const pinsSchema = z.object({ stampIds: z.array(z.string().min(1).max(64)).max(MAX_PINS, `Pin up to ${MAX_PINS} stamps`) }).strict();

export async function listPins(db: Db, actor: Actor | null, now = new Date()) {
  const me = requireSignedIn(actor);
  const rows = await db.pinnedStamp.findMany({
    where: { userId: me.userId, stamp: { removedAt: null } },
    orderBy: { position: "asc" },
    select: { stampId: true },
  });
  const stamps = await Promise.all(rows.map((r) => getStamp(db, me, r.stampId, now).then((x) => x.stamp)));
  return { stamps };
}

export async function setPins(db: Db, actor: Actor | null, raw: unknown, now = new Date()) {
  const me = requireSignedIn(actor);
  const { stampIds } = pinsSchema.parse(raw);
  if (new Set(stampIds).size !== stampIds.length) throw badRequest("Each stamp can be pinned once");
  const own = await db.photo.findMany({ where: { id: { in: stampIds }, userId: me.userId, removedAt: null }, select: { id: true } });
  if (own.length !== stampIds.length) throw badRequest("You can only pin your own stamps");
  await db.$transaction(async (tx) => {
    await tx.pinnedStamp.deleteMany({ where: { userId: me.userId } });
    for (const [position, stampId] of stampIds.entries()) await tx.pinnedStamp.create({ data: { userId: me.userId, stampId, position, pinnedAt: now } });
  });
  return listPins(db, me, now);
}
