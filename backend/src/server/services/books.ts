/**
 * Which books a stamp is in, and where the owner placed it in each one.
 *
 * Every live stamp is in the gallery. New stamps also land in the main passport; the owner can take one out (it keeps
 * living in the gallery and its collections) and put it back. Each book (the main passport, or one collection) keeps its
 * own placement per stamp, so the same stamp can sit large in one book and small in another. A stamp with no placement
 * sits in its automatic slot. Taking a stamp out of a book discards its placement there.
 */
import type { Prisma } from "@prisma/client";

import { StampPassportRequest, StampPlacementRequest } from "@/contracts/collections";
import type { Db } from "@/lib/db";
import type { Actor } from "@/server/actor";
import { badRequest, notFound } from "@/server/errors";
import { requireSignedIn } from "@/server/permissions";

/** The main passport's name in `/api/layouts/[book]`; any other value is a collection id. */
export const PASSPORT_BOOK = "passport";

type Placement = { stampId: string; x: number; y: number; scale: number; rotation: number };
type Layout = { x: number | null; y: number | null; scale: number | null; rotation: number | null };

const placed = (stampId: string, l: Layout): Placement | null =>
  l.x === null || l.y === null || l.scale === null || l.rotation === null ? null : { stampId, x: l.x, y: l.y, scale: l.scale, rotation: l.rotation };

async function ownLiveStamp(db: Db | Prisma.TransactionClient, userId: string, stampId: string) {
  const row = await db.photo.findFirst({ where: { id: stampId, userId, removedAt: null }, select: { id: true, inPassport: true } });
  if (!row) throw notFound("Stamp not found");
  return row;
}

async function membership(db: Db, userId: string, stampId: string) {
  const stamp = await ownLiveStamp(db, userId, stampId);
  const rows = await db.collectionStamp.findMany({ where: { stampId, collection: { userId } }, orderBy: [{ addedAt: "asc" }, { collectionId: "asc" }], select: { collectionId: true } });
  return { inPassport: stamp.inPassport, collectionIds: rows.map((r) => r.collectionId) };
}

export async function getStampMembership(db: Db, actor: Actor | null, stampId: string) {
  const me = requireSignedIn(actor);
  return membership(db, me.userId, stampId);
}

/** Puts a stamp into, or takes it out of, the main passport. Taking it out discards its passport placement. */
export async function setStampInPassport(db: Db, actor: Actor | null, stampId: string, raw: unknown) {
  const me = requireSignedIn(actor);
  const { inPassport } = StampPassportRequest.parse(raw);
  await ownLiveStamp(db, me.userId, stampId);
  await db.photo.update({
    where: { id: stampId },
    data: inPassport ? { inPassport: true } : { inPassport: false, layoutX: null, layoutY: null, layoutScale: null, layoutRotation: null },
  });
  return membership(db, me.userId, stampId);
}

async function ownCollection(db: Db, userId: string, collectionId: string) {
  const row = await db.collection.findFirst({ where: { id: collectionId, userId }, select: { id: true } });
  if (!row) throw notFound("Collection not found");
}

export async function getBookLayout(db: Db, actor: Actor | null, book: string) {
  const me = requireSignedIn(actor);
  if (book === PASSPORT_BOOK) {
    const rows = await db.photo.findMany({
      where: { userId: me.userId, removedAt: null, inPassport: true, layoutX: { not: null } },
      orderBy: { id: "asc" },
      select: { id: true, layoutX: true, layoutY: true, layoutScale: true, layoutRotation: true },
    });
    return { placements: rows.flatMap((r) => placed(r.id, { x: r.layoutX, y: r.layoutY, scale: r.layoutScale, rotation: r.layoutRotation }) ?? []) };
  }
  await ownCollection(db, me.userId, book);
  const rows = await db.collectionStamp.findMany({
    where: { collectionId: book, stamp: { removedAt: null }, x: { not: null } },
    orderBy: { stampId: "asc" },
    select: { stampId: true, x: true, y: true, scale: true, rotation: true },
  });
  return { placements: rows.flatMap((r) => placed(r.stampId, r) ?? []) };
}

/** Saves where the owner placed one stamp in one book, or `{ reset: true }` to send it back to its automatic spot. */
export async function setStampPlacement(db: Db, actor: Actor | null, book: string, stampId: string, raw: unknown) {
  const me = requireSignedIn(actor);
  const input = StampPlacementRequest.parse(raw);
  const layout: Layout = "reset" in input ? { x: null, y: null, scale: null, rotation: null } : input;
  const stamp = await ownLiveStamp(db, me.userId, stampId);
  if (book === PASSPORT_BOOK) {
    if (!stamp.inPassport) throw badRequest("This stamp is not in your passport");
    await db.photo.update({ where: { id: stampId }, data: { layoutX: layout.x, layoutY: layout.y, layoutScale: layout.scale, layoutRotation: layout.rotation } });
  } else {
    await ownCollection(db, me.userId, book);
    const updated = await db.collectionStamp.updateMany({ where: { collectionId: book, stampId }, data: layout });
    if (!updated.count) throw badRequest("This stamp is not in that collection");
  }
  return getBookLayout(db, me, book);
}
