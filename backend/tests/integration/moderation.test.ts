import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { flagContent, moderate, moderationQueue } from "@/server/services/moderation";
import { addComment, editComment, replyAsVenue } from "@/server/services/comments";
import { getProfile } from "@/server/services/people";
import { getVenuePage } from "@/server/services/venues";
import { POST as modRoute } from "@/app/api/mod/actions/route";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { makeActor, makeOwner, makeUser, makeVenue, INSIDE } from "./factories";

async function photoAt(venueId: string) {
  const author = await makeUser();
  return prisma.photo.create({
    data: { userId: author.id, venueId, storageKey: `photos/${Math.random().toString(16).slice(2)}.png`, mimeType: "image/png", caption: "crowd", ...INSIDE },
  });
}

describe("invariant 1: venue owners can't edit, delete, hide or reorder user content", () => {
  it("owner gets 403 on every moderation action for content at their own venue", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    const photo = await photoAt(venue.id);
    const comment = await addComment(prisma, await makeActor(), venue.id, { body: "cover was $20" });
    const report = await prisma.report.create({ data: { userId: (await makeUser()).id, venueId: venue.id, type: "COVER", coverCents: 2000, ...INSIDE } });
    for (const [targetType, targetId] of [["PHOTO", photo.id], ["COMMENT", comment.id], ["REPORT", report.id]] as const) {
      for (const action of ["HIDE", "DISMISS", "RESTORE"] as const) {
        await expect(moderate(prisma, owner, { targetType, targetId, action })).rejects.toMatchObject({ status: 403 });
      }
    }
    await expect(editComment(prisma, owner, comment.id, { body: "cover was $10" })).rejects.toMatchObject({ status: 403 });
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: photo.id } })).hiddenAt).toBeNull();
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } })).body).toBe("cover was $20");
    expect((await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).hiddenAt).toBeNull();
    expect(await prisma.moderationEvent.count({ where: { action: { in: ["HIDE", "DISMISS", "RESTORE"] } } })).toBe(0);
  });

  it("returns 403 over HTTP too, and there is no DELETE endpoint for user content", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    const photo = await photoAt(venue.id);
    const { token } = await createSession(prisma, owner.userId);
    const res = await modRoute(
      new Request("http://localhost/api/mod/actions", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
        body: JSON.stringify({ targetType: "PHOTO", targetId: photo.id, action: "HIDE" }),
      }),
      undefined as never,
    );
    expect(res.status).toBe(403);
    const commentRoute = await import("@/app/api/comments/[id]/route");
    expect("DELETE" in commentRoute).toBe(false);
  });

  it("owner flagging queues content but does not hide it", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    const comment = await addComment(prisma, await makeActor(), venue.id, { body: "bouncer charged $20" });
    await flagContent(prisma, owner, { targetType: "COMMENT", targetId: comment.id, reason: "False: our cover is $10" });
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } })).hiddenAt).toBeNull();
    expect((await getVenuePage(prisma, venue.slug, null)).live.comments.map((c) => c.id)).toContain(comment.id);
    const queue = await moderationQueue(prisma, await makeActor({ role: "MODERATOR" }));
    expect(queue[0]!.flags[0]).toMatchObject({ reason: "False: our cover is $10", byVenueOwner: true });
  });

  it("owner flags never count toward the 3-flag auto-hide", async () => {
    const venue = await makeVenue();
    const [o1, o2] = [await makeOwner(venue.id), await makeOwner(venue.id)];
    const photo = await photoAt(venue.id);
    await flagContent(prisma, o1, { targetType: "PHOTO", targetId: photo.id, reason: "unflattering" });
    await flagContent(prisma, o2, { targetType: "PHOTO", targetId: photo.id, reason: "unflattering" });
    const r = await flagContent(prisma, await makeActor(), { targetType: "PHOTO", targetId: photo.id, reason: "fake" });
    expect(r.autoHidden).toBe(false);
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: photo.id } })).hiddenAt).toBeNull();
  });
});

