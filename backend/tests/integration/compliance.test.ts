import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { login, signup, CURRENT_TERMS_VERSION } from "@/server/services/auth";
import { deleteAccount } from "@/server/services/account";
import { blockUser, listBlocks, unblockUser } from "@/server/services/blocks";
import { recordPresence, setGoingTonight } from "@/server/services/social";
import { follow, getProfile, searchUsers } from "@/server/services/people";
import { addComment, replyAsVenue } from "@/server/services/comments";
import { submitReport } from "@/server/services/reports";
import { submitPhoto } from "@/server/services/photos";
import { createPromo } from "@/server/services/owner";
import { getVenuePage, listVenuesForMap, venueAccuracy } from "@/server/services/venues";
import { recomputeAllReputations } from "@/server/services/reputation";
import { setUserFlags } from "@/server/services/admin";
import { acceptCurrentTerms, getMe } from "@/server/services/me";
import { loadActor } from "@/server/actor";
import { GET as meRoute } from "@/app/api/me/route";
import { PATCH as adminUserRoute } from "@/app/api/admin/users/[handle]/route";
import { installMemoryStorage } from "./mem-storage";
import { PNG } from "pngjs";
import { actorFor, makeActor, makeOwner, makeUser, makeVenue, INSIDE, OUTSIDE } from "./factories";

installMemoryStorage();
const png = () => {
  const p = new PNG({ width: 2, height: 2 });
  p.data.fill(120);
  return PNG.sync.write(p);
};
const MIN = 60_000;

async function userWithPassword(handle: string, password = "correct horse battery") {
  const u = await makeUser({ handle });
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(password), email: `${handle}@real.dev` } });
  return (await actorFor(u.id))!;
}

describe("account deletion (5.1.1(v)): anonymize, never delete content", () => {
  it("requires the current password", async () => {
    const me = await userWithPassword("delme");
    await expect(deleteAccount(prisma, me, { password: "wrong" })).rejects.toMatchObject({ status: 403, code: "wrong_password" });
    await expect(deleteAccount(prisma, null, { password: "x" })).rejects.toMatchObject({ status: 401 });
  });

  it("scrubs identity, revokes sessions, removes social ties, hides photos, keeps reports and comments", async () => {
    const venue = await makeVenue();
    const me = await userWithPassword("leaver");
    const friend = await makeActor();
    const other = await makeActor();
    await follow(prisma, me, friend.handle);
    await follow(prisma, friend, me.handle);
    await blockUser(prisma, me, other.handle);
    await setGoingTonight(prisma, me, venue.id, true);
    await recordPresence(prisma, me, venue.id, INSIDE);
    await prisma.venueClaim.create({ data: { venueId: venue.id, userId: me.userId } });
    const report = await submitReport(prisma, me, venue.id, { type: "VIBE", vibe: "PACKED", ...INSIDE });
    const comment = await addComment(prisma, me, venue.id, { body: "great night" });
    const photo = await submitPhoto(prisma, me, venue.id, { bytes: png(), meta: { caption: "dance floor", ...INSIDE } });
    const { token } = await createSession(prisma, me.userId, { client: "IOS" });

    await deleteAccount(prisma, me, { password: "correct horse battery" });

    const row = await prisma.user.findUniqueOrThrow({ where: { id: me.userId } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.email).toMatch(/^deleted-[a-f0-9]{16}@deleted\.invalid$/);
    expect(row.handle).toMatch(/^deleted-[a-f0-9]{16}$/);
    expect(row.displayName).toBe("Deleted user");
    expect(row.passwordHash).not.toMatch(/^scrypt/);
    expect(await prisma.session.count({ where: { userId: me.userId } })).toBe(0);
    expect(await prisma.follow.count({ where: { OR: [{ followerId: me.userId }, { followeeId: me.userId }] } })).toBe(0);
    expect(await prisma.block.count({ where: { OR: [{ blockerId: me.userId }, { blockedId: me.userId }] } })).toBe(0);
    expect(await prisma.rsvp.count({ where: { userId: me.userId } })).toBe(0);
    expect(await prisma.presence.count({ where: { userId: me.userId } })).toBe(0);
    expect(await prisma.venueClaim.count({ where: { userId: me.userId } })).toBe(0);

    expect((await prisma.photo.findUniqueOrThrow({ where: { id: photo.id } })).hiddenAt).not.toBeNull();
    expect(await prisma.moderationEvent.findFirst({ where: { targetId: photo.id, action: "ACCOUNT_DELETED" } })).toMatchObject({ actorId: null });
    expect(await prisma.report.findUnique({ where: { id: report.id } })).not.toBeNull();
    const page = await getVenuePage(prisma, venue.slug, null);
    expect(page.live.comments.find((c) => c.id === comment.id)).toMatchObject({ body: "great night", author: { kind: "deleted" } });
    expect(page.live.consensus.vibe.reportCount).toBe(1);
    expect(page.live.livePhotos).toHaveLength(0);

    await expect(login(prisma, { email: "leaver@real.dev", password: "correct horse battery" })).rejects.toMatchObject({ status: 401 });
    await expect(getProfile(prisma, "leaver", null)).rejects.toMatchObject({ status: 404 });
    await expect(getProfile(prisma, row.handle, null)).rejects.toMatchObject({ status: 404 });
    await expect(follow(prisma, friend, row.handle)).rejects.toMatchObject({ status: 404 });
    expect(await searchUsers(prisma, friend, "deleted")).toEqual([]);
    expect(await loadActor(prisma, me.userId)).toBeNull();
    const res = await meRoute(new Request("http://localhost/api/me", { headers: { authorization: `Bearer ${token}` } }), undefined as never);
    expect(res.status).toBe(401);
  });

  it("a deleted owner stops owning their venue", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    await prisma.user.update({ where: { id: owner.userId }, data: { passwordHash: await hashPassword("owner password") } });
    await deleteAccount(prisma, owner, { password: "owner password" });
    const row = await prisma.user.findUniqueOrThrow({ where: { id: owner.userId } });
    expect(row.role).toBe("USER");
    expect(await prisma.venueClaim.count({ where: { venueId: venue.id } })).toBe(0);
  });
});

