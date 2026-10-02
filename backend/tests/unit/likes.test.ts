import { describe, expect, it } from "vitest";
import { FEATURE_MIN_LIKES, FEATURE_SHOW_TOP, FEATURE_STORE_TOP, LIKE_MIN_ACCOUNT_AGE_MS, LIKE_MIN_REPUTATION, isEligibleLike, rankNight, visibleTop, type Liker } from "@/lib/likes";
import { DAY_MS } from "@/lib/time";

const RUN = new Date("2026-10-10T09:05:00Z");
const liker = (o: Partial<Liker> = {}): Liker => ({
  id: "liker", role: "USER", createdAt: new Date(RUN.getTime() - 30 * DAY_MS), reputation: 0.8, deleted: false, suspended: false, geofenceExempt: false, ownedVenueIds: [], ...o,
});
const like = { countable: true, createdAt: new Date(RUN.getTime() - 3600_000) };
const post = { authorId: "author", venueId: "venue" };

describe("eligible likes", () => {
  it("constants match the spec", () => {
    expect([LIKE_MIN_ACCOUNT_AGE_MS / DAY_MS, LIKE_MIN_REPUTATION, FEATURE_MIN_LIKES, FEATURE_STORE_TOP, FEATURE_SHOW_TOP]).toEqual([7, 0.5, 3, 20, 10]);
  });

  it("a regular, established user's like counts", () => {
    expect(isEligibleLike(like, liker(), post, RUN)).toBe(true);
  });

  it("account age: at least 7 days at run time (inclusive)", () => {
    expect(isEligibleLike(like, liker({ createdAt: new Date(RUN.getTime() - 7 * DAY_MS) }), post, RUN)).toBe(true);
    expect(isEligibleLike(like, liker({ createdAt: new Date(RUN.getTime() - 7 * DAY_MS + 1) }), post, RUN)).toBe(false);
  });

  it("reputation: at least 0.5 (inclusive)", () => {
    expect(isEligibleLike(like, liker({ reputation: 0.5 }), post, RUN)).toBe(true);
    expect(isEligibleLike(like, liker({ reputation: 0.49 }), post, RUN)).toBe(false);
  });

  it("USER accounts only: venue accounts and staff don't count", () => {
    for (const role of ["VENUE_OWNER", "MODERATOR", "ADMIN"] as const) expect(isEligibleLike(like, liker({ role }), post, RUN)).toBe(false);
  });

  it("not the author, and not an owner of that venue (even with role USER)", () => {
    expect(isEligibleLike(like, liker({ id: "author" }), post, RUN)).toBe(false);
    expect(isEligibleLike(like, liker({ ownedVenueIds: ["venue"] }), post, RUN)).toBe(false);
    expect(isEligibleLike(like, liker({ ownedVenueIds: ["other"] }), post, RUN)).toBe(true);
  });

  it("not App Review likes, not deleted or suspended accounts, not likes after the run", () => {
    expect(isEligibleLike({ ...like, countable: false }, liker(), post, RUN)).toBe(false);
    expect(isEligibleLike(like, liker({ deleted: true }), post, RUN)).toBe(false);
    expect(isEligibleLike(like, liker({ suspended: true }), post, RUN)).toBe(false);
    // Flagged as an App Review account after liking: still doesn't count.
    expect(isEligibleLike(like, liker({ geofenceExempt: true }), post, RUN)).toBe(false);
    expect(isEligibleLike({ ...like, createdAt: new Date(RUN.getTime() + 1) }, liker(), post, RUN)).toBe(false);
  });
});

describe("ranking a venue's night", () => {
  const t = (m: number) => new Date(RUN.getTime() - 10 * 3600_000 + m * 60_000);

  it("needs 3 eligible likes; ranks by likes, then the earlier post, then the id", () => {
    const ranked = rankNight([
      { id: "c", createdAt: t(5), eligibleLikes: 4 },
      { id: "a", createdAt: t(1), eligibleLikes: 2 },
      { id: "b", createdAt: t(2), eligibleLikes: 4 },
      { id: "d", createdAt: t(0), eligibleLikes: 9 },
      { id: "f", createdAt: t(2), eligibleLikes: 4 },
    ]);
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([["d", 1], ["b", 2], ["f", 3], ["c", 4]]);
  });

  it("keeps the top 20", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: `p${String(i).padStart(2, "0")}`, createdAt: t(i), eligibleLikes: 30 - i }));
    const ranked = rankNight(many);
    expect(ranked).toHaveLength(20);
    expect(ranked.at(-1)).toMatchObject({ id: "p19", rank: 20 });
  });

  it("is deterministic regardless of input order", () => {
    const posts = Array.from({ length: 12 }, (_, i) => ({ id: `x${i}`, createdAt: t(i % 3), eligibleLikes: 3 + (i % 4) }));
    expect(rankNight([...posts].reverse())).toEqual(rankNight(posts));
  });

  it("the gallery shows the top 10 still visible: a hidden one is replaced by the next rank", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ rank: i + 1, id: `r${i + 1}` }));
    expect(visibleTop(rows, () => true).map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(visibleTop(rows, (r) => r.rank !== 3).map((r) => r.rank)).toEqual([1, 2, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
});
