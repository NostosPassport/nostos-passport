import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { blockUser } from "@/server/services/blocks";
import { deleteAccount } from "@/server/services/account";
import { hashPassword } from "@/lib/auth/password";
import {
  approveAllFollowRequests, decideFollowRequest, follow, getProfile, listConnections, listFollowRequests, removeFollower,
  searchUsers, unfollow, updateProfile,
} from "@/server/services/people";
import { RATE_LIMITS } from "@/server/rate-limit";
import { POST as decideRoute } from "@/app/api/me/follow-requests/[handle]/route";
import { createSession } from "@/lib/auth/session";
import { actorFor, makeActor, makeUser, verify } from "./factories";

describe("follow requests", () => {
  it("following a private account creates a request; a public one is instant", async () => {
    const [me, priv, pub] = [await makeActor(), await makeActor(), await makeActor({ isPrivate: false })];
    expect(await follow(prisma, me, priv.handle)).toEqual({ state: "requested" });
    expect(await prisma.follow.count()).toBe(0);
    expect(await follow(prisma, me, priv.handle)).toEqual({ state: "requested" }); // idempotent
    expect(await prisma.followRequest.count()).toBe(1);
    expect(await follow(prisma, me, pub.handle)).toEqual({ state: "following" });
    expect(await prisma.follow.count({ where: { followerId: me.userId, followeeId: pub.userId } })).toBe(1);
  });

  it("the owner approves or declines; the requester can cancel", async () => {
    const [a, b, c, owner] = [await makeActor(), await makeActor(), await makeActor(), await makeActor()];
    for (const x of [a, b, c]) await follow(prisma, x, owner.handle);
    expect((await listFollowRequests(prisma, owner)).map((r) => r.person.handle).sort()).toEqual([a.handle, b.handle, c.handle].sort());
    expect(await decideFollowRequest(prisma, owner, a.handle, { approve: true })).toEqual({ approved: true });
    expect(await decideFollowRequest(prisma, owner, b.handle, { approve: false })).toEqual({ approved: false });
    expect(await unfollow(prisma, c, owner.handle)).toEqual({ state: "none" });
    expect(await prisma.followRequest.count()).toBe(0);
    expect(await prisma.follow.findMany({ select: { followerId: true } })).toEqual([{ followerId: a.userId }]);
    // A decided request is gone: deciding again is 404.
    await expect(decideFollowRequest(prisma, owner, b.handle, { approve: true })).rejects.toMatchObject({ status: 404 });
  });

  it("switching to public doesn't approve pending requests; approve-all does, in one action", async () => {
    const owner = await makeActor();
    const fans = [await makeActor(), await makeActor(), await makeActor(), await makeActor()];
    for (const f of fans) await follow(prisma, f, owner.handle);
    const res = await updateProfile(prisma, owner, { isPrivate: false });
    expect(res.pendingRequests).toBe(4);
    expect(await prisma.follow.count()).toBe(0);
    expect(await approveAllFollowRequests(prisma, owner)).toEqual({ approved: 4 });
    expect(await prisma.follow.count({ where: { followeeId: owner.userId } })).toBe(4);
    expect(await prisma.followRequest.count()).toBe(0);
    // Now public: a new follower is instant.
    expect(await follow(prisma, await makeActor(), owner.handle)).toEqual({ state: "following" });
  });

  it("a request made while private becomes a follow when the account is public and the requester taps again", async () => {
    const [me, them] = [await makeActor(), await makeActor()];
    await follow(prisma, me, them.handle);
    await updateProfile(prisma, them, { isPrivate: false });
    expect(await follow(prisma, me, them.handle)).toEqual({ state: "following" });
    expect(await prisma.followRequest.count()).toBe(0);
  });

  it("remove follower; they can request again", async () => {
    const [me, fan] = [await makeActor(), await makeActor()];
    await follow(prisma, fan, me.handle);
    await decideFollowRequest(prisma, me, fan.handle, { approve: true });
    expect(await removeFollower(prisma, me, fan.handle)).toEqual({ removed: true });
    expect(await prisma.follow.count()).toBe(0);
    expect(await follow(prisma, fan, me.handle)).toEqual({ state: "requested" });
  });

  it("existing follows count as approved: mutual follows stay friends", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    await prisma.follow.createMany({ data: [{ followerId: a.id, followeeId: b.id }, { followerId: b.id, followeeId: a.id }] });
    const p = await getProfile(prisma, b.handle, await actorFor(a.id));
    expect(p.access).toBe("full");
    expect(p.relationship).toEqual({ isSelf: false, follow: "following", followsYou: true, mutual: true });
  });
});

