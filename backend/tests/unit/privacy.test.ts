import { describe, expect, it } from "vitest";
import { canSeeStamp, personView, profileAccess, viewerOf, type StampSubject, type Viewer } from "@/server/privacy";

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
      expect(profileAccess(viewer, { id: SUBJECT_ID, isPrivate: true, deleted: false }, follows)).toBe(FULL_FOR_PRIVATE.includes(kind as Kind) ? "full" : "limited");
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

  it("a suspended account is limited to everyone but staff and itself", () => {
    const s = { id: SUBJECT_ID, isPrivate: false, deleted: false, suspended: true };
    expect(profileAccess(viewers.stranger!.viewer, s, false)).toBe("limited");
    expect(profileAccess(viewers.follower!.viewer, s, true)).toBe("limited");
    expect(profileAccess(viewers.moderator!.viewer, s, false)).toBe("full");
  });
});

describe("personView: a limited view shows the handle and badge only", () => {
  const person = { handle: "maya", displayName: "Maya", verified: true };
  it("full shows everything, limited hides the name and photo", () => {
    expect(personView("full", person, "https://x/a.jpg")).toEqual({ handle: "maya", displayName: "Maya", avatarUrl: "https://x/a.jpg", verified: true });
    expect(personView("limited", person, "https://x/a.jpg")).toEqual({ handle: "maya", displayName: null, avatarUrl: null, verified: true });
  });
});

describe("canSeeStamp: every viewer x every stamp state", () => {
  const base: StampSubject = { authorId: SUBJECT_ID, hidden: false, removed: false, countable: true };
  const self = viewers.self!.viewer;
  const mod = viewers.moderator!.viewer;
  const stranger = viewers.stranger!.viewer;

  for (const [kind, { viewer }] of Object.entries(viewers)) {
    it(`${kind} sees a stamp exactly when they may see its author in full`, () => {
      for (const isPrivate of [false, true]) {
        const follows = viewers[kind]!.follows;
        const access = profileAccess(viewer, { id: SUBJECT_ID, isPrivate, deleted: false }, follows);
        expect(canSeeStamp(viewer, base, access)).toBe(access === "full");
      }
    });
  }

  it("hidden and removed stamps are for staff only, not even the author", () => {
    for (const state of [{ hidden: true }, { removed: true }]) {
      const s = { ...base, ...state };
      expect(canSeeStamp(mod, s, "full")).toBe(true);
      expect(canSeeStamp(self, s, "full")).toBe(false);
      expect(canSeeStamp(viewers.follower!.viewer, s, "full")).toBe(false);
      expect(canSeeStamp(stranger, s, "full")).toBe(false);
    }
  });

  it("a block hides the stamp from the other side; the author still sees it; staff always do", () => {
    expect(canSeeStamp(stranger, base, "limited", true)).toBe(false);
    expect(canSeeStamp(viewers.follower!.viewer, base, "full", true)).toBe(false);
    expect(canSeeStamp(mod, base, "full", true)).toBe(true);
    expect(canSeeStamp(self, base, "full", true)).toBe(true);
  });

  it("App Review stamps open for their author and staff only", () => {
    const exempt = { ...base, countable: false };
    expect(canSeeStamp(self, exempt, "full")).toBe(true);
    expect(canSeeStamp(mod, exempt, "full")).toBe(true);
    expect(canSeeStamp(stranger, exempt, "full")).toBe(false);
    expect(canSeeStamp(viewers.follower!.viewer, exempt, "full")).toBe(false);
  });

  it("signed-out viewers see a stamp only of a public author", () => {
    expect(canSeeStamp(null, base, "full")).toBe(true);
    expect(canSeeStamp(null, base, "limited")).toBe(false);
  });
});

describe("viewerOf", () => {
  const actor = (role: "USER" | "MODERATOR" | "ADMIN") => ({ userId: "u", role, handle: "u", displayName: "U", geofenceExempt: false });
  it("staff are moderators and admins only", () => {
    expect(viewerOf(actor("MODERATOR"))?.staff).toBe(true);
    expect(viewerOf(actor("ADMIN"))?.staff).toBe(true);
    expect(viewerOf(actor("USER"))?.staff).toBe(false);
    expect(viewerOf(null)).toBeNull();
  });
});
