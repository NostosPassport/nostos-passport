/** Rules for the post composer (camera-only photo, then rating, caption and sharing). */

/** Live-only photo captions stay at 140; a post (with a rating) allows 280, as on the server. */
export const LIVE_CAPTION_MAX = 140;
export const POST_CAPTION_MAX = 280;

export function captionMax(rating: number | null): number {
  return rating === null ? LIVE_CAPTION_MAX : POST_CAPTION_MAX;
}

/** "Share to venue page" starts on for public accounts and off for private ones (the server's default too). */
export function defaultShare(isPrivate: boolean): boolean {
  return !isPrivate;
}