describe("blocking (1.2)", () => {
  it("removes follows both ways and prevents new follows either way", async () => {
    const [a, b] = [await makeActor(), await makeActor()];
    await follow(prisma, a, b.handle);
    await follow(prisma, b, a.handle);
    await blockUser(prisma, a, b.handle);
    expect(await prisma.follow.count()).toBe(0);
    await expect(follow(prisma, a, b.handle)).rejects.toMatchObject({ status: 403 });
    await expect(follow(prisma, b, a.handle)).rejects.toMatchObject({ status: 403 });
  });

  it("hides each side's photos, comments, replies and profile from the other, and from search", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    const [a, b, bystander] = [await makeActor(), await makeActor(), await makeActor()];
    const ca = await addComment(prisma, a, venue.id, { body: "from a" });
    await addComment(prisma, b, venue.id, { body: "from b" });
    await replyAsVenue(prisma, owner, ca.id, { body: "venue reply" });
    await submitPhoto(prisma, a, venue.id, { bytes: png(), meta: { caption: "a pic", ...INSIDE } });
    await submitPhoto(prisma, b, venue.id, { bytes: png(), meta: { caption: "b pic", ...INSIDE } });
    await blockUser(prisma, a, b.handle);

    const view = async (who: typeof a | null) => {
      const p = await getVenuePage(prisma, venue.slug, who);
      return { comments: p.live.comments.map((c) => c.body).sort(), photos: p.live.livePhotos.map((x) => x.caption).sort() };
    };
    expect(await view(a)).toEqual({ comments: ["from a"], photos: ["a pic"] });
    expect(await view(b)).toEqual({ comments: ["from a", "from b"].filter((c) => c === "from b"), photos: ["b pic"] });
    expect(await view(bystander)).toEqual({ comments: ["from a", "from b"], photos: ["a pic", "b pic"] });
    await expect(getProfile(prisma, b.handle, a)).rejects.toMatchObject({ status: 404 });
    await expect(getProfile(prisma, a.handle, b)).rejects.toMatchObject({ status: 404 });
    expect((await searchUsers(prisma, a, b.handle)).map((u) => u.handle)).not.toContain(b.handle);
    expect((await searchUsers(prisma, b, a.handle)).map((u) => u.handle)).not.toContain(a.handle);

    // Owner blocking a commenter hides that comment for the owner only; the owner's replies disappear for the blocked user.
    await blockUser(prisma, owner, a.handle);
    const forA = await getVenuePage(prisma, venue.slug, a);
    expect(forA.live.comments.find((c) => c.id === ca.id)!.replies).toHaveLength(0);
  });

  it("does not change consensus, counts or reputation", async () => {
    const venue = await makeVenue();
    const [a, b, c] = [await makeActor(), await makeActor(), await makeActor()];
    for (const u of [a, b, c]) {
      await submitReport(prisma, u, venue.id, { type: "VIBE", vibe: "PACKED", ...INSIDE });
      await setGoingTonight(prisma, u, venue.id, true);
      await recordPresence(prisma, u, venue.id, INSIDE);
    }
    const at = new Date();
    const agg = async (who: typeof a) => {
      const p = await getVenuePage(prisma, venue.slug, who, at);
      return { consensus: p.live.consensus, here: p.live.hereNow, going: p.live.goingTonight, accuracy: p.official.accuracy };
    };
    const before = await agg(a);
    await blockUser(prisma, a, b.handle);
    await blockUser(prisma, c, a.handle);
    expect(await agg(a)).toEqual(before);
    expect(await agg(b)).toEqual(before);
    const map = (await listVenuesForMap(prisma, a, at)).find((v) => v.id === venue.id)!;
    expect(map).toMatchObject({ hereNow: 3, goingTonight: 3, vibe: "PACKED" });
  });

  it("lists and undoes blocks; can't block yourself", async () => {
    const [a, b] = [await makeActor(), await makeActor()];
    await blockUser(prisma, a, b.handle);
    expect((await listBlocks(prisma, a)).map((x) => x.handle)).toEqual([b.handle]);
    await unblockUser(prisma, a, b.handle);
    expect(await listBlocks(prisma, a)).toEqual([]);
    await expect(getProfile(prisma, b.handle, a)).resolves.toBeTruthy();
    await expect(blockUser(prisma, a, a.handle)).rejects.toMatchObject({ status: 400 });
  });
});

