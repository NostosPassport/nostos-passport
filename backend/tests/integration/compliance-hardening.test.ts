import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { login } from "@/server/services/auth";
import { deleteAccount } from "@/server/services/account";
import { flagContent, moderate, moderationQueue } from "@/server/services/moderation";
import { pruneExpiredPresence, recordPresence, setGoingTonight } from "@/server/services/social";
import { follow, getProfile, searchUsers } from "@/server/services/people";
import { addComment } from "@/server/services/comments";
import { submitReport } from "@/server/services/reports";
import { submitPhoto } from "@/server/services/photos";
import { ownerVenueDashboard } from "@/server/services/owner";
import { setUserFlags } from "@/server/services/admin";
import { getVenuePage } from "@/server/services/venues";
import { GET as meRoute } from "@/app/api/me/route";
import { installMemoryStorage } from "./mem-storage";
import { actorFor, makeActor, makeOwner, makeUser, makeVenue, INSIDE, OUTSIDE } from "./factories";

const mem = installMemoryStorage();
const png = () => {
  const p = new PNG({ width: 2, height: 2 });
  p.data.fill(77);
  return PNG.sync.write(p);
};

async function exempt(password = "review password 1") {
  const u = await makeUser();
  await prisma.user.update({ where: { id: u.id }, data: { geofenceExempt: true, passwordHash: await hashPassword(password) } });
  return (await actorFor(u.id))!;
}

describe("countable is a write-time snapshot", () => {
  it("deleting the App Review account never makes its test data count", async () => {
    const venue = await makeVenue();
    const reviewer = await exempt();
    await submitReport(prisma, reviewer, venue.id, { type: "VIBE", vibe: "DEAD", ...OUTSIDE });
    await submitReport(prisma, reviewer, venue.id, { type: "COVER", cover: "99", ...OUTSIDE });
    await deleteAccount(prisma, reviewer, { password: "review password 1" });
    const page = await getVenuePage(prisma, venue.slug, null);
    expect(page.live.consensus.vibe.reportCount).toBe(0);
    expect(page.live.consensus.cover.reportCount).toBe(0);
  });

  it("toggling the flag later changes neither past exempt data nor past real data", async () => {
    const venue = await makeVenue();
    const admin = await makeActor({ role: "ADMIN" });
    const reviewer = await exempt();
    const real = await makeActor();
    await submitReport(prisma, reviewer, venue.id, { type: "VIBE", vibe: "DEAD", ...OUTSIDE });
    await submitReport(prisma, real, venue.id, { type: "VIBE", vibe: "PACKED", ...INSIDE });
    await setUserFlags(prisma, admin, reviewer.handle, { geofenceExempt: false });
    await setUserFlags(prisma, admin, real.handle, { geofenceExempt: true });
    expect((await getVenuePage(prisma, venue.slug, null)).live.consensus.vibe.reportCount).toBe(1);
    const counted = await prisma.report.findMany({ where: { countable: true }, select: { userId: true } });
    expect(counted.map((r) => r.userId)).toEqual([real.userId]);
  });

  it("the snapshot can't be rewritten in the database", async () => {
    const venue = await makeVenue();
    const r = await submitReport(prisma, await exempt(), venue.id, { type: "VIBE", vibe: "DEAD", ...OUTSIDE });
    await expect(prisma.report.update({ where: { id: r.id }, data: { countable: true } })).rejects.toThrow();
  });

  it("exempt data stays out of RSVP counts, owner report lists, other people's comments, friends going and auto-hide", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    const reviewer = await exempt();
    const viewer = await makeActor();
    expect((await setGoingTonight(prisma, reviewer, venue.id, true)).goingTonight).toBe(0);
    await submitReport(prisma, reviewer, venue.id, { type: "LINE", line: "NONE", ...OUTSIDE });
    expect((await ownerVenueDashboard(prisma, owner, venue.id)).recentReports).toHaveLength(0);
    const c = await addComment(prisma, reviewer, venue.id, { body: "review test comment" });
    expect((await getVenuePage(prisma, venue.slug, viewer)).live.comments.map((x) => x.id)).not.toContain(c.id);
    expect((await getVenuePage(prisma, venue.slug, reviewer)).live.comments.map((x) => x.id)).toContain(c.id);
    await follow(prisma, viewer, reviewer.handle);
    await follow(prisma, reviewer, viewer.handle);
    expect((await getVenuePage(prisma, venue.slug, viewer)).live.friendsGoing).toHaveLength(0);

    const author = await makeUser();
    const photo = await prisma.photo.create({ data: { userId: author.id, venueId: venue.id, storageKey: "photos/ab.png", mimeType: "image/png", caption: "", ...INSIDE } });
    await flagContent(prisma, reviewer, { targetType: "PHOTO", targetId: photo.id, reason: "test flag" });
    await flagContent(prisma, await makeActor(), { targetType: "PHOTO", targetId: photo.id, reason: "fake" });
    expect((await flagContent(prisma, await makeActor(), { targetType: "PHOTO", targetId: photo.id, reason: "fake" })).autoHidden).toBe(false);
  });
});