describe("IDOR: nobody acts on someone else's requests", () => {
  it("A can't approve a request addressed to B, or see B's requests", async () => {
    const [a, b, requester] = [await makeActor(), await makeActor(), await makeActor()];
    await follow(prisma, requester, b.handle);
    await expect(decideFollowRequest(prisma, a, requester.handle, { approve: true })).rejects.toMatchObject({ status: 404 });
    expect(await prisma.follow.count()).toBe(0);
    expect(await prisma.followRequest.count()).toBe(1);
    expect(await listFollowRequests(prisma, a)).toEqual([]);
  });

  it("the requester can't approve their own request", async () => {
    const [requester, target] = [await makeActor(), await makeActor()];
    await follow(prisma, requester, target.handle);
    await expect(decideFollowRequest(prisma, requester, requester.handle, { approve: true })).rejects.toMatchObject({ status: 404 });
    await expect(decideFollowRequest(prisma, requester, target.handle, { approve: true })).rejects.toMatchObject({ status: 404 });
    expect(await prisma.follow.count()).toBe(0);
  });

  it("over HTTP: signed out is 401, someone else's request is 404", async () => {
    const [a, b, requester] = [await makeActor(), await makeActor(), await makeActor()];
    await follow(prisma, requester, b.handle);
    const call = (headers: Record<string, string>) =>
      decideRoute(new Request("http://x", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ approve: true }) }), { params: Promise.resolve({ handle: requester.handle }) });
    expect((await call({})).status).toBe(401);
    const { token } = await createSession(prisma, a.userId, { client: "IOS" });
    expect((await call({ authorization: `Bearer ${token}` })).status).toBe(404);
    expect(await prisma.follow.count()).toBe(0);
  });
});

describe("blocks and follow requests", () => {
  it("blocking removes follows and pending requests both ways and prevents new ones", async () => {
    const [a, b] = [await makeActor(), await makeActor()];
    await follow(prisma, a, b.handle);
    await follow(prisma, b, a.handle);
    await blockUser(prisma, a, b.handle);
    expect(await prisma.followRequest.count()).toBe(0);
    await expect(follow(prisma, b, a.handle)).rejects.toMatchObject({ status: 403 });
    await expect(follow(prisma, a, b.handle)).rejects.toMatchObject({ status: 403 });
  });

  it("approve-all skips suspended requesters", async () => {
    const [owner, ok, gone] = [await makeActor(), await makeActor(), await makeActor()];
    await follow(prisma, ok, owner.handle);
    await follow(prisma, gone, owner.handle);
    await prisma.user.update({ where: { id: gone.userId }, data: { suspendedAt: new Date() } });
    expect(await approveAllFollowRequests(prisma, owner)).toEqual({ approved: 1 });
  });

  it("account deletion removes the user's requests in both directions and clears the profile", async () => {
    const u = await makeUser();
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword("pw pw pw pw"), bio: "hi" } });
    await verify(u.id);
    const me = await actorFor(u.id);
    const [other, fan] = [await makeActor(), await makeActor()];
    await follow(prisma, me, other.handle);
    await follow(prisma, fan, me.handle);
    await deleteAccount(prisma, me, { password: "pw pw pw pw" });
    expect(await prisma.followRequest.count()).toBe(0);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect([row.bio, row.verifiedAt, row.avatarKey]).toEqual(["", null, null]);
    expect(await prisma.verificationEvent.findFirst({ where: { userId: u.id, action: "REVOKE" } })).toMatchObject({ action: "REVOKE", actorId: null });
  });
});