describe("objectionable content filter at every entry point", () => {
  it("rejects slurs/explicit terms in comments, captions, handles, display names, replies and promos with a clear 400", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    const me = await makeActor();
    const bad = { status: 400, code: "objectionable_content" };
    await expect(addComment(prisma, me, venue.id, { body: "total f4gg0t bartender" })).rejects.toMatchObject(bad);
    await expect(submitPhoto(prisma, me, venue.id, { bytes: png(), meta: { caption: "porn night", ...INSIDE } })).rejects.toMatchObject(bad);
    const c = await addComment(prisma, me, venue.id, { body: "great cocktails" });
    await expect(replyAsVenue(prisma, owner, c.id, { body: "thanks retard" })).rejects.toMatchObject(bad);
    await expect(createPromo(prisma, owner, venue.id, { title: "Whore night", body: "come", startsAt: "2030-01-01T20:00", endsAt: "2030-01-01T23:00" }, new Date("2029-12-31T00:00:00Z"))).rejects.toMatchObject(bad);
    const base = { email: "n@x.dev", password: "long enough pw", acceptTerms: true, confirm21: true };
    await expect(signup(prisma, { ...base, handle: "xxniggerxx", displayName: "ok" })).rejects.toMatchObject(bad);
    await expect(signup(prisma, { ...base, handle: "fine_handle", displayName: "Slut Queen" })).rejects.toMatchObject(bad);
    await expect(signup(prisma, { ...base, handle: "fine_handle", displayName: "Cocktail Queen" })).resolves.toBeTruthy();
  });
});

describe("terms acceptance", () => {
  const base = { email: "t@x.dev", password: "long enough pw", displayName: "T", handle: "terms_t" };
  it("signup requires acceptTerms and confirm21 (true), and stores the version and time", async () => {
    await expect(signup(prisma, base)).rejects.toThrow(/Terms/);
    await expect(signup(prisma, { ...base, acceptTerms: true })).rejects.toThrow(/21 or older/);
    await expect(signup(prisma, { ...base, acceptTerms: "yes", confirm21: true })).rejects.toThrow();
    const { user } = await signup(prisma, { ...base, acceptTerms: true, confirm21: true });
    expect(user.termsVersion).toBe(CURRENT_TERMS_VERSION);
    expect(user.termsAcceptedAt).toBeInstanceOf(Date);
    expect(Object.keys(user)).not.toContain("dateOfBirth");
  });

  it("/api/me reports acceptance; accounts on an older version can accept the current one", async () => {
    const old = await makeActor();
    expect((await getMe(prisma, old)).terms).toMatchObject({ needsAcceptance: true, currentVersion: CURRENT_TERMS_VERSION });
    await expect(acceptCurrentTerms(prisma, old, { version: "1999-01-01" })).rejects.toMatchObject({ status: 400 });
    await acceptCurrentTerms(prisma, old, { version: CURRENT_TERMS_VERSION });
    expect((await getMe(prisma, old)).terms).toMatchObject({ needsAcceptance: false, acceptedVersion: CURRENT_TERMS_VERSION });
  });
});

