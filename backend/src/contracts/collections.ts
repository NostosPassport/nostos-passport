import { z } from "zod";

import { IsoDate, StampView } from "./api";

export const COLLECTION_NAME_MAX = 32;
export const MAX_COLLECTIONS_PER_STAMP = 20;
export const CollectionColor = z.enum(["blue", "navy", "green", "burgundy", "sand", "plum"]);
export const CollectionStampIds = z.array(z.string().min(1).max(64)).max(1000);

export const CollectionCreateRequest = z.object({
  name: z.string().trim().min(1, "Give this collection a name").max(COLLECTION_NAME_MAX),
  color: CollectionColor,
  stampIds: CollectionStampIds.default([]),
}).strict();

export const CollectionUpdateRequest = z.object({
  name: z.string().trim().min(1, "Give this collection a name").max(COLLECTION_NAME_MAX),
  color: CollectionColor,
  stampIds: CollectionStampIds,
}).partial().strict().refine((value) => Object.keys(value).length > 0, "Nothing to change");

export const CollectionSummary = z.object({
  id: z.string(),
  name: z.string(),
  color: CollectionColor,
  stampCount: z.number().int().nonnegative(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
}).strict();

export const CollectionView = CollectionSummary.extend({ stamps: z.array(StampView) }).strict();
export const CollectionsResponse = z.object({ collections: z.array(CollectionSummary) }).strict();
export const CollectionResponse = z.object({ collection: CollectionView }).strict();
export const DeleteCollectionResponse = z.object({ deleted: z.literal(true) }).strict();

export type CollectionColor = z.infer<typeof CollectionColor>;
export type CollectionCreateRequest = z.infer<typeof CollectionCreateRequest>;
export type CollectionUpdateRequest = z.infer<typeof CollectionUpdateRequest>;
export type CollectionSummary = z.infer<typeof CollectionSummary>;
export type CollectionView = z.infer<typeof CollectionView>;