describe("private profiles", () => {
  it("a viewer without access gets the handle, badge and relationship only", async () => {
    const owner = await makeActor();
    await updateProfile(prisma, owner, { bio: "DJ on Fridays", displayName: "Maya Secret" });
    await verify(owner.userId);
    const requester = await makeActor();
    await follow(prisma, requester, owner.handle);
    for (const viewer of [null, await makeActor(), requester, await makeActor({ role: "VENUE_OWNER" })]) {
      const p = await getProfile(prisma, owner.handle, viewer);
      expect(p.access).toBe("limited");
      const json = JSON.stringify(p);
      expect(json).not.toContain("Maya Secret");
      expect(json).not.toContain("DJ on Fridays");
      expect(json).not.toContain("counts");
      expect(p.user).toEqual({ handle: owner.handle, verified: true, isPrivate: true });
    }
    expect((await getProfile(prisma, owner.handle, requester)).relationship.follow).toBe("requested");
  });

  it("approved followers, the owner and moderators see everything", async () => {
    const owner = await makeActor();
    await updateProfile(prisma, owner, { bio: "DJ on Fridays" });
    const fan = await makeActor();
    await follow(prisma, fan, owner.handle);
    await decideFollowRequest(prisma, owner, fan.handle, { approve: true });
    for (const viewer of [fan, owner, await makeActor({ role: "MODERATOR" })]) {
      const p = await getProfile(prisma, owner.handle, viewer);
      expect(p.access).toBe("full");
      expect(p.access === "full" && p.user.bio).toBe("DJ on Fridays");
    }
  });

  it("followers and following lists need full access (403 private_account)", async () => {
    const owner = await makeActor();
    await expect(listConnections(prisma, await makeActor(), owner.handle, "followers")).rejects.toMatchObject({ status: 403, code: "private_account" });
    await expect(listConnections(prisma, null, owner.handle, "following")).rejects.toMatchObject({ status: 403 });
    await expect(listConnections(prisma, owner, owner.handle, "followers")).resolves.toEqual([]);
  });

  it("lists show private people's handle and badge only, unless the viewer follows them", async () => {
    const pub = await makeActor({ isPrivate: false });
    const privFan = await makeUser({ handle: "quiet_fan" });
    await prisma.user.update({ where: { id: privFan.id }, data: { displayName: "Hidden Name" } });
    await prisma.follow.create({ data: { followerId: privFan.id, followeeId: pub.userId } });
    const viewer = await makeActor();
    expect(await listConnections(prisma, viewer, pub.handle, "followers")).toEqual([
      { handle: "quiet_fan", displayName: null, avatarUrl: null, verified: false, follow: "none", isSelf: false },
    ]);
    await prisma.follow.create({ data: { followerId: viewer.userId, followeeId: privFan.id } });
    expect((await listConnections(prisma, viewer, pub.handle, "followers"))[0]!.displayName).toBe("Hidden Name");
  });

  it("search matches a private account's display name only for people who follow it", async () => {
    const priv = await makeUser({ handle: "zed_1" });
    await prisma.user.update({ where: { id: priv.id }, data: { displayName: "Octavia Moonlight" } });
    const stranger = await makeActor();
    expect(await searchUsers(prisma, stranger, "moonlight")).toEqual([]);
    expect(await searchUsers(prisma, null, "moonlight")).toEqual([]);
    // By handle, a private account is findable, with the name hidden.
    expect(await searchUsers(prisma, stranger, "zed_1")).toEqual([{ handle: "zed_1", displayName: null, avatarUrl: null, verified: false, follow: "none", isSelf: false }]);
    await prisma.follow.create({ data: { followerId: stranger.userId, followeeId: priv.id } });
    expect((await searchUsers(prisma, stranger, "moonlight")).map((u) => u.displayName)).toEqual(["Octavia Moonlight"]);
  });
});

describe("profile settings", () => {
  it("bio is 150 characters max and content-filtered; handle and badge can't be set", async () => {
    const me = await makeActor();
    await expect(updateProfile(prisma, me, { bio: "x".repeat(151) })).rejects.toThrow(/150/);
    await expect(updateProfile(prisma, me, { bio: "f4gg0t" })).rejects.toMatchObject({ status: 400, code: "objectionable_content" });
    await expect(updateProfile(prisma, me, { handle: "new_handle" })).rejects.toThrow();
    await expect(updateProfile(prisma, me, { verified: true })).rejects.toThrow();
  });
});