describe("geofence-exempt review accounts", () => {
  async function exemptActor() {
    const u = await makeUser();
    await prisma.user.update({ where: { id: u.id }, data: { geofenceExempt: true } });
    return (await actorFor(u.id))!;
  }

  it("can post from anywhere, but nothing counts: consensus, counts, accuracy, reputation", async () => {
    const venue = await makeVenue({ officialCoverCents: 1000 });
    const reviewer = await exemptActor();
    await submitReport(prisma, reviewer, venue.id, { type: "VIBE", vibe: "DEAD", ...OUTSIDE });
    await submitReport(prisma, reviewer, venue.id, { type: "COVER", cover: "50", ...OUTSIDE });
    await recordPresence(prisma, reviewer, venue.id, OUTSIDE);
    await setGoingTonight(prisma, reviewer, venue.id, true);
    const photo = await submitPhoto(prisma, reviewer, venue.id, { bytes: png(), meta: { caption: "review test", ...OUTSIDE } });
    expect(await prisma.report.count({ where: { userId: reviewer.userId } })).toBe(2); // stored
    const now = new Date();

    const page = await getVenuePage(prisma, venue.slug, null, now);
    expect(page.live.consensus.vibe.reportCount).toBe(0);
    expect(page.live.consensus.cover.reportCount).toBe(0);
    expect(page.live.hereNow).toBe(0);
    expect(page.live.goingTonight).toBe(0);
    expect(page.live.livePhotos).toHaveLength(0);
    // The reviewer sees their own photo, so the upload flow is verifiable.
    expect((await getVenuePage(prisma, venue.slug, reviewer, now)).live.livePhotos.map((p) => p.id)).toEqual([photo.id]);
    expect((await listVenuesForMap(prisma, null, now)).find((v) => v.id === venue.id)).toMatchObject({ vibe: "NO_DATA", activity: 0, hereNow: 0 });
  });

  it("is excluded from accuracy windows and from reputation verdicts", async () => {
    const venue = await makeVenue({ officialCoverCents: 1000 });
    const H = 3600_000;
    const now = new Date();
    const base = Math.floor(now.getTime() / H) * H;
    const reviewers = [await exemptActor(), await exemptActor(), await exemptActor()];
    for (let k = 1; k <= 5; k++) {
      for (const r of reviewers) {
        await prisma.report.create({ data: { userId: r.userId, venueId: venue.id, type: "COVER", coverCents: 5000, ...INSIDE, countable: false, createdAt: new Date(base - k * H + 60_000) } });
      }
    }
    expect(await venueAccuracy(prisma, venue.id, now)).toMatchObject({ qualifyingWindows: 0 });
    const res = await recomputeAllReputations(prisma, now);
    expect(res.judged).toBe(0);
  });

  it("only an admin can set the flag (service and HTTP)", async () => {
    const target = await makeActor();
    await expect(setUserFlags(prisma, await makeActor({ role: "MODERATOR" }), target.handle, { geofenceExempt: true })).rejects.toMatchObject({ status: 403 });
    await expect(setUserFlags(prisma, target, target.handle, { geofenceExempt: true })).rejects.toMatchObject({ status: 403 });
    const admin = await makeActor({ role: "ADMIN" });
    const { token } = await createSession(prisma, admin.userId);
    const res = await adminUserRoute(
      new Request(`http://localhost/api/admin/users/${target.handle}`, { method: "PATCH", headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${token}` }, body: JSON.stringify({ geofenceExempt: true }) }),
      { params: Promise.resolve({ handle: target.handle }) },
    );
    expect(res.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.userId } })).geofenceExempt).toBe(true);
    // Not settable through signup or any user-facing payload.
    await expect(signup(prisma, { email: "g@x.dev", password: "long enough pw", displayName: "G", handle: "ggg", acceptTerms: true, confirm21: true, geofenceExempt: true })).rejects.toThrow(/Unrecognized key/);
    void MIN;
  });
});
