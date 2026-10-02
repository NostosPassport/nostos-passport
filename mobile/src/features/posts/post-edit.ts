import type { PostEditRequest, PostView } from "@/api/contracts";

export const CAPTION_MAX = 280;

export type PostValues = { rating: number; caption: string; shared: boolean };

/** Your own post's rating can change until the end of its night (the server's `ratingEditableUntil`). */
export function ratingEditable(post: Pick<PostView, "mine" | "ratingEditableUntil">, now: Date = new Date()): boolean {
  return post.mine && post.ratingEditableUntil !== null && Date.parse(post.ratingEditableUntil) > now.getTime();
}

/** Only what changed. The rating is left out once it's locked, even if the value differs. */
export function postChanges(initial: PostValues, values: PostValues, canEditRating: boolean): PostEditRequest {
  const out: PostEditRequest = {};
  if (canEditRating && values.rating !== initial.rating) out.rating = values.rating;
  if (values.caption.trim() !== initial.caption.trim()) out.caption = values.caption.trim();
  if (values.shared !== initial.shared) out.shared = values.shared;
  return out;
}
