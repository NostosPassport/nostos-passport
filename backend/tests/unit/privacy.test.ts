import { describe, expect, it } from "vitest";
import {
  canSeePhoto, inVenueFeed, personView, profileAccess, resolveAuthor, viewerOf,
  type PhotoSubject, type Viewer,
} from "@/server/privacy";

const SUBJECT_ID = "subject";

/** Every kind of viewer. A pending follow request grants nothing, so "requester" behaves like a stranger. */
const viewers: Record<string, { viewer: Viewer; follows: boolean }> = {
  anonymous: { viewer: null, follows: false },
  self: { viewer: { userId: SUBJECT_ID, staff: false }, follows: false },
  follower: { viewer: { userId: "follower", staff: false }, follows: true },
  requester: { viewer: { userId: "requester", staff: false }, follows: false },
  stranger: { viewer: { userId: "stranger", staff: false }, follows: false },
  moderator: { viewer: { userId: "mod", staff: true }, follows: false },
};

type Kind = keyof typeof viewers;
const FULL_FOR_PRIVATE: Kind[] = ["self", "follower", "moderator"];

describe("profileAccess: every viewer x every account state", () => {
  for (const [kind, { viewer, follows }] of Object.entries(viewers)) {
    it(`${kind} sees a public account in full`, () => {
      expect(profileAccess(viewer, { id: SUBJECT_ID, isPrivate: false, deleted: false }, follows)).toBe("full");
    });
    it(`${kind} sees a private account ${FULL_FOR_PRIVATE.includes(kind as Kind) ? "in full" : "limited"}`, () => {
      expect(profileAccess(viewer, { id: SUBJECT_ID, isPrivate: true, deleted: false }, follows)).toBe(
        FULL_FOR_PRIVATE.includes(kind as Kind) ? "full" : "limited",
      );
    });
    it(`${kind} never sees a deleted account in full`, () => {
      expect(profileAccess(viewer, { id: SUBJECT_ID, isPrivate: false, deleted: true }, follows)).toBe("limited");
      expect(profileAccess(viewer, { id: SUBJECT_ID, isPrivate: true, deleted: true }, follows)).toBe("limited");
    });
  }

  it("a block (either direction) means limited, even for a follower of a public account; staff and self are unaffected", () => {
    for (const isPrivate of [false, true]) {
      const s = { id: SUBJECT_ID, isPrivate, deleted: false };
      expect(profileAccess(viewers.stranger!.viewer, s, false, true)).toBe("limited");
      expect(profileAccess(viewers.follower!.viewer, s, true, true)).toBe("limited");
      expect(profileAccess(viewers.moderator!.viewer, s, false, true)).toBe("full");
      expect(profileAccess(viewers.self!.viewer, s, false, true)).toBe("full");
    }
  });

  it("a signed-out viewer can't be a follower even if the flag says so", () => {
    expect(profileAccess(null, { id: SUBJECT_ID, isPrivate: true, deleted: false }, true)).toBe("limited");
  });
});

describe("resolveAuthor: handles reach only viewers who may see them", () => {
  const author = (isPrivate: boolean, verified: boolean, deleted = false) => ({ id: SUBJECT_ID, handle: "maya", isPrivate, deleted, verified });

  for (const [kind, { viewer, follows }] of Object.entries(viewers)) {
    for (const verified of [false, true]) {
      it(`${kind}, public author, verified=${verified}: handle + badge + Regular`, () => {
        expect(resolveAuthor(viewer, author(false, verified), follows, true)).toEqual({ kind: "user", handle: "maya", verified, regular: true });
      });
      it(`${kind}, private author, verified=${verified}`, () => {
        const got = resolveAuthor(viewer, author(true, verified), follows, true);
        if (FULL_FOR_PRIVATE.includes(kind as Kind)) expect(got).toEqual({ kind: "user", handle: "maya", verified, regular: true });
        else {
          // No handle, no badge, no Regular flag: nothing that identifies the author.
          expect(got).toEqual({ kind: "anonymous" });
          expect(JSON.stringify(got)).not.toContain("maya");
        }
      });
      it(`${kind}, deleted author, verified=${verified}: "Deleted user"`, () => {
        expect(resolveAuthor(viewer, author(false, verified, true), follows, true)).toEqual({ kind: "deleted" });
        expect(resolveAuthor(viewer, author(true, verified, true), follows, true)).toEqual({ kind: "deleted" });
      });
    }
  }

  it("a blocked pair sees \"Anonymous\" even for a public author", () => {
    expect(resolveAuthor(viewers.stranger!.viewer, author(false, true), false, true, true)).toEqual({ kind: "anonymous" });
    expect(resolveAuthor(viewers.moderator!.viewer, author(false, true), false, true, true)).toEqual({ kind: "user", handle: "maya", verified: true, regular: true });
  });

  it("Regular defaults to false outside a venue context", () => {
    expect(resolveAuthor(null, author(false, false), false)).toEqual({ kind: "user", handle: "maya", verified: false, regular: false });
  });
});