describe("flags", () => {
  it("three flags from distinct users auto-hide a photo pending review (logged as system)", async () => {
    const venue = await makeVenue();
    const photo = await photoAt(venue.id);
    const [a, b, c] = [await makeActor(), await makeActor(), await makeActor()];
    expect((await flagContent(prisma, a, { targetType: "PHOTO", targetId: photo.id, reason: "fake" })).autoHidden).toBe(false);
    await expect(flagContent(prisma, a, { targetType: "PHOTO", targetId: photo.id, reason: "fake again" })).rejects.toMatchObject({ status: 409 });
    expect((await flagContent(prisma, b, { targetType: "PHOTO", targetId: photo.id, reason: "fake" })).autoHidden).toBe(false);
    expect((await flagContent(prisma, c, { targetType: "PHOTO", targetId: photo.id, reason: "fake" })).autoHidden).toBe(true);
    const row = await prisma.photo.findUniqueOrThrow({ where: { id: photo.id } });
    expect(row.hiddenAt).not.toBeNull();
    expect(await prisma.moderationEvent.findFirst({ where: { action: "AUTO_HIDE", targetId: photo.id } })).toMatchObject({ actorId: null });
    expect((await getVenuePage(prisma, venue.slug, null)).live.livePhotos).toHaveLength(0);
  });

  it("concurrent flags still auto-hide exactly once", async () => {
    const venue = await makeVenue();
    const photo = await photoAt(venue.id);
    const flaggers = await Promise.all([1, 2, 3, 4].map(() => makeActor()));
    await Promise.all(flaggers.map((f) => flagContent(prisma, f, { targetType: "PHOTO", targetId: photo.id, reason: "fake" }).catch(() => null)));
    expect(await prisma.moderationEvent.count({ where: { action: "AUTO_HIDE", targetId: photo.id } })).toBe(1);
  });

  it("comments don't auto-hide; you can't flag your own content or hidden content", async () => {
    const venue = await makeVenue();
    const author = await makeActor();
    const comment = await addComment(prisma, author, venue.id, { body: "hi" });
    for (let i = 0; i < 3; i++) await flagContent(prisma, await makeActor(), { targetType: "COMMENT", targetId: comment.id, reason: "rude!" });
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } })).hiddenAt).toBeNull();
    await expect(flagContent(prisma, author, { targetType: "COMMENT", targetId: comment.id, reason: "oops" })).rejects.toMatchObject({ status: 400 });
    await expect(flagContent(prisma, null, { targetType: "COMMENT", targetId: comment.id, reason: "anon" })).rejects.toMatchObject({ status: 401 });
  });
});

