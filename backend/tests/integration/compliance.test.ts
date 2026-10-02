import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { login, signup, CURRENT_TERMS_VERSION } from "@/server/services/auth";
import { deleteAccount } from "@/server/services/account";
import { blockUser, listBlocks, unblockUser } from "@/server/services/blocks";
import { follow, getProfile, searchUsers } from "@/server/services/people";
import { flagContent, moderate, moderationQueue } from "@/server/services/moderation";
import { getStamp, listUserStamps } from "@/server/services/stamps";
import { setUserFlags } from "@/server/services/admin";
import { acceptCurrentTerms, getMe } from "@/server/services/me";
import { loadActor } from "@/server/actor";
import { GET as meRoute } from "@/app/api/me/route";
import { PATCH as adminUserRoute } from "@/app/api/admin/users/[handle]/route";
import { installMemoryStorage } from "./mem-storage";
import { actorFor, makeActor, makeStamp, makeUser, makeVenue, OUTSIDE } from "./factories";

const mem = installMemoryStorage();

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

  it("scrubs identity, revokes sessions, removes social ties, hides stamps and deletes their image files", async () => {
    const venue = await makeVenue();
    const me = await userWithPassword("leaver");
    const friend = await makeActor();
    const other = await makeActor();
    await follow(prisma, me, friend.handle);
    await follow(prisma, friend, me.handle);
    await blockUser(prisma, me, other.handle);
    const stamp = await makeStamp(me, venue.id, { caption: "dance floor" });
    const key = (await prisma.photo.findUniqueOrThrow({ where: { id: stamp.id } })).storageKey!;
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

    expect((await prisma.photo.findUniqueOrThrow({ where: { id: stamp.id } })).hiddenAt).not.toBeNull();
    expect(mem.has(key)).toBe(false);
    expect(await prisma.moderationEvent.findFirst({ where: { targetId: stamp.id, action: "ACCOUNT_DELETED" } })).toMatchObject({ actorId: null });
    await expect(getStamp(prisma, friend, stamp.id)).rejects.toMatchObject({ status: 404 });

    await expect(login(prisma, { email: "leaver@real.dev", password: "correct horse battery" })).rejects.toMatchObject({ status: 401 });
    await expect(getProfile(prisma, "leaver", null)).rejects.toMatchObject({ status: 404 });
    await expect(getProfile(prisma, row.handle, null)).rejects.toMatchObject({ status: 404 });
    await expect(follow(prisma, friend, row.handle)).rejects.toMatchObject({ status: 404 });
    expect(await searchUsers(prisma, friend, "deleted")).toEqual([]);
    expect(await loadActor(prisma, me.userId)).toBeNull();
    const res = await meRoute(new Request("http://localhost/api/me", { headers: { authorization: `Bearer ${token}` } }), undefined as never);
    expect(res.status).toBe(401);
  });

  it("a deleted account's stamps stay hidden for good: RESTORE is refused and DISMISS never un-hides", async () => {
    const venue = await makeVenue();
    const me = await makeActor({ isPrivate: false });
    await prisma.user.update({ where: { id: me.userId }, data: { passwordHash: await hashPassword("pw pw pw pw") } });
    const visible = await makeStamp(me, venue.id, { caption: "one" });
    const flagged = await makeStamp(me, venue.id, { caption: "two", now: new Date(Date.now() + 16 * 60_000) });
    for (let i = 0; i < 3; i++) await flagContent(prisma, await makeActor(), { targetType: "STAMP", targetId: flagged.id, reason: "fake" });
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: flagged.id } })).hiddenAt).not.toBeNull();

    await deleteAccount(prisma, me, { password: "pw pw pw pw" });
    const mod = await makeActor({ role: "MODERATOR" });
    await expect(moderate(prisma, mod, { targetType: "STAMP", targetId: visible.id, action: "RESTORE" })).rejects.toMatchObject({ status: 409 });
    await moderate(prisma, mod, { targetType: "STAMP", targetId: flagged.id, action: "DISMISS" });
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: flagged.id } })).hiddenAt).not.toBeNull();
    expect(await prisma.moderationEvent.count({ where: { action: "ACCOUNT_DELETED" } })).toBe(2);
  });
});

