import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { listActivity } from "@/server/services/activity";
import { blockUser, listBlocks, unblockUser } from "@/server/services/blocks";
import { approveAllFollowRequests, decideFollowRequest, follow, getProfile, listConnections, listFollowRequests, listFollowing, removeFollower, searchUsers, unfollow } from "@/server/services/people";
import { createStamp, listFeed, listUserPlaces, removeStampPhoto } from "@/server/services/stamps";
import { likeStamp, unlikeStamp } from "@/server/services/likes";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, INSIDE, makeStamp, makeVenue, pngBytes, verify } from "./factories";

import { adminSearchUsers, setVerified, verificationLog } from "@/server/services/verification";
import { setUserFlags } from "@/server/services/admin";
import { createSession } from "@/lib/auth/session";
import * as adminUsers from "@/app/api/admin/users/route";
import * as adminLog from "@/app/api/admin/verification-log/route";
import * as adminFlags from "@/app/api/admin/users/[handle]/route";
import * as adminVerify from "@/app/api/admin/users/[handle]/verification/route";
import * as pins from "@/app/api/me/pins/route";
import { listPins } from "@/server/services/pins";
import { getStamp } from "@/server/services/stamps";
import { flagContent, moderate, moderationQueue, recentlyHidden } from "@/server/services/moderation";

installMemoryStorage();
afterEach(() => vi.unstubAllEnvs());

describe("backend visibility audit", () => {
  it("personal-mode service callers cannot bypass disabled social HTTP routes", async () => {
    const me = await makeActor({ role: "MODERATOR" });
    const other = await makeActor({ isPrivate: false });
    const s = await makeStamp(other, (await makeVenue()).id);
    await prisma.follow.create({ data: { followerId: me.userId, followeeId: other.userId } });
    await likeStamp(prisma, me, s.id);
    vi.stubEnv("SOCIAL_ENABLED", "0");
    const calls = [
      () => listFeed(prisma, me), () => listActivity(prisma, me), () => listBlocks(prisma, me),
      () => listFollowRequests(prisma, me), () => listFollowing(prisma, me), () => searchUsers(prisma, me, other.handle),
      () => getProfile(prisma, other.handle, me), () => listUserPlaces(prisma, me, other.handle),
      () => follow(prisma, me, other.handle), () => unfollow(prisma, me, other.handle),
      () => blockUser(prisma, me, other.handle), () => unblockUser(prisma, me, other.handle),
      () => listConnections(prisma, me, other.handle, "followers"), () => removeFollower(prisma, me, other.handle),
      () => decideFollowRequest(prisma, me, other.handle, { approve: true }), () => approveAllFollowRequests(prisma, me),
      () => likeStamp(prisma, me, s.id), () => unlikeStamp(prisma, me, s.id),
    ];
    for (const call of calls) await expect(call()).rejects.toMatchObject({ status: 404 });
    expect((await getProfile(prisma, me.handle, me)).access).toBe("full");
    expect((await getStamp(prisma, other, s.id)).stamp.likes).toEqual({ count: 0, viewerLiked: false });
    expect(await listPins(prisma, me)).toEqual({ stamps: [] });
    expect(await prisma.follow.count()).toBe(1);
    expect(await prisma.photoLike.count()).toBe(1);
  });

  it("personal-mode admin endpoints cannot disclose handles, emails or legacy verification records", async () => {
    const admin = await makeActor({ role: "ADMIN" });
    const other = await makeActor();
    await verify(other.userId);
    const token = (await createSession(prisma, admin.userId, { client: "IOS" })).token;
    vi.stubEnv("SOCIAL_ENABLED", "0");
    const handlers = [
      [adminUsers.GET, "GET", undefined], [adminLog.GET, "GET", undefined],
      [adminFlags.PATCH, "PATCH", { geofenceExempt: true }], [adminVerify.POST, "POST", { verified: false, note: "probing" }],
    ] as const;
    for (const [handler, method, body] of handlers) {
      const res = await handler(new Request(`http://localhost/api/admin?q=${other.handle}`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }), { params: Promise.resolve({ handle: other.handle }) } as never);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "not_found", message: "Not found" });
    }
    for (const call of [() => adminSearchUsers(prisma, admin, other.handle), () => verificationLog(prisma, admin), () => setVerified(prisma, admin, other.handle, { verified: false, note: "probing" }), () => setUserFlags(prisma, admin, other.handle, { geofenceExempt: true })]) await expect(call()).rejects.toMatchObject({ status: 404 });
    expect(await prisma.verificationEvent.count()).toBe(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: other.userId } })).geofenceExempt).toBe(false);
  });

  it("pin replacement already gives identical errors for foreign, hidden, removed and missing stamps", async () => {
    const me = await makeActor();
    const other = await makeActor();
    const foreign = await makeStamp(other, (await makeVenue()).id);
    const hidden = await makeStamp(me, (await makeVenue()).id);
    const removed = await makeStamp(me, (await makeVenue()).id);
    await prisma.photo.update({ where: { id: hidden.id }, data: { hiddenAt: new Date() } });
    await prisma.photo.update({ where: { id: removed.id }, data: { removedAt: new Date() } });
    const token = (await createSession(prisma, me.userId, { client: "IOS" })).token;
    const responses = [];
    for (const id of ["missing", foreign.id, hidden.id, removed.id]) {
      const res = await pins.PUT(new Request("http://localhost/api/me/pins", { method: "PUT", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ stampIds: [id] }) }), undefined as never);
      responses.push({ status: res.status, body: await res.text(), headers: Object.fromEntries(res.headers) });
    }
    expect(responses[0]!.status).toBe(400);
    for (const res of responses.slice(1)) expect(res).toEqual(responses[0]);
  });

  it("place summaries never return a URL for a removed original photo", async () => {
    const me = await makeActor();
    const s = await makeStamp(me, (await makeVenue()).id);
    await removeStampPhoto(prisma, me, s.id, s.photos[0]!.id);
    expect((await listUserPlaces(prisma, me, me.handle)).places[0]!.latestStamp.photoUrl).toBeNull();
  });
  it("activity and moderation previews never resurrect a removed photo", async () => {
    const me = await makeActor({ isPrivate: false });
    const liker = await makeActor();
    const mod = await makeActor({ role: "MODERATOR" });
    const s = await makeStamp(me, (await makeVenue()).id);
    await likeStamp(prisma, liker, s.id);
    await flagContent(prisma, liker, { targetType: "STAMP", targetId: s.id, reason: "legacy report" });
    await removeStampPhoto(prisma, me, s.id, s.photos[0]!.id);
    const activity = await listActivity(prisma, me);
    expect(activity.find((x) => x.kind === "like")).toMatchObject({ stamp: { url: null } });
    expect((await moderationQueue(prisma, mod))[0]!.content?.url).toBeUndefined();
    await moderate(prisma, mod, { targetType: "STAMP", targetId: s.id, action: "HIDE" });
    expect((await recentlyHidden(prisma, mod))[0]!.url).toBeUndefined();
  });

  it("place summaries choose the first live photo in the current layout order", async () => {
    const me = await makeActor();
    const s = await createStamp(prisma, me, (await makeVenue()).id, { photos: [pngBytes(), pngBytes()], meta: { ...INSIDE, caption: "words" } });
    await removeStampPhoto(prisma, me, s.id, s.photos[0]!.id);
    const summary = (await listUserPlaces(prisma, me, me.handle)).places[0]!.latestStamp;
    expect(summary.photoUrl?.split("?")[0]).toBe(s.photos[1]!.url.split("?")[0]);
  });

});