describe("invariant 5: hidden content is hidden, never deleted; the log is append-only", () => {
  it("moderator hide keeps the row, resolves flags and logs; dismiss restores and logs", async () => {
    const venue = await makeVenue();
    const mod = await makeActor({ role: "MODERATOR" });
    const comment = await addComment(prisma, await makeActor(), venue.id, { body: "slur" });
    await flagContent(prisma, await makeActor(), { targetType: "COMMENT", targetId: comment.id, reason: "abusive" });

    await moderate(prisma, mod, { targetType: "COMMENT", targetId: comment.id, action: "HIDE", note: "abusive" });
    const hidden = await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } });
    expect(hidden.hiddenAt).not.toBeNull();
    expect(hidden.body).toBe("slur");
    expect((await getVenuePage(prisma, venue.slug, null)).live.comments).toHaveLength(0);
    expect(await prisma.flag.count({ where: { targetId: comment.id, status: "OPEN" } })).toBe(0);
    expect(await moderationQueue(prisma, mod)).toHaveLength(0);

    await moderate(prisma, mod, { targetType: "COMMENT", targetId: comment.id, action: "RESTORE", note: "context" });
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } })).hiddenAt).toBeNull();

    const log = await prisma.moderationEvent.findMany({ where: { targetId: comment.id }, orderBy: { createdAt: "asc" } });
    expect(log.map((e) => e.action)).toEqual(["FLAGGED", "HIDE", "RESTORE"]);
    expect(log[1]).toMatchObject({ actorId: mod.userId, note: "abusive" });
  });

  it("dismissing flags on an auto-hidden photo restores it, and the whole history is kept", async () => {
    const venue = await makeVenue();
    const mod = await makeActor({ role: "MODERATOR" });
    const photo = await photoAt(venue.id);
    for (let i = 0; i < 3; i++) await flagContent(prisma, await makeActor(), { targetType: "PHOTO", targetId: photo.id, reason: "fake" });
    const queue = await moderationQueue(prisma, mod);
    expect(queue[0]).toMatchObject({ targetId: photo.id });
    expect(queue[0]!.content?.hiddenAt).not.toBeNull();
    await moderate(prisma, mod, { targetType: "PHOTO", targetId: photo.id, action: "DISMISS" });
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: photo.id } })).hiddenAt).toBeNull();
    const actions = (await prisma.moderationEvent.findMany({ where: { targetId: photo.id }, orderBy: { createdAt: "asc" } })).map((e) => e.action);
    expect(actions).toEqual(["FLAGGED", "FLAGGED", "FLAGGED", "AUTO_HIDE", "DISMISS", "RESTORE"]);
  });

  it("hidden reports stop counting toward consensus but stay in the database", async () => {
    const venue = await makeVenue();
    const mod = await makeActor({ role: "MODERATOR" });
    const [a, b, troll] = [await makeUser(), await makeUser(), await makeUser()];
    const now = new Date();
    await prisma.report.create({ data: { userId: a.id, venueId: venue.id, type: "VIBE", vibe: "PACKED", ...INSIDE, createdAt: new Date(now.getTime() - 60_000) } });
    await prisma.report.create({ data: { userId: b.id, venueId: venue.id, type: "VIBE", vibe: "BUSY", ...INSIDE, createdAt: new Date(now.getTime() - 120_000) } });
    const bad = await prisma.report.create({ data: { userId: troll.id, venueId: venue.id, type: "VIBE", vibe: "DEAD", ...INSIDE, createdAt: now, } });
    expect((await getVenuePage(prisma, venue.slug, null, now)).live.consensus.vibe.reportCount).toBe(3);
    await moderate(prisma, mod, { targetType: "REPORT", targetId: bad.id, action: "HIDE" });
    expect((await getVenuePage(prisma, venue.slug, null, now)).live.consensus.vibe.reportCount).toBe(2);
    expect(await prisma.report.count()).toBe(3);
  });

  it("the moderation log can't be edited or deleted, even directly", async () => {
    const venue = await makeVenue();
    const comment = await addComment(prisma, await makeActor(), venue.id, { body: "x" });
    const { flag } = await flagContent(prisma, await makeActor(), { targetType: "COMMENT", targetId: comment.id, reason: "spam!" });
    const ev = await prisma.moderationEvent.findFirstOrThrow({ where: { targetId: flag.targetId } });
    await expect(prisma.moderationEvent.update({ where: { id: ev.id }, data: { note: "nothing happened" } })).rejects.toThrow(/append-only/);
    await expect(prisma.moderationEvent.deleteMany({})).rejects.toThrow(/append-only/);
  });

  it("only moderators can see the queue", async () => {
    const venue = await makeVenue();
    await expect(moderationQueue(prisma, await makeOwner(venue.id))).rejects.toMatchObject({ status: 403 });
    await expect(moderationQueue(prisma, await makeActor())).rejects.toMatchObject({ status: 403 });
    await expect(moderationQueue(prisma, await makeActor({ role: "ADMIN" }))).resolves.toEqual([]);
  });
});