describe("rate limits", () => {
  it("follows and requests are limited per hour, exactly under parallel requests", async () => {
    const me = await makeActor();
    const max = RATE_LIMITS.follow.max;
    const targets = await Promise.all(Array.from({ length: max + 5 }, () => makeUser()));
    const results = await Promise.allSettled(targets.map((t) => follow(prisma, me, t.handle)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(max);
    expect(results.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason.status === 429)).toBe(true);
    // Repeating an existing request doesn't count.
    const pending = await prisma.followRequest.findFirstOrThrow({ where: { requesterId: me.userId }, select: { target: { select: { handle: true } } } });
    await expect(follow(prisma, me, pending.target.handle)).resolves.toEqual({ state: "requested" });
  }, 60_000);
});

describe("blocking Anonymous authors (Guideline 1.2) and the block list", () => {
  it("blocks the author of a photo or comment by content id, never revealing who it is", async () => {
    const { submitPhoto } = await import("@/server/services/photos");
    void submitPhoto;
    const { makeVenue, INSIDE } = await import("./factories");
    const { addComment } = await import("@/server/services/comments");
    const { blockAuthorOf, listBlocks, unblockByRef } = await import("@/server/services/blocks");
    const venue = await makeVenue();
    const author = await makeActor({ handle: "hidden_hank" });
    const photo = await prisma.photo.create({ data: { userId: author.userId, venueId: venue.id, storageKey: "photos/h.png", mimeType: "image/png", caption: "", ...INSIDE, shared: true } });
    const comment = await addComment(prisma, author, venue.id, { body: "hey" });
    const me = await makeActor();
    const res = await blockAuthorOf(prisma, me, { targetType: "PHOTO", targetId: photo.id });
    expect(res).toEqual({ blocked: true });
    expect(JSON.stringify(res)).not.toContain("hidden_hank");
    expect(await blockAuthorOf(prisma, me, { targetType: "COMMENT", targetId: comment.id })).toEqual({ blocked: true }); // idempotent
    const list = await listBlocks(prisma, me);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ source: "photo", handle: null });
    expect(JSON.stringify(list)).not.toContain("hidden_hank");
    // Someone else can't undo my block by ref; I can.
    await expect(unblockByRef(prisma, await makeActor(), list[0]!.ref)).rejects.toMatchObject({ status: 404 });
    expect(await unblockByRef(prisma, me, list[0]!.ref)).toEqual({ blocked: false });
    await expect(blockAuthorOf(prisma, author, { targetType: "PHOTO", targetId: photo.id })).rejects.toMatchObject({ status: 400 });
  });

  it("the block list never shows display names; profile blocks show the handle the blocker already saw", async () => {
    const { listBlocks } = await import("@/server/services/blocks");
    const me = await makeActor();
    const other = await makeUser({ handle: "named_nina" });
    await prisma.user.update({ where: { id: other.id }, data: { displayName: "Nina Secret" } });
    await blockUser(prisma, me, other.handle);
    const list = await listBlocks(prisma, me);
    expect(list).toEqual([{ ref: expect.any(String), source: "profile", handle: "named_nina", blockedAt: expect.any(Date) }]);
    expect(JSON.stringify(list)).not.toContain("Nina Secret");
  });
});

describe("follow and block races (pair locks)", () => {
  it("a follow never survives a concurrent block", async () => {
    for (let i = 0; i < 8; i++) {
      const [a, b] = [await makeActor({ isPrivate: false }), await makeActor({ isPrivate: false })];
      await Promise.allSettled([follow(prisma, a, b.handle), blockUser(prisma, b, a.handle), follow(prisma, b, a.handle)]);
      expect(await prisma.follow.count({ where: { OR: [{ followerId: a.userId, followeeId: b.userId }, { followerId: b.userId, followeeId: a.userId }] } })).toBe(0);
      expect(await prisma.followRequest.count({ where: { OR: [{ requesterId: a.userId }, { requesterId: b.userId }] } })).toBe(0);
    }
  });

  it("a cancelled request never becomes a follow, whichever runs first", async () => {
    for (let i = 0; i < 8; i++) {
      const [requester, owner] = [await makeActor(), await makeActor()];
      await follow(prisma, requester, owner.handle);
      const [approve] = await Promise.allSettled([
        i % 2 ? approveAllFollowRequests(prisma, owner) : decideFollowRequest(prisma, owner, requester.handle, { approve: true }),
        unfollow(prisma, requester, owner.handle),
      ]);
      const following = await prisma.follow.count({ where: { followerId: requester.userId, followeeId: owner.userId } });
      // Either the approval ran first and the cancel then unfollowed, or the cancel ran first and nothing was approved.
      expect(following).toBe(0);
      void approve;
    }
  });
});

describe("suspended authors", () => {
  it("read Anonymous on venue pages to everyone but staff", async () => {
    const { makeVenue } = await import("./factories");
    const { addComment } = await import("@/server/services/comments");
    const { getVenuePage } = await import("@/server/services/venues");
    const venue = await makeVenue();
    const author = await makeActor({ handle: "sus_sid", isPrivate: false });
    await addComment(prisma, author, venue.id, { body: "hi" });
    await prisma.user.update({ where: { id: author.userId }, data: { suspendedAt: new Date() } });
    expect((await getVenuePage(prisma, venue.slug, await makeActor())).live.comments[0]!.author).toEqual({ kind: "anonymous" });
    expect((await getVenuePage(prisma, venue.slug, await makeActor({ role: "MODERATOR" }))).live.comments[0]!.author).toMatchObject({ kind: "user", handle: "sus_sid" });
  });
});
