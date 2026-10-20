import type { Prisma } from "@prisma/client";

import { StampCollectionsRequest } from "@/contracts/collections";
import { badRequest } from "@/server/errors";

export async function appendStampToCollections(
  tx: Prisma.TransactionClient,
  userId: string,
  stampId: string,
  rawCollectionIds: string[],
  now: Date,
) {
  const { collectionIds } = StampCollectionsRequest.parse({ collectionIds: rawCollectionIds });
  if (!collectionIds.length) return;
  if (new Set(collectionIds).size !== collectionIds.length) throw badRequest("Each collection can be selected once");
  const owned = await tx.collection.findMany({ where: { id: { in: collectionIds }, userId }, select: { id: true } });
  if (owned.length !== collectionIds.length) throw badRequest("You can only add stamps to your own collections");

  for (const collectionId of collectionIds) {
    const last = await tx.collectionStamp.findFirst({
      where: { collectionId },
      orderBy: [{ position: "desc" }, { addedAt: "desc" }],
      select: { position: true },
    });
    await tx.collectionStamp.create({
      data: { collectionId, stampId, position: (last?.position ?? -1) + 1, addedAt: now },
    });
  }
}