describe("moderation edge cases", () => {
  it("competitor venue owners and staff don't count toward auto-hide either", async () => {
    const venue = await makeVenue();
    const photo = await photoAt(venue.id);
    const rivals = [await makeOwner((await makeVenue()).id), await makeOwner((await makeVenue()).id)];
    for (const r of rivals) await flagContent(prisma, r, { targetType: "PHOTO", targetId: photo.id, reason: "fake" });
    await flagContent(prisma, await makeActor({ role: "MODERATOR" }), { targetType: "PHOTO", targetId: photo.id, reason: "hmm" });
    expect((await flagContent(prisma, await makeActor(), { targetType: "PHOTO", targetId: photo.id, reason: "fake" })).autoHidden).toBe(false);
    const queue = await moderationQueue(prisma, await makeActor({ role: "MODERATOR" }));
    expect(queue[0]!.flags.filter((f) => f.byOtherVenueOwner)).toHaveLength(2);
  });

  it("the hourly flag limit holds under parallel requests", async () => {
    const venue = await makeVenue();
    const flagger = await makeActor();
    const comments = await Promise.all(Array.from({ length: 25 }, async (_, i) => addComment(prisma, await makeActor(), venue.id, { body: `c${i}` })));
    const results = await Promise.allSettled(comments.map((c) => flagContent(prisma, flagger, { targetType: "COMMENT", targetId: c.id, reason: "spam!" })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(20);
    expect(await prisma.flag.count({ where: { flaggerId: flagger.userId } })).toBe(20);
  });

  it("after a dismissal the same user can flag the item again", async () => {
    const venue = await makeVenue();
    const mod = await makeActor({ role: "MODERATOR" });
    const flagger = await makeActor();
    const author = await makeActor();
    const c = await addComment(prisma, author, venue.id, { body: "fine" });
    await flagContent(prisma, flagger, { targetType: "COMMENT", targetId: c.id, reason: "meh!" });
    await moderate(prisma, mod, { targetType: "COMMENT", targetId: c.id, action: "DISMISS" });
    await editComment(prisma, author, c.id, { body: "now it's abusive" });
    await expect(flagContent(prisma, flagger, { targetType: "COMMENT", targetId: c.id, reason: "edited to abuse" })).resolves.toBeTruthy();
  });

  it("DISMISS does not undo a moderator's own HIDE; RESTORE does", async () => {
    const venue = await makeVenue();
    const mod = await makeActor({ role: "MODERATOR" });
    const c = await addComment(prisma, await makeActor(), venue.id, { body: "rude" });
    await moderate(prisma, mod, { targetType: "COMMENT", targetId: c.id, action: "HIDE" });
    await moderate(prisma, mod, { targetType: "COMMENT", targetId: c.id, action: "DISMISS" });
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: c.id } })).hiddenAt).not.toBeNull();
    await moderate(prisma, mod, { targetType: "COMMENT", targetId: c.id, action: "RESTORE" });
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: c.id } })).hiddenAt).toBeNull();
  });

  it("users can flag a venue reply; moderators can hide it", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    const c = await addComment(prisma, await makeActor(), venue.id, { body: "charged $20" });
    const reply = await replyAsVenue(prisma, owner, c.id, { body: "you're lying" });
    await flagContent(prisma, await makeActor(), { targetType: "COMMENT", targetId: reply.id, reason: "hostile reply" });
    await moderate(prisma, await makeActor({ role: "MODERATOR" }), { targetType: "COMMENT", targetId: reply.id, action: "HIDE" });
    expect((await getVenuePage(prisma, venue.slug, null)).live.comments[0]!.replies).toHaveLength(0);
  });

  it("profile post counts exclude hidden and removed posts and live-only photos", async () => {
    const venue = await makeVenue();
    const u = await makeUser({ isPrivate: false });
    const photo = (key: string, extra: object) =>
      prisma.photo.create({ data: { userId: u.id, venueId: venue.id, storageKey: `photos/${key}.png`, mimeType: "image/png", caption: "", ...INSIDE, ...extra } });
    await photo("aa", { rating: 8, hiddenAt: new Date() });
    await photo("cc", { rating: 8, removedAt: new Date() });
    await photo("dd", {});
    await photo("bb", { rating: 8 });
    const p = await getProfile(prisma, u.handle, null);
    expect(p.access === "full" && p.user.counts.posts).toBe(1);
  });
});