describe("personView: lists always show the handle and badge, the rest only with full access", () => {
  const p = { handle: "maya", displayName: "Maya R.", verified: true };
  it("full", () => expect(personView("full", p, "https://img/a")).toEqual({ handle: "maya", displayName: "Maya R.", avatarUrl: "https://img/a", verified: true }));
  it("limited hides the display name and photo", () => {
    expect(personView("limited", p, "https://img/a")).toEqual({ handle: "maya", displayName: null, avatarUrl: null, verified: true });
  });
});

describe("photos: venue feed and post detail", () => {
  const base: PhotoSubject = { authorId: SUBJECT_ID, rating: 8, shared: true, hidden: false, removed: false, countable: true };
  const stranger = viewers.stranger!.viewer;
  const self = viewers.self!.viewer;
  const mod = viewers.moderator!.viewer;

  it("shared posts and live-only photos are in the venue feed; unshared posts are not", () => {
    expect(inVenueFeed(stranger, base)).toBe(true);
    expect(inVenueFeed(stranger, { ...base, rating: null, shared: true })).toBe(true);
    expect(inVenueFeed(stranger, { ...base, shared: false })).toBe(false);
    expect(inVenueFeed(self, { ...base, shared: false })).toBe(false);
  });

  it("hidden and removed photos are in no feed, for anyone", () => {
    for (const v of [null, stranger, self, mod]) {
      expect(inVenueFeed(v, { ...base, hidden: true })).toBe(false);
      expect(inVenueFeed(v, { ...base, removed: true })).toBe(false);
    }
  });

  it("App Review photos are in the feed for their author only", () => {
    expect(inVenueFeed(self, { ...base, countable: false })).toBe(true);
    expect(inVenueFeed(stranger, { ...base, countable: false })).toBe(false);
    expect(inVenueFeed(null, { ...base, countable: false })).toBe(false);
  });

  it("an unshared post opens only for its author, approved followers (full access) and staff", () => {
    const unshared = { ...base, shared: false };
    expect(canSeePhoto(self, unshared, "full")).toBe(true);
    expect(canSeePhoto(viewers.follower!.viewer, unshared, "full")).toBe(true);
    expect(canSeePhoto(mod, unshared, "full")).toBe(true);
    expect(canSeePhoto(stranger, unshared, "limited")).toBe(false);
    expect(canSeePhoto(null, unshared, "limited")).toBe(false);
    expect(canSeePhoto(viewers.requester!.viewer, unshared, "limited")).toBe(false);
  });

  it("a shared post opens for everyone (the author is resolved separately)", () => {
    expect(canSeePhoto(null, base, "limited")).toBe(true);
    expect(canSeePhoto(stranger, base, "limited")).toBe(true);
  });

  it("hidden and removed posts open for staff only (so they can still be moderated)", () => {
    for (const state of [{ hidden: true }, { removed: true }]) {
      expect(canSeePhoto(mod, { ...base, ...state }, "full")).toBe(true);
      expect(canSeePhoto(self, { ...base, ...state }, "full")).toBe(false);
      expect(canSeePhoto(stranger, { ...base, ...state }, "limited")).toBe(false);
      expect(canSeePhoto(null, { ...base, ...state }, "limited")).toBe(false);
    }
  });

  it("post detail is for posts only: a live-only photo never opens by id", () => {
    for (const v of [null, stranger, self]) expect(canSeePhoto(v, { ...base, rating: null }, "full")).toBe(false);
  });

  it("a block hides posts both ways, shared or not; staff are unaffected", () => {
    expect(canSeePhoto(stranger, base, "limited", true)).toBe(false);
    expect(canSeePhoto(viewers.follower!.viewer, { ...base, shared: false }, "full", true)).toBe(false);
    expect(canSeePhoto(mod, base, "full", true)).toBe(true);
  });

  it("App Review posts open for their author and staff only", () => {
    const exempt = { ...base, countable: false };
    expect(canSeePhoto(self, exempt, "full")).toBe(true);
    expect(canSeePhoto(mod, exempt, "full")).toBe(true);
    expect(canSeePhoto(stranger, exempt, "full")).toBe(false);
  });
});

describe("viewerOf", () => {
  const actor = (role: "USER" | "VENUE_OWNER" | "MODERATOR" | "ADMIN") => ({ userId: "u", role, handle: "u", displayName: "U", ownedVenueIds: [], geofenceExempt: false });
  it("staff are moderators and admins only; venue owners are not", () => {
    expect(viewerOf(actor("MODERATOR"))?.staff).toBe(true);
    expect(viewerOf(actor("ADMIN"))?.staff).toBe(true);
    expect(viewerOf(actor("VENUE_OWNER"))?.staff).toBe(false);
    expect(viewerOf(actor("USER"))?.staff).toBe(false);
    expect(viewerOf(null)).toBeNull();
  });
});