describe("blocking (1.2)", () => {
  it("removes follows both ways and prevents new follows either way", async () => {
    const [a, b] = [await makeActor(), await makeActor()];
    await follow(prisma, a, b.handle);
    await follow(prisma, b, a.handle);
    await blockUser(prisma, a, b.handle);
    expect(await prisma.follow.count({ where: { OR: [{ followerId: a.userId }, { followerId: b.userId }] } })).toBe(0);
    await expect(follow(prisma, a, b.handle)).rejects.toMatchObject({ status: 403 });
    await expect(follow(prisma, b, a.handle)).rejects.toMatchObject({ status: 403 });
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
  it("rejects slurs and explicit terms in captions, song fields, handles and display names with a clear 400", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const bad = { status: 400, code: "objectionable_content" };
    await expect(makeStamp(me, venue.id, { caption: "porn night" })).rejects.toMatchObject(bad);
    await expect(makeStamp(me, venue.id, { caption: "ok", meta: { songTitle: "total f4gg0t", songArtist: "Someone" } })).rejects.toMatchObject(bad);
    await expect(makeStamp(me, venue.id, { caption: "ok", meta: { songTitle: "Fine", songArtist: "porn star" } })).rejects.toMatchObject(bad);
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
  async function exempt() {
    const u = await makeUser({ isPrivate: false });
    await prisma.user.update({ where: { id: u.id }, data: { geofenceExempt: true } });
    return (await actorFor(u.id))!;
  }

  it("can stamp from anywhere, but only they ever see it: not strangers, not followers, not the feed, not the profile", async () => {
    const venue = await makeVenue();
    const reviewer = await exempt();
    const follower = await makeActor();
    await follow(prisma, follower, reviewer.handle);
    const s = await makeStamp(reviewer, venue.id, { at: OUTSIDE });
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: s.id } })).countable).toBe(false);
    await expect(getStamp(prisma, follower, s.id)).rejects.toMatchObject({ status: 404 });
    await expect(getStamp(prisma, reviewer, s.id)).resolves.toBeTruthy();
    expect((await listUserStamps(prisma, follower, reviewer.handle)).stamps).toEqual([]);
    expect((await listUserStamps(prisma, reviewer, reviewer.handle)).stamps).toHaveLength(1);
  });

  it("countable is a write-time snapshot: toggling the flag later changes neither past exempt nor past real stamps", async () => {
    const venue = await makeVenue();
    const admin = await makeActor({ role: "ADMIN" });
    const reviewer = await exempt();
    const real = await makeActor({ isPrivate: false });
    const a = await makeStamp(reviewer, venue.id, { at: OUTSIDE });
    const b = await makeStamp(real, venue.id);
    await setUserFlags(prisma, admin, reviewer.handle, { geofenceExempt: false });
    await setUserFlags(prisma, admin, real.handle, { geofenceExempt: true });
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: a.id } })).countable).toBe(false);
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: b.id } })).countable).toBe(true);
    await expect(prisma.photo.update({ where: { id: a.id }, data: { countable: true } })).rejects.toThrow();
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
  });
});

describe("reporting and suspending accounts", () => {
  it("users report a profile by handle; a moderator suspends: signed out, can't sign in, profile gone; then unsuspend", async () => {
    const abuser = await makeActor();
    await prisma.user.update({ where: { id: abuser.userId }, data: { passwordHash: await hashPassword("abuser password"), email: "abuser@x.dev" } });
    const { token } = await createSession(prisma, abuser.userId, { client: "IOS" });
    await flagContent(prisma, await makeActor(), { targetType: "USER", targetId: abuser.handle, reason: "harassing people" });
    const mod = await makeActor({ role: "MODERATOR" });
    const queue = await moderationQueue(prisma, mod);
    expect(queue[0]).toMatchObject({ targetType: "USER", targetId: abuser.userId, venue: null });

    await expect(moderate(prisma, mod, { targetType: "USER", targetId: abuser.userId, action: "HIDE" })).rejects.toThrow(/suspended/);
    await moderate(prisma, mod, { targetType: "USER", targetId: abuser.userId, action: "SUSPEND", note: "harassment" });
    expect(await prisma.session.count({ where: { userId: abuser.userId } })).toBe(0);
    expect((await meRoute(new Request("http://localhost/api/me", { headers: { authorization: `Bearer ${token}` } }), undefined as never)).status).toBe(401);
    await expect(login(prisma, { email: "abuser@x.dev", password: "abuser password" })).rejects.toMatchObject({ status: 403, code: "account_suspended" });
    await expect(getProfile(prisma, abuser.handle, await makeActor())).rejects.toMatchObject({ status: 404 });
    await expect(getProfile(prisma, abuser.handle, mod)).resolves.toBeTruthy();
    expect((await searchUsers(prisma, await makeActor(), abuser.handle)).length).toBe(0);
    expect(await prisma.moderationEvent.findFirst({ where: { action: "SUSPEND", targetId: abuser.userId } })).toMatchObject({ actorId: mod.userId, note: "harassment" });

    await moderate(prisma, mod, { targetType: "USER", targetId: abuser.userId, action: "UNSUSPEND" });
    await expect(login(prisma, { email: "abuser@x.dev", password: "abuser password" })).resolves.toBeTruthy();
  });

  it("only moderators suspend; you can't report yourself", async () => {
    const target = await makeActor();
    await expect(moderate(prisma, await makeActor(), { targetType: "USER", targetId: target.userId, action: "SUSPEND" })).rejects.toMatchObject({ status: 403 });
    await expect(flagContent(prisma, target, { targetType: "USER", targetId: target.handle, reason: "me me me" })).rejects.toMatchObject({ status: 400 });
  });
});
