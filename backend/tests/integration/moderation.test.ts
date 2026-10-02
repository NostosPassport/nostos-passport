import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { flagContent, moderate, moderationQueue, recentlyHidden } from "@/server/services/moderation";
import { getStamp, listUserStamps } from "@/server/services/stamps";
import { follow } from "@/server/services/people";
import { POST as modRoute } from "@/app/api/mod/actions/route";
import { POST as flagRoute } from "@/app/api/flags/route";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeStamp, makeVenue } from "./factories";

installMemoryStorage();

/** A stamp by a public author, so any signed-in person can see (and so report) it. */
async function publicStamp() {
  const venue = await makeVenue();
  const author = await makeActor({ isPrivate: false });
  const stamp = await makeStamp(author, venue.id, { caption: "crowd" });
  return { venue, author, stamp };
}

describe("flags", () => {
  it("three flags from distinct eligible users auto-hide a stamp pending review (logged as system)", async () => {
    const { stamp } = await publicStamp();
    const [a, b, c] = [await makeActor(), await makeActor(), await makeActor()];
    expect((await flagContent(prisma, a, { targetType: "STAMP", targetId: stamp.id, reason: "fake" })).autoHidden).toBe(false);
    await expect(flagContent(prisma, a, { targetType: "STAMP", targetId: stamp.id, reason: "fake again" })).rejects.toMatchObject({ status: 409 });
    expect((await flagContent(prisma, b, { targetType: "STAMP", targetId: stamp.id, reason: "fake" })).autoHidden).toBe(false);
    expect((await flagContent(prisma, c, { targetType: "STAMP", targetId: stamp.id, reason: "fake" })).autoHidden).toBe(true);
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: stamp.id } })).hiddenAt).not.toBeNull();
    expect(await prisma.moderationEvent.findFirst({ where: { action: "AUTO_HIDE", targetId: stamp.id } })).toMatchObject({ actorId: null });
    await expect(getStamp(prisma, await makeActor(), stamp.id)).rejects.toMatchObject({ status: 404 });
  });

  it("concurrent flags still auto-hide exactly once", async () => {
    const { stamp } = await publicStamp();
    const flaggers = await Promise.all([1, 2, 3, 4].map(() => makeActor()));
    await Promise.all(flaggers.map((f) => flagContent(prisma, f, { targetType: "STAMP", targetId: stamp.id, reason: "fake" }).catch(() => null)));
    expect(await prisma.moderationEvent.count({ where: { action: "AUTO_HIDE", targetId: stamp.id } })).toBe(1);
  });

  it("staff, new accounts and low-reputation accounts can flag but never count toward the auto-hide", async () => {
    const { stamp } = await publicStamp();
    await flagContent(prisma, await makeActor({ role: "MODERATOR" }), { targetType: "STAMP", targetId: stamp.id, reason: "hmm" });
    await flagContent(prisma, await makeActor({ ageDays: 1 }), { targetType: "STAMP", targetId: stamp.id, reason: "new account" });
    await flagContent(prisma, await makeActor({ reputation: 0.3 }), { targetType: "STAMP", targetId: stamp.id, reason: "low rep" });
    expect((await flagContent(prisma, await makeActor(), { targetType: "STAMP", targetId: stamp.id, reason: "fake" })).autoHidden).toBe(false);
  });

  it("you can't flag your own stamp, and signed-out people can't flag", async () => {
    const { author, stamp } = await publicStamp();
    await expect(flagContent(prisma, author, { targetType: "STAMP", targetId: stamp.id, reason: "oops" })).rejects.toMatchObject({ status: 400 });
    await expect(flagContent(prisma, null, { targetType: "STAMP", targetId: stamp.id, reason: "anon" })).rejects.toMatchObject({ status: 401 });
  });

  it("you can only report a stamp you can see: a private account's stamp is a 404 to strangers and requesters", async () => {
    const venue = await makeVenue();
    const priv = await makeActor();
    const stamp = await makeStamp(priv, venue.id);
    const stranger = await makeActor();
    const requester = await makeActor();
    await follow(prisma, requester, priv.handle);
    for (const v of [stranger, requester]) {
      await expect(flagContent(prisma, v, { targetType: "STAMP", targetId: stamp.id, reason: "probing" })).rejects.toMatchObject({ status: 404 });
    }
    expect(await prisma.flag.count({ where: { targetId: stamp.id } })).toBe(0);
  });

  it("reports carry a category (default OTHER): underage, stalking and not-at-this-place are first-class", async () => {
    const { stamp, author } = await publicStamp();
    const flaggers = [await makeActor(), await makeActor(), await makeActor(), await makeActor()];
    await flagContent(prisma, flaggers[0]!, { targetType: "STAMP", targetId: stamp.id, reason: "Not at this place", category: "NOT_AT_PLACE" });
    await flagContent(prisma, flaggers[1]!, { targetType: "STAMP", targetId: stamp.id, reason: "just wrong" });
    await flagContent(prisma, flaggers[2]!, { targetType: "USER", targetId: author.handle, reason: "Under 21 or looks underage", category: "UNDERAGE" });
    await flagContent(prisma, flaggers[3]!, { targetType: "USER", targetId: author.handle, reason: "Stalking or unwanted contact", category: "STALKING" });
    expect((await prisma.flag.findMany({ orderBy: { createdAt: "asc" } })).map((f) => f.category)).toEqual(["NOT_AT_PLACE", "OTHER", "UNDERAGE", "STALKING"]);
    await expect(flagContent(prisma, await makeActor(), { targetType: "STAMP", targetId: stamp.id, reason: "bad category", category: "BORING" })).rejects.toThrow();
  });

  it("the queue puts underage and stalking reports first, whatever their age", async () => {
    const mod = await makeActor({ role: "MODERATOR" });
    const old = await publicStamp();
    await flagContent(prisma, await makeActor(), { targetType: "STAMP", targetId: old.stamp.id, reason: "spam spam", category: "SPAM" });
    const urgent = await makeActor({ isPrivate: false });
    await flagContent(prisma, await makeActor(), { targetType: "USER", targetId: urgent.handle, reason: "Under 21 or looks underage", category: "UNDERAGE" });
    const queue = await moderationQueue(prisma, mod);
    expect(queue.map((q) => q.targetType)).toEqual(["USER", "STAMP"]);
    expect(queue[0]!.flags[0]).toMatchObject({ category: "UNDERAGE" });
    expect(queue[1]!.flags[0]).toMatchObject({ category: "SPAM" });
  });

  it("the old content types are not accepted", async () => {
    const { stamp } = await publicStamp();
    for (const targetType of ["PHOTO", "COMMENT", "REPORT"]) {
      await expect(flagContent(prisma, await makeActor(), { targetType, targetId: stamp.id, reason: "nope nope" })).rejects.toThrow();
    }
  });

  it("the hourly flag limit holds under parallel requests", async () => {
    const venue = await makeVenue();
    const flagger = await makeActor();
    const stamps = await Promise.all(Array.from({ length: 25 }, async () => makeStamp(await makeActor({ isPrivate: false }), venue.id)));
    const results = await Promise.allSettled(stamps.map((s) => flagContent(prisma, flagger, { targetType: "STAMP", targetId: s.id, reason: "spam!" })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(20);
    expect(await prisma.flag.count({ where: { flaggerId: flagger.userId } })).toBe(20);
  });

  it("flags over HTTP: a signed-in person can report a visible stamp", async () => {
    const { stamp } = await publicStamp();
    const { token } = await createSession(prisma, (await makeActor()).userId);
    const res = await flagRoute(
      new Request("http://localhost/api/flags", { method: "POST", headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${token}` }, body: JSON.stringify({ targetType: "STAMP", targetId: stamp.id, reason: "not at this place" }) }),
      undefined as never,
    );
    expect(res.status).toBe(201);
  });
});

describe("rule 4: hidden content is hidden, never deleted; the log is append-only", () => {
  it("moderator hide keeps the row, resolves flags and logs; restore brings it back", async () => {
    const { stamp, author } = await publicStamp();
    const mod = await makeActor({ role: "MODERATOR" });
    await flagContent(prisma, await makeActor(), { targetType: "STAMP", targetId: stamp.id, reason: "abusive" });

    await moderate(prisma, mod, { targetType: "STAMP", targetId: stamp.id, action: "HIDE", note: "abusive" });
    const hidden = await prisma.photo.findUniqueOrThrow({ where: { id: stamp.id } });
    expect(hidden.hiddenAt).not.toBeNull();
    expect(hidden.caption).toBe("crowd");
    expect((await listUserStamps(prisma, await makeActor(), author.handle)).stamps).toHaveLength(0);
    // Staff can still open it.
    await expect(getStamp(prisma, mod, stamp.id)).resolves.toMatchObject({ stamp: { hidden: true } });
    expect(await prisma.flag.count({ where: { targetId: stamp.id, status: "OPEN" } })).toBe(0);
    expect(await moderationQueue(prisma, mod)).toHaveLength(0);
    expect((await recentlyHidden(prisma, mod)).map((i) => i.targetId)).toContain(stamp.id);

    await moderate(prisma, mod, { targetType: "STAMP", targetId: stamp.id, action: "RESTORE", note: "context" });
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: stamp.id } })).hiddenAt).toBeNull();
    const log = await prisma.moderationEvent.findMany({ where: { targetId: stamp.id }, orderBy: { createdAt: "asc" } });
    expect(log.map((e) => e.action)).toEqual(["FLAGGED", "HIDE", "RESTORE"]);
    expect(log[1]).toMatchObject({ actorId: mod.userId, note: "abusive" });
  });

  it("dismissing flags on an auto-hidden stamp restores it, and the whole history is kept", async () => {
    const { stamp } = await publicStamp();
    const mod = await makeActor({ role: "MODERATOR" });
    for (let i = 0; i < 3; i++) await flagContent(prisma, await makeActor(), { targetType: "STAMP", targetId: stamp.id, reason: "fake" });
    const queue = await moderationQueue(prisma, mod);
    expect(queue[0]).toMatchObject({ targetType: "STAMP", targetId: stamp.id });
    expect(queue[0]!.content?.hiddenAt).not.toBeNull();
    await moderate(prisma, mod, { targetType: "STAMP", targetId: stamp.id, action: "DISMISS" });
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: stamp.id } })).hiddenAt).toBeNull();
    const actions = (await prisma.moderationEvent.findMany({ where: { targetId: stamp.id }, orderBy: { createdAt: "asc" } })).map((e) => e.action);
    expect(actions).toEqual(["FLAGGED", "FLAGGED", "FLAGGED", "AUTO_HIDE", "DISMISS", "RESTORE"]);
  });

  it("DISMISS does not undo a moderator's own HIDE; RESTORE does", async () => {
    const { stamp } = await publicStamp();
    const mod = await makeActor({ role: "MODERATOR" });
    await moderate(prisma, mod, { targetType: "STAMP", targetId: stamp.id, action: "HIDE" });
    await moderate(prisma, mod, { targetType: "STAMP", targetId: stamp.id, action: "DISMISS" });
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: stamp.id } })).hiddenAt).not.toBeNull();
    await moderate(prisma, mod, { targetType: "STAMP", targetId: stamp.id, action: "RESTORE" });
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: stamp.id } })).hiddenAt).toBeNull();
  });

  it("after a dismissal the same user can flag the stamp again", async () => {
    const { stamp } = await publicStamp();
    const mod = await makeActor({ role: "MODERATOR" });
    const flagger = await makeActor();
    await flagContent(prisma, flagger, { targetType: "STAMP", targetId: stamp.id, reason: "meh!" });
    await moderate(prisma, mod, { targetType: "STAMP", targetId: stamp.id, action: "DISMISS" });
    await expect(flagContent(prisma, flagger, { targetType: "STAMP", targetId: stamp.id, reason: "still bad" })).resolves.toBeTruthy();
  });

  it("the moderation log can't be edited or deleted, even directly", async () => {
    const { stamp } = await publicStamp();
    await flagContent(prisma, await makeActor(), { targetType: "STAMP", targetId: stamp.id, reason: "spam!" });
    const ev = await prisma.moderationEvent.findFirstOrThrow({ where: { targetId: stamp.id } });
    await expect(prisma.moderationEvent.update({ where: { id: ev.id }, data: { note: "nothing happened" } })).rejects.toThrow(/append-only/);
    await expect(prisma.moderationEvent.deleteMany({})).rejects.toThrow(/append-only/);
  });

  it("only moderators can see the queue or act; over HTTP too", async () => {
    const { stamp } = await publicStamp();
    await expect(moderationQueue(prisma, await makeActor())).rejects.toMatchObject({ status: 403 });
    await expect(moderationQueue(prisma, await makeActor({ role: "ADMIN" }))).resolves.toEqual([]);
    await expect(moderate(prisma, await makeActor(), { targetType: "STAMP", targetId: stamp.id, action: "HIDE" })).rejects.toMatchObject({ status: 403 });
    const { token } = await createSession(prisma, (await makeActor()).userId);
    const res = await modRoute(
      new Request("http://localhost/api/mod/actions", { method: "POST", headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${token}` }, body: JSON.stringify({ targetType: "STAMP", targetId: stamp.id, action: "HIDE" }) }),
      undefined as never,
    );
    expect(res.status).toBe(403);
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: stamp.id } })).hiddenAt).toBeNull();
  });
});
