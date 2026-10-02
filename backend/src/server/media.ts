import { getStorage } from "@/lib/storage";

/**
 * Short-lived signed GET URL for a stored image (15-20 min, see lib/storage). Only ever called for content the
 * viewer may see: visible stamps, avatars shown under the privacy rules, or (for moderators) flagged stamps in the queue.
 */
export const uploadUrl = (key: string, now = new Date()) => getStorage().signedUrl(key, now);
