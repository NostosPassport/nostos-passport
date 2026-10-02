import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { DAY_MS } from "@/lib/time";
import { adminSearchUsers, setVerified, verificationLog } from "@/server/services/verification";
import { getVenuePage } from "@/server/services/venues";
import { getProfile, searchUsers } from "@/server/services/people";
import { getPost } from "@/server/services/posts";
import { addComment } from "@/server/services/comments";
import { regularsAt, regularVenuesOf } from "@/server/services/regulars";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeOwner, makeVenue, INSIDE } from "./factories";

installMemoryStorage();

describe("verified badge: admin-only, noted, logged, badge only", () => {
  it("only admins can grant or revoke; moderators, owners and users get 403", async () => {
    const target = await makeActor();
    const venue = await makeVenue();
    for (const who of [await makeActor(), await makeActor({ role: "MODERATOR" }), await makeOwner(venue.id), null]) {
      await expect(setVerified(prisma, who, target.handle, { verified: true, note: "Known DJ" })).rejects.toMatchObject({ status: who ? 403 : 401 });
      await expect(adminSearchUsers(prisma, who, target.handle)).rejects.toMatchObject({ status: who ? 403 : 401 });
    }
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.userId } })).verifiedAt).toBeNull();
  });

  it("a note is required; grant and revoke are each logged; repeating is a 409", async () => {
    const admin = await makeActor({ role: "ADMIN" });
    const target = await makeActor();
    await expect(setVerified(prisma, admin, target.handle, { verified: true })).rejects.toThrow();
    await expect(setVerified(prisma, admin, target.handle, { verified: true, note: " " })).rejects.toThrow(/note/i);
    expect(await setVerified(prisma, admin, target.handle, { verified: true, note: "Resident DJ at two venues" })).toMatchObject({ verified: true });
    await expect(setVerified(prisma, admin, target.handle, { verified: true, note: "again" })).rejects.toMatchObject({ status: 409 });
    expect(await setVerified(prisma, admin, target.handle, { verified: false, note: "Left the scene" })).toMatchObject({ verified: false });
    const log = await verificationLog(prisma, admin, target.handle);
    expect(log.map((e) => [e.action, e.note, e.by])).toEqual([["REVOKE", "Left the scene", admin.handle], ["GRANT", "Resident DJ at two venues", admin.handle]]);
  });

  it("the badge shows wherever the handle shows, and never on Anonymous", async () => {
    const admin = await makeActor({ role: "ADMIN" });
    const venue = await makeVenue();
    const pub = await makeActor({ isPrivate: false, handle: "vip_pub" });
    const priv = await makeActor({ handle: "vip_priv" });
    for (const u of [pub, priv]) {
      await setVerified(prisma, admin, u.handle, { verified: true, note: "Known" });
      await addComment(prisma, u, venue.id, { body: `from ${u.handle}` });
    }
    const stranger = await makeActor();
    const byBody = Object.fromEntries((await getVenuePage(prisma, venue.slug, stranger)).live.comments.map((c) => [c.body, c.author]));
    expect(byBody["from vip_pub"]).toMatchObject({ kind: "user", verified: true });
    expect(byBody["from vip_priv"]).toEqual({ kind: "anonymous" });
    expect((await searchUsers(prisma, stranger, "vip_")).map((u) => [u.handle, u.verified])).toEqual([["vip_priv", true], ["vip_pub", true]]);
    const limited = await getProfile(prisma, priv.handle, stranger);
    expect(limited).toMatchObject({ access: "limited", user: { verified: true } });
  });

  it("verification changes nothing else: feed order, consensus and counts are identical", async () => {
    const admin = await makeActor({ role: "ADMIN" });
    const venue = await makeVenue();
    const a = await makeActor({ isPrivate: false });
    const b = await makeActor({ isPrivate: false });
    await prisma.photo.create({ data: { userId: a.userId, venueId: venue.id, storageKey: "photos/a.png", mimeType: "image/png", caption: "a", ...INSIDE, createdAt: new Date(Date.now() - 60_000) } });
    await prisma.photo.create({ data: { userId: b.userId, venueId: venue.id, storageKey: "photos/b.png", mimeType: "image/png", caption: "b", ...INSIDE } });
    const strip = (p: Awaited<ReturnType<typeof getVenuePage>>) => ({ order: p.live.livePhotos.map((x) => x.id), consensus: p.live.consensus, here: p.live.hereNow });
    const before = strip(await getVenuePage(prisma, venue.slug, null));
    await setVerified(prisma, admin, a.handle, { verified: true, note: "Known" });
    expect(strip(await getVenuePage(prisma, venue.slug, null))).toEqual(before);
  });

  it("admin search sees private accounts and emails (staff)", async () => {
    const admin = await makeActor({ role: "ADMIN" });
    const priv = await makeActor({ handle: "hush_hal" });
    expect(await adminSearchUsers(prisma, admin, "hush")).toEqual([expect.objectContaining({ handle: "hush_hal", email: "hush_hal@test.dev", isPrivate: true, verified: false })]);
    void priv;
  });
});

