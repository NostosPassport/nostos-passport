/**
 * Likes and featuring rules, pure and in one place.
 *
 * Everyone signed in can like a shared post they can see. Only **eligible** likes count toward featuring:
 *  - from a USER account (not a venue account or staff) at least 7 days old with reputation at least 0.5;
 *  - not from the post's author, and not from an owner of that venue;
 *  - not from an App Review account (`countable = false` when liked, or flagged since), not deleted or suspended;
 *  - made by the night's cutoff: 5:05am, when the job is scheduled.
 * Account age is judged at the cutoff too, so a late or catch-up run gives the same result as an on-time one.
 * Reputation, ownership and suspension are read when the job runs (there's no history of them).
 *
 * Nightly featuring: for each venue and night, rank that night's shared, visible posts by eligible likes (ties:
 * the earlier post wins, then the smaller id), keep those with at least 3, and store the top 20 with their rank.
 * The gallery shows the top 10 still visible.
 */
import { DAY_MS } from "@/lib/time";

export const LIKE_MIN_ACCOUNT_AGE_MS = 7 * DAY_MS;
export const LIKE_MIN_REPUTATION = 0.5;
export const FEATURE_MIN_LIKES = 3;
export const FEATURE_STORE_TOP = 20;
export const FEATURE_SHOW_TOP = 10;
/** Likes count until this long after the night ends (the job's scheduled time). */
export const FEATURE_CUTOFF_AFTER_NIGHT_MS = 5 * 60_000;

export type Liker = {
  id: string;
  role: "USER" | "VENUE_OWNER" | "MODERATOR" | "ADMIN";
  createdAt: Date;
  reputation: number;
  deleted: boolean;
  suspended: boolean;
  /** App Review / QA account now (its likes never count, whenever it was flagged). */
  geofenceExempt: boolean;
  /** Venues with an approved claim (at run time). */
  ownedVenueIds: readonly string[];
};

export type LikeRow = { countable: boolean; createdAt: Date };
export type PostRef = { authorId: string; venueId: string };

/** `cutoff`: the night's end plus 5 minutes (see featuring.ts), not the moment the job happens to run. */
export function isEligibleLike(like: LikeRow, liker: Liker, post: PostRef, cutoff: Date): boolean {
  if (!like.countable || like.createdAt > cutoff) return false;
  if (liker.deleted || liker.suspended || liker.geofenceExempt) return false;
  if (liker.role !== "USER") return false;
  if (liker.createdAt.getTime() > cutoff.getTime() - LIKE_MIN_ACCOUNT_AGE_MS) return false;
  if (liker.reputation < LIKE_MIN_REPUTATION) return false;
  if (liker.id === post.authorId) return false;
  if (liker.ownedVenueIds.includes(post.venueId)) return false;
  return true;
}

export type Candidate = { id: string; createdAt: Date; eligibleLikes: number };

/** One venue-night: posts with at least 3 eligible likes, best first, top 20, ranked 1..n. */
export function rankNight(posts: readonly Candidate[]): (Candidate & { rank: number })[] {
  return posts
    .filter((p) => p.eligibleLikes >= FEATURE_MIN_LIKES)
    .sort((a, b) => b.eligibleLikes - a.eligibleLikes || a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, FEATURE_STORE_TOP)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

/** The gallery for one night: stored ranks in order, skipping ones no longer visible, top 10. */
export function visibleTop<T extends { rank: number }>(rows: readonly T[], isVisible: (row: T) => boolean): T[] {
  return [...rows].sort((a, b) => a.rank - b.rank).filter(isVisible).slice(0, FEATURE_SHOW_TOP);
}
