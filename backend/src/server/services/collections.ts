import type { Prisma } from "@prisma/client";

import { CollectionCreateRequest, CollectionUpdateRequest, StampCollectionsRequest } from "@/contracts/collections";
import type { Db } from "@/lib/db";
import { pageAndSlot } from "@/lib/layout";
import type { Actor } from "@/server/actor";
import { assertCleanText, badRequest, notFound } from "@/server/errors";
import { requireSignedIn } from "@/server/permissions";
import { getStamp } from "@/server/services/stamps";

function uniqueStampIds(stampIds: string[]) {
  if (new Set(stampIds).size !== stampIds.length) throw badRequest("Each stamp can appear once in a collection");
  return stampIds;
}

async function assertOwnStamps(db: Db | Prisma.TransactionClient, userId: string, stampIds: string[]) {
  uniqueStampIds(stampIds);
  if (!stampIds.length) return;
  const rows = await db.photo.findMany({ where: { id: { in: stampIds }, userId, removedAt: null }, select: { id: true } });
  if (rows.length !== stampIds.length) throw badRequest("Collections can only include your own stamps");
}

async function assertOwnCollections(db: Db | Prisma.TransactionClient, userId: string, collectionIds: string[]) {
  if (new Set(collectionIds).size !== collectionIds.length) throw badRequest("Each collection can be selected once");
  if (!collectionIds.length) return;
  const rows = await db.collection.findMany({ where: { id: { in: collectionIds }, userId }, select: { id: true } });
  if (rows.length !== collectionIds.length) throw badRequest("You can only add stamps to your own collections");
}

export async function listCollections(db: Db, actor: Actor | null) {
  const me = requireSignedIn(actor);
  const rows = await db.collection.findMany({
    where: { userId: me.userId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      color: true,
      createdAt: true,
      updatedAt: true,
      stamps: { where: { stamp: { removedAt: null } }, select: { stampId: true } },
    },
  });
  return {
    collections: rows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      stampCount: row.stamps.length,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
  };
}

export async function getCollection(db: Db, actor: Actor | null, id: string, now = new Date()) {
  const me = requireSignedIn(actor);
  const row = await db.collection.findFirst({
    where: { id, userId: me.userId },
    select: {
      id: true,
      name: true,
      color: true,
      createdAt: true,
      updatedAt: true,
      stamps: {
        where: { stamp: { removedAt: null } },
        orderBy: [{ position: "asc" }, { addedAt: "asc" }],
        select: { stampId: true },
      },
    },
  });
  if (!row) throw notFound("Collection not found");
  const stamps = await Promise.all(row.stamps.map((membership) => getStamp(db, me, membership.stampId, now).then((result) => result.stamp)));
  return {
    collection: {
      id: row.id,
      name: row.name,
      color: row.color,
      stampCount: stamps.length,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      stamps: stamps.map((stamp, index) => ({ ...stamp, ...pageAndSlot(index) })),
    },
  };
}

export async function createCollection(db: Db, actor: Actor | null, raw: unknown, now = new Date()) {
  const me = requireSignedIn(actor);
  const input = CollectionCreateRequest.parse(raw);
  assertCleanText({ "collection name": input.name });
  await assertOwnStamps(db, me.userId, input.stampIds);
  const id = await db.$transaction(async (tx) => {
    const collection = await tx.collection.create({ data: { userId: me.userId, name: input.name, color: input.color, createdAt: now, updatedAt: now }, select: { id: true } });
    if (input.stampIds.length) {
      await tx.collectionStamp.createMany({ data: input.stampIds.map((stampId, position) => ({ collectionId: collection.id, stampId, position, addedAt: now })) });
    }
    return collection.id;
  });
  return getCollection(db, me, id, now);
}

export async function updateCollection(db: Db, actor: Actor | null, id: string, raw: unknown, now = new Date()) {
  const me = requireSignedIn(actor);
  const input = CollectionUpdateRequest.parse(raw);
  if (input.name !== undefined) assertCleanText({ "collection name": input.name });
  if (input.stampIds !== undefined) await assertOwnStamps(db, me.userId, input.stampIds);
  const existing = await db.collection.findFirst({ where: { id, userId: me.userId }, select: { id: true } });
  if (!existing) throw notFound("Collection not found");
  await db.$transaction(async (tx) => {
    await tx.collection.update({ where: { id }, data: { name: input.name, color: input.color, updatedAt: now } });
    if (input.stampIds !== undefined) {
      await tx.collectionStamp.deleteMany({ where: { collectionId: id } });
      if (input.stampIds.length) {
        await tx.collectionStamp.createMany({ data: input.stampIds.map((stampId, position) => ({ collectionId: id, stampId, position, addedAt: now })) });
      }
    }
  });
  return getCollection(db, me, id, now);
}

export async function deleteCollection(db: Db, actor: Actor | null, id: string) {
  const me = requireSignedIn(actor);
  const deleted = await db.collection.deleteMany({ where: { id, userId: me.userId } });
  if (!deleted.count) throw notFound("Collection not found");
  return { deleted: true as const };
}

export async function appendStampToCollections(tx: Prisma.TransactionClient, userId: string, stampId: string, rawCollectionIds: string[], now: Date) {
  const { collectionIds } = StampCollectionsRequest.parse({ collectionIds: rawCollectionIds });
  await assertOwnCollections(tx, userId, collectionIds);
  for (const collectionId of collectionIds) {
    const last = await tx.collectionStamp.findFirst({ where: { collectionId }, orderBy: [{ position: "desc" }, { addedAt: "desc" }], select: { position: true } });
    await tx.collectionStamp.create({ data: { collectionId, stampId, position: (last?.position ?? -1) + 1, addedAt: now } });
  }
}

export async function setStampCollections(db: Db, actor: Actor | null, stampId: string, raw: unknown, now = new Date()) {
  const me = requireSignedIn(actor);
  const { collectionIds } = StampCollectionsRequest.parse(raw);
  const stamp = await db.photo.findFirst({ where: { id: stampId, userId: me.userId, removedAt: null }, select: { id: true } });
  if (!stamp) throw notFound("Stamp not found");
  await assertOwnCollections(db, me.userId, collectionIds);

  await db.$transaction(async (tx) => {
    const existing = await tx.collectionStamp.findMany({ where: { stampId }, select: { collectionId: true } });
    const existingIds = new Set(existing.map((row) => row.collectionId));
    if (collectionIds.length > 0) {
      await tx.collectionStamp.deleteMany({ where: { stampId, collectionId: { notIn: collectionIds } } });
    } else {
      await tx.collectionStamp.deleteMany({ where: { stampId } });
    }
    for (const collectionId of collectionIds) {
      if (existingIds.has(collectionId)) continue;
      const last = await tx.collectionStamp.findFirst({ where: { collectionId }, orderBy: [{ position: "desc" }, { addedAt: "desc" }], select: { position: true } });
      await tx.collectionStamp.create({ data: { collectionId, stampId, position: (last?.position ?? -1) + 1, addedAt: now } });
    }
  });

  return { collectionIds };
}