describe("Regulars: 3 nights with posts in 60 days, computed from posts", () => {
  const post = (userId: string, venueId: string, daysAgo: number, extra: Record<string, unknown> = {}) =>
    prisma.photo.create({
      data: { userId, venueId, storageKey: `photos/${Math.random().toString(36).slice(2)}.png`, mimeType: "image/png", caption: "", ...INSIDE, rating: 7, shared: true, createdAt: new Date(Date.now() - daysAgo * DAY_MS), ...extra },
    });

  it("becomes a Regular on the third night; unshared posts count; hidden, removed, live-only and App Review posts don't", async () => {
    const venue = await makeVenue();
    const u = await makeActor();
    await post(u.userId, venue.id, 1);
    await post(u.userId, venue.id, 1); // same night twice
    await post(u.userId, venue.id, 8, { shared: false });
    expect(await regularsAt(prisma, venue.id, [u.userId])).toEqual(new Set());
    for (const extra of [{ hiddenAt: new Date() }, { removedAt: new Date() }, { rating: null }, { countable: false }]) {
      const p = await post(u.userId, venue.id, 15, extra);
      expect(await regularsAt(prisma, venue.id, [u.userId]), JSON.stringify(Object.keys(extra))).toEqual(new Set());
      void p;
    }
    await post(u.userId, venue.id, 22);
    expect(await regularsAt(prisma, venue.id, [u.userId])).toEqual(new Set([u.userId]));
    expect((await regularVenuesOf(prisma, u.userId)).map((v) => v.slug)).toEqual([venue.slug]);
  });

  it("nights older than 60 days don't count", async () => {
    const venue = await makeVenue();
    const u = await makeActor();
    for (const d of [2, 30, 61]) await post(u.userId, venue.id, d);
    expect(await regularsAt(prisma, venue.id, [u.userId])).toEqual(new Set());
  });

  it("the Regular badge rides on a visible handle only; private non-followed Regulars stay Anonymous", async () => {
    const venue = await makeVenue();
    const pub = await makeActor({ isPrivate: false });
    const priv = await makeActor();
    for (const u of [pub, priv]) for (const d of [1, 9, 17]) await post(u.userId, venue.id, d);
    await post(pub.userId, venue.id, 0);
    await post(priv.userId, venue.id, 0);
    const page = await getVenuePage(prisma, venue.slug, await makeActor());
    const authors = page.live.livePhotos.map((p) => p.author);
    expect(authors).toContainEqual({ kind: "user", handle: pub.handle, verified: false, regular: true });
    expect(authors).toContainEqual({ kind: "anonymous" });
    // Profiles: full access shows "Regular at", limited shows nothing.
    const full = await getProfile(prisma, pub.handle, null);
    expect(full.access === "full" && full.regularAt.map((v) => v.slug)).toEqual([venue.slug]);
    const limited = await getProfile(prisma, priv.handle, null);
    expect(JSON.stringify(limited)).not.toContain(venue.slug);
    // Post detail carries it too.
    const latest = await prisma.photo.findFirstOrThrow({ where: { userId: pub.userId }, orderBy: { createdAt: "desc" } });
    expect((await getPost(prisma, null, latest.id)).post.author).toMatchObject({ regular: true });
  });

  it("a person can be a Regular at several venues", async () => {
    const [x, y] = [await makeVenue(), await makeVenue()];
    const u = await makeActor();
    for (const v of [x, y]) for (const d of [3, 10, 20]) await post(u.userId, v.id, d);
    expect((await regularVenuesOf(prisma, u.userId)).length).toBe(2);
  });
});

describe("verification and account deletion don't race", () => {
  it("a grant racing a deletion either lands before it (and is revoked with a log entry) or is refused", async () => {
    const { hashPassword } = await import("@/lib/auth/password");
    const { deleteAccount } = await import("@/server/services/account");
    const { actorFor, makeUser } = await import("./factories");
    for (let i = 0; i < 6; i++) {
      const admin = await makeActor({ role: "ADMIN" });
      const u = await makeUser();
      await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword("pw pw pw pw") } });
      const me = await actorFor(u.id);
      await Promise.allSettled([setVerified(prisma, admin, u.handle, { verified: true, note: "Known" }), deleteAccount(prisma, me, { password: "pw pw pw pw" })]);
      const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
      expect(row.verifiedAt).toBeNull();
      const log = await prisma.verificationEvent.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } });
      // Every grant that happened has a matching revoke.
      expect(log.filter((e) => e.action === "GRANT").length).toBe(log.filter((e) => e.action === "REVOKE").length);
    }
  });
});
