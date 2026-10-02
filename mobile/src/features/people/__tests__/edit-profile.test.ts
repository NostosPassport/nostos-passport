import { goesPublic, goingPublicAlert, privacyNote, profileChanges, shouldOfferApproveAll } from "../edit-profile";

const priv = { displayName: "Sam", bio: "", isPrivate: true };

describe("going public", () => {
  it("is detected only when a private account is switched to public", () => {
    expect(goesPublic(priv, profileChanges(priv, { ...priv, isPrivate: false }))).toBe(true);
    expect(goesPublic(priv, profileChanges(priv, { ...priv, bio: "hi" }))).toBe(false);
    const pub = { ...priv, isPrivate: false };
    expect(goesPublic(pub, profileChanges(pub, { ...pub, isPrivate: true }))).toBe(false);
    expect(goesPublic(pub, profileChanges(pub, pub))).toBe(false);
  });

  it("the confirm alert lists exactly what changes: all stamps and every place, to anyone", () => {
    const a = goingPublicAlert({ stamps: 12, places: 5 });
    expect(a.title).toBe("Make your passport public?");
    expect(a.message).toMatch(/Anyone, signed in or not/);
    expect(a.message).toMatch(/all of your stamps \(photos, captions and songs\)/);
    expect(a.message).toMatch(/every place you've been/);
    expect(a.message).toMatch(/already stamped/);
    expect(a.message).toMatch(/12 stamps and 5 places/);
    expect(a.message).toMatch(/follow you without asking/);
    expect(a.message).toMatch(/switch back to private/);
    expect(a.confirm).toBe("Make public");
  });

  it("uses singular counts and works without counts", () => {
    expect(goingPublicAlert({ stamps: 1, places: 1 }).message).toMatch(/1 stamp and 1 place so far/);
    expect(goingPublicAlert().message).not.toMatch(/so far/);
    expect(goingPublicAlert({ stamps: 0, places: 0 }).message).not.toMatch(/so far/);
  });

  it("the toggle's note says what each state means and never mentions Anonymous", () => {
    expect(privacyNote(true)).toMatch(/Only people you approve see your stamps, places and counts/);
    expect(privacyNote(false)).toMatch(/Anyone can see your passport/);
    expect(privacyNote(true) + privacyNote(false)).not.toMatch(/Anonymous/);
  });

  it("offers Approve all only after going public with requests waiting", () => {
    expect(shouldOfferApproveAll({ isPrivate: false }, 3)).toBe(true);
    expect(shouldOfferApproveAll({ isPrivate: false }, 0)).toBe(false);
    expect(shouldOfferApproveAll({ isPrivate: true }, 3)).toBe(false);
  });
});