describe("deleted accounts' photos stay hidden for good", () => {
  it("RESTORE is refused, DISMISS never un-hides, and the image files are deleted", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    await prisma.user.update({ where: { id: me.userId }, data: { passwordHash: await hashPassword("pw pw pw pw") } });
    const visible = await submitPhoto(prisma, me, venue.id, { bytes: png(), meta: { caption: "one", ...INSIDE } });
    const flagged = await submitPhoto(prisma, me, venue.id, { bytes: png(), meta: { caption: "two", ...INSIDE } }, new Date(Date.now() + 16 * 60_000));
    for (let i = 0; i < 3; i++) await flagContent(prisma, await makeActor(), { targetType: "PHOTO", targetId: flagged.id, reason: "fake" });
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: flagged.id } })).hiddenAt).not.toBeNull();

    await deleteAccount(prisma, me, { password: "pw pw pw pw" });
    expect(mem.has(visible.storageKey)).toBe(false);
    expect(mem.has(flagged.storageKey)).toBe(false);
    const mod = await makeActor({ role: "MODERATOR" });
    await expect(moderate(prisma, mod, { targetType: "PHOTO", targetId: visible.id, action: "RESTORE" })).rejects.toMatchObject({ status: 409 });
    await moderate(prisma, mod, { targetType: "PHOTO", targetId: flagged.id, action: "DISMISS" });
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: flagged.id } })).hiddenAt).not.toBeNull();
    expect(await prisma.moderationEvent.count({ where: { action: "ACCOUNT_DELETED" } })).toBe(2);
  });
});

describe("reporting and suspending accounts", () => {
  it("users report a profile by handle; a moderator suspends: signed out, can't sign in, profile gone; then unsuspend", async () => {
    const abuser = await makeActor();
    await prisma.user.update({ where: { id: abuser.userId }, data: { passwordHash: await hashPassword("abuser password"), email: "abuser@x.dev" } });
    const { token } = await createSession(prisma, abuser.userId, { client: "IOS" });
    await flagContent(prisma, await makeActor(), { targetType: "USER", targetId: abuser.handle, reason: "harassing people in comments" });
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
    const venue = await makeVenue();
    const target = await makeActor();
    await expect(moderate(prisma, await makeOwner(venue.id), { targetType: "USER", targetId: target.userId, action: "SUSPEND" })).rejects.toMatchObject({ status: 403 });
    await expect(moderate(prisma, await makeActor(), { targetType: "USER", targetId: target.userId, action: "SUSPEND" })).rejects.toMatchObject({ status: 403 });
    await expect(flagContent(prisma, target, { targetType: "USER", targetId: target.handle, reason: "me me me" })).rejects.toMatchObject({ status: 400 });
  });
});

describe("presence retention", () => {
  it("prunes presence rows once they stop counting", async () => {
    const venue = await makeVenue();
    const [a, b] = [await makeActor(), await makeActor()];
    const t0 = new Date();
    await recordPresence(prisma, a, venue.id, INSIDE, new Date(t0.getTime() - 50 * 60_000));
    await recordPresence(prisma, b, venue.id, INSIDE, t0);
    expect(await pruneExpiredPresence(prisma, t0)).toBe(1);
    expect(await prisma.presence.count()).toBe(1);
  });
});
