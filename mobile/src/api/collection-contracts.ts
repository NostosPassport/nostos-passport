import { z } from "zod";

import { IsoDate, StampView } from "./contracts";

export const COLLECTION_NAME_MAX = 32;
export const MAX_COLLECTIONS_PER_STAMP = 20;
export const CollectionColor = z.enum(["blue", "navy", "green", "burgundy", "sand", "plum"]);
export const CollectionStampIds = z.array(z.string().min(1).max(64)).max(1000);
export const StampCollectionsRequest = z.object({ collectionIds: z.array(z.string().min(1).max(64)).max(MAX_COLLECTIONS_PER_STAMP) }).strict();
export const StampCollectionsResponse = z.object({ collectionIds: z.array(z.string()) }).strict();

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
export const CollectionShare = z.discriminatedUnion("enabled", [
  z.object({ enabled: z.literal(false), url: z.null() }).strict(),
  z.object({ enabled: z.literal(true), url: z.string().url() }).strict(),
]);
export const CollectionShareResponse = z.object({ share: CollectionShare }).strict();

/** Where the owner placed a stamp on its page in one book: centre as fractions of the page, size relative to its automatic size, tilt in degrees. */
export const StampPlacementInput = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  scale: z.number().min(0.4).max(2.5),
  rotation: z.number().min(-180).max(180),
}).strict();
export const StampPlacement = StampPlacementInput.extend({ stampId: z.string() }).strict();
/** A placement to save, or `reset` to put the stamp back in its automatic spot. */
export const StampPlacementRequest = z.union([StampPlacementInput, z.object({ reset: z.literal(true) }).strict()]);
/** Every stamp the owner has moved in one book (`passport` or a collection id); stamps not listed sit in their automatic spot. */
export const BookLayoutResponse = z.object({ placements: z.array(StampPlacement) }).strict();
/** Which books hold a stamp. Every stamp is always in the gallery. */
export const StampMembershipResponse = z.object({ inPassport: z.boolean(), collectionIds: z.array(z.string()) }).strict();
export const StampPassportRequest = z.object({ inPassport: z.boolean() }).strict();

export type CollectionColorValue = z.infer<typeof CollectionColor>;
export type CollectionCreateInput = z.infer<typeof CollectionCreateRequest>;
export type CollectionUpdateInput = z.infer<typeof CollectionUpdateRequest>;
export type CollectionSummaryData = z.infer<typeof CollectionSummary>;
export type CollectionData = z.infer<typeof CollectionView>;
export type CollectionShareData = z.infer<typeof CollectionShare>;
export type StampPlacementData = z.infer<typeof StampPlacement>;
export type StampPlacementInputData = z.infer<typeof StampPlacementInput>;
export type StampMembershipData = z.infer<typeof StampMembershipResponse>;
