import { createHmac, timingSafeEqual } from "node:crypto";

import type { Db } from "@/lib/db";
import { pageAndSlot } from "@/lib/layout";
import type { Actor } from "@/server/actor";
import { notFound } from "@/server/errors";
import { requireSignedIn } from "@/server/permissions";
import { getStamp } from "@/server/services/stamps";

const TOKEN_VERSION = "cs1";
const TOKEN_PATTERN = /^cs1\.([a-z0-9]{10,64})\.([A-Za-z0-9_-]{43})$/;

function shareSecret() {
  const value = process.env.SHARE_TOKEN_SECRET?.trim();
  if (!value || value.length < 32) throw new Error("SHARE_TOKEN_SECRET must be at least 32 characters");
  return value;
}

function signature(shareId: string) {
  return createHmac("sha256", shareSecret()).update(`${TOKEN_VERSION}:${shareId}`).digest("base64url");
}

export function collectionShareToken(shareId: string) {
  return `${TOKEN_VERSION}.${shareId}.${signature(shareId)}`;
}

export function collectionShareIdFromToken(token: string) {
  const match = TOKEN_PATTERN.exec(token);
  if (!match) return null;
  const shareId = match[1]!;
  const actual = Buffer.from(match[2]!, "utf8");
  const expected = Buffer.from(signature(shareId), "utf8");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return shareId;
}

export function publicCollectionShareUrl(shareId: string) {
  const configured = process.env.PUBLIC_WEB_URL?.trim().replace(/\/+$/, "");
  const base = configured || (process.env.APP_ENV === "production"
    ? "https://nostospassport.com"
    : process.env.APP_ENV === "preview"
      ? "https://preview-api.nostospassport.com"
      : "http://localhost:3001");
  return `${base}/c/${encodeURIComponent(collectionShareToken(shareId))}`;
}

async function ownCollection(db: Db, actor: Actor | null, collectionId: string) {
  const me = requireSignedIn(actor);
  const collection = await db.collection.findFirst({
    where: { id: collectionId, userId: me.userId },
    select: { id: true, share: { select: { id: true } } },
  });
  if (!collection) throw notFound("Collection not found");
  return collection;
}

function shareStatus(shareId: string | null) {
  return {
    share: shareId
      ? { enabled: true as const, url: publicCollectionShareUrl(shareId) }
      : { enabled: false as const, url: null },
  };
}

export async function getCollectionShareStatus(db: Db, actor: Actor | null, collectionId: string) {
  const collection = await ownCollection(db, actor, collectionId);
  return shareStatus(collection.share?.id ?? null);
}

export async function enableCollectionShare(db: Db, actor: Actor | null, collectionId: string, now = new Date()) {
  await ownCollection(db, actor, collectionId);
  const share = await db.collectionShare.upsert({
    where: { collectionId },
    update: {},
    create: { collectionId, createdAt: now },
    select: { id: true },
  });
  return shareStatus(share.id);
}

export async function disableCollectionShare(db: Db, actor: Actor | null, collectionId: string) {
  await ownCollection(db, actor, collectionId);
  await db.collectionShare.deleteMany({ where: { collectionId } });
  return shareStatus(null);
}

export async function resolveCollectionShare(db: Db, token: string, now = new Date()) {
  const shareId = collectionShareIdFromToken(token);
  if (!shareId) throw notFound("Shared collection not found");

  const share = await db.collectionShare.findUnique({
    where: { id: shareId },
    select: {
      collection: {
        select: {
          name: true,
          color: true,
          updatedAt: true,
          user: { select: { id: true, handle: true, displayName: true, geofenceExempt: true, deletedAt: true } },
          stamps: {
            where: { stamp: { removedAt: null } },
            orderBy: [{ position: "asc" }, { addedAt: "asc" }],
            select: { stampId: true },
          },
        },
      },
    },
  });
  if (!share || share.collection.user.deletedAt) throw notFound("Shared collection not found");

  const owner: Actor = {
    userId: share.collection.user.id,
    handle: share.collection.user.handle,
    displayName: share.collection.user.displayName,
    geofenceExempt: share.collection.user.geofenceExempt,
  };
  const stamps = await Promise.all(share.collection.stamps.map(({ stampId }) => getStamp(db, owner, stampId, now).then((result) => result.stamp)));

  return {
    owner: { displayName: owner.displayName },
    collection: {
      name: share.collection.name,
      color: share.collection.color,
      stampCount: stamps.length,
      updatedAt: share.collection.updatedAt,
      stamps: stamps.map((stamp, index) => ({ ...stamp, ...pageAndSlot(index) })),
    },
  };
}
