import { getStorage } from "@/lib/storage";

/**
 * Short-lived signed GET URL for a stored image (15-20 min, see lib/storage). Only ever called for content the
 * viewer may see: visible stamps, avatars shown under the privacy rules, or (for moderators) flagged stamps in the queue.
 */
export const uploadUrl = (key: string, now = new Date()) => getStorage().signedUrl(key, now);

/** Every summary uses the first live photograph in layout order, never the immutable legacy storage key. */
export const livePhotoCoverSelect = {
  photos: {
    where: { removedAt: null },
    orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }],
    take: 1,
    select: { storageKey: true as const },
  },
};
