// Phase 1: privacy foundation. The same private author is read through every payload by every kind of viewer.
// Stamps and places of a private account reach only people with full access (the author, an approved follower, staff).
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createStamp, getStamp, listFeed, listUserPlaces, listUserStamps } from "@/server/services/stamps";
import { decideFollowRequest, follow, getProfile, listConnections, searchUsers, updateProfile } from "@/server/services/people";
import { blockUser } from "@/server/services/blocks";
import { likeStamp } from "@/server/services/likes";
import { flagContent } from "@/server/services/moderation";
import { listActivity } from "@/server/services/activity";
import type { Actor } from "@/server/actor";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeStamp, makeVenue } from "./factories";

installMemoryStorage();
const wire = (x: unknown) => JSON.stringify(JSON.parse(JSON.stringify(x)));

type Kind = "signed out" | "stranger" | "requester" | "follower" | "self" | "staff" | "blocked by author" | "blocker of author";
const FULL: Kind[] = ["follower", "self", "staff"];

async function scene(isPrivate: boolean) {
  const venue = await makeVenue();
  const author = await makeActor({ isPrivate, handle: `author_${Math.random().toString(36).slice(2, 7)}` });
  const stamp = await makeStamp(author, venue.id, { caption: "secret caption", meta: { songTitle: "Secret Song", songArtist: "Hidden Band" } });
  const follower = await makeActor();
  await follow(prisma, follower, author.handle);
  if (isPrivate) await decideFollowRequest(prisma, author, follower.handle, { approve: true });
  const requester = await makeActor();
  if (isPrivate) await follow(prisma, requester, author.handle);
  const blockedByAuthor = await makeActor();
  await blockUser(prisma, author, blockedByAuthor.handle);
  const blocker = await makeActor();
  await blockUser(prisma, blocker, author.handle);
  const viewers: Record<Kind, Actor | null> = {
    "signed out": null,
    stranger: await makeActor(),
    requester,
    follower,
    self: author,
    staff: await makeActor({ role: "MODERATOR" }),
    "blocked by author": blockedByAuthor,
    "blocker of author": blocker,
  };
  return { venue, author, stamp, viewers };
}

/** Whether a viewer is expected to see the stamps of this author. Public: everyone except the blocked pair (staff too). */
const sees = (kind: Kind, isPrivate: boolean) => (isPrivate ? FULL.includes(kind) : kind !== "blocked by author" && kind !== "blocker of author");

for (const isPrivate of [true, false]) {
  describe(`an ${isPrivate ? "private" : "public"} account's stamps and places, by viewer`, () => {
    for (const kind of ["signed out", "stranger", "requester", "follower", "self", "staff", "blocked by author", "blocker of author"] as Kind[]) {
      const allowed = sees(kind, isPrivate) || (kind.startsWith("blocked") || kind.startsWith("blocker") ? false : false);
      const staffOverBlock = kind === "staff";
      it(`${kind}: ${allowed || staffOverBlock ? "sees" : "does not see"} the stamp, the grid, the places and the counts`, async () => {
        const { venue, author, stamp, viewers } = await scene(isPrivate);
        const v = viewers[kind];
        const secrets = [stamp.id, venue.slug, venue.name, "secret caption", "Secret Song", "Hidden Band"];
        const leaks = (payload: unknown) => secrets.filter((s) => wire(payload).includes(s));

        // Profile: counts and everything else only with full access; the limited view has the handle and badge only.
        const blockedPair = kind.startsWith("blocked") || kind.startsWith("blocker");
        if (blockedPair) {
          await expect(getProfile(prisma, author.handle, v)).rejects.toMatchObject({ status: 404 });
        } else {
          const profile = await getProfile(prisma, author.handle, v);
          expect(profile.access).toBe(allowed ? "full" : "limited");
          if (profile.access === "limited") expect(Object.keys(profile.user).sort()).toEqual(["handle", "isPrivate", "verified"]);
          expect(leaks(profile)).toEqual([]);
        }

        // Stamp detail: 404 (never 403) so existence isn't revealed.
        if (allowed || staffOverBlock) await expect(getStamp(prisma, v, stamp.id)).resolves.toBeTruthy();
        else await expect(getStamp(prisma, v, stamp.id)).rejects.toMatchObject({ status: 404 });

        // Lists: grid and places.
        for (const list of [() => listUserStamps(prisma, v, author.handle), () => listUserPlaces(prisma, v, author.handle)]) {
          if (allowed || staffOverBlock) await expect(list()).resolves.toBeTruthy();
          else await expect(list()).rejects.toMatchObject({ status: blockedPair ? 404 : 403 });
        }

        // Likes and reports need to see the stamp.
        if (v && !(allowed || staffOverBlock)) {
          await expect(likeStamp(prisma, v, stamp.id)).rejects.toMatchObject({ status: 404 });
          await expect(flagContent(prisma, v, { targetType: "STAMP", targetId: stamp.id, reason: "probing around" })).rejects.toMatchObject({ status: 404 });
        }

        // Search: the account may be found by handle, but only as the limited view unless the viewer has full access.
        if (v) {
          const found = await searchUsers(prisma, v, author.handle);
          if (blockedPair) expect(found).toEqual([]);
          expect(leaks(found)).toEqual([]);
        }

        // Followers and following lists need full access.
        if (!blockedPair) {
          for (const which of ["followers", "following"] as const) {
            if (allowed) await expect(listConnections(prisma, v, author.handle, which)).resolves.toBeTruthy();
            else await expect(listConnections(prisma, v, author.handle, which)).rejects.toMatchObject({ status: 403 });
          }
        }

        // Feed: only people you follow with approved follows; a pending request shows nothing. Never a blocked pair.
        if (v) {
          const feed = await listFeed(prisma, v);
          const expected = kind === "follower";
          expect(feed.stamps.map((s) => s.id).includes(stamp.id)).toBe(expected);
        }
      });
    }
  });
}

describe("activity never carries a private account's stamps to people without access", () => {
  it("a private person who likes your stamp shows as a handle only; their own stamps never appear", async () => {
    const venue = await makeVenue();
    const me = await makeActor({ isPrivate: false });
    const liker = await makeActor(); // private
    await makeStamp(liker, venue.id, { caption: "liker's secret", meta: { songTitle: "Liker Song", songArtist: "Liker Band" } });
    const mine = await makeStamp(me, (await makeVenue()).id);
    await prisma.photo.update({ where: { id: mine.id }, data: {} }).catch(() => {});
    await likeStamp(prisma, liker, mine.id);
    await follow(prisma, liker, me.handle);
    const activity = await listActivity(prisma, me);
    const json = wire(activity);
    expect(activity.find((a) => a.kind === "like")).toMatchObject({ person: { handle: liker.handle, displayName: null, avatarUrl: null } });
    expect(json).not.toContain("liker's secret");
    expect(json).not.toContain("Liker Song");
    expect(json).not.toContain(venue.slug);
  });

  it("likes by or on a blocked person disappear from activity in both directions", async () => {
    const me = await makeActor({ isPrivate: false });
    const fan = await makeActor();
    const mine = await makeStamp(me, (await makeVenue()).id);
    await likeStamp(prisma, fan, mine.id);
    expect((await listActivity(prisma, me)).filter((a) => a.kind === "like")).toHaveLength(1);
    await blockUser(prisma, me, fan.handle);
    expect((await listActivity(prisma, me)).filter((a) => a.kind === "like")).toHaveLength(0);
    expect((await listActivity(prisma, fan)).filter((a) => a.kind === "like")).toHaveLength(0);
  });
});

describe("blocking by handle hides the pair from each other everywhere", () => {
  it("profile, search, lists, feed, activity and likes: nothing leaks in either direction", async () => {
    const venue = await makeVenue();
    const [a, b] = [await makeActor({ isPrivate: false }), await makeActor({ isPrivate: false })];
    const sa = await makeStamp(a, venue.id, { caption: "a's stamp" });
    const sb = await makeStamp(b, (await makeVenue()).id, { caption: "b's stamp" });
    await follow(prisma, a, b.handle);
    await follow(prisma, b, a.handle);
    await likeStamp(prisma, a, sb.id);
    await likeStamp(prisma, b, sa.id);
    await blockUser(prisma, a, b.handle);
    for (const [x, y, ys] of [[a, b, sb], [b, a, sa]] as const) {
      await expect(getProfile(prisma, y.handle, x)).rejects.toMatchObject({ status: 404 });
      await expect(getStamp(prisma, x, ys.id)).rejects.toMatchObject({ status: 404 });
      await expect(listUserStamps(prisma, x, y.handle)).rejects.toMatchObject({ status: 404 });
      await expect(listUserPlaces(prisma, x, y.handle)).rejects.toMatchObject({ status: 404 });
      await expect(listConnections(prisma, x, y.handle, "followers")).rejects.toMatchObject({ status: 404 });
      await expect(likeStamp(prisma, x, ys.id)).rejects.toMatchObject({ status: 404 });
      await expect(follow(prisma, x, y.handle)).rejects.toMatchObject({ status: 403 });
      expect(await searchUsers(prisma, x, y.handle)).toEqual([]);
      expect((await listFeed(prisma, x)).stamps).toEqual([]);
      expect(wire(await listActivity(prisma, x))).not.toContain(y.handle);
    }
    // Neither side's like counts on the other's stamp are shown to the blocked party; staff still see both.
    const staff = await makeActor({ role: "MODERATOR" });
    await expect(getStamp(prisma, staff, sa.id)).resolves.toBeTruthy();
    await expect(getProfile(prisma, b.handle, staff)).resolves.toBeTruthy();
  });

  it("a third party sees neither person's block", async () => {
    const [a, b, c] = [await makeActor({ isPrivate: false }), await makeActor({ isPrivate: false }), await makeActor()];
    await blockUser(prisma, a, b.handle);
    const profile = await getProfile(prisma, a.handle, c);
    expect(wire(profile)).not.toContain(b.handle);
  });
});

describe("going public changes what strangers can see", () => {
  it("every stamp and place becomes visible to strangers and signed-out people; going private hides them again", async () => {
    const venue = await makeVenue();
    const author = await makeActor();
    const stamp = await makeStamp(author, venue.id);
    const stranger = await makeActor();
    await expect(listUserStamps(prisma, stranger, author.handle)).rejects.toMatchObject({ status: 403 });
    await expect(listUserPlaces(prisma, null, author.handle)).rejects.toMatchObject({ status: 403 });
    await updateProfile(prisma, author, { isPrivate: false });
    expect((await listUserStamps(prisma, stranger, author.handle)).stamps.map((s) => s.id)).toEqual([stamp.id]);
    expect((await listUserPlaces(prisma, null, author.handle)).places).toHaveLength(1);
    await expect(getStamp(prisma, null, stamp.id)).resolves.toBeTruthy();
    await updateProfile(prisma, author, { isPrivate: true });
    await expect(getStamp(prisma, stranger, stamp.id)).rejects.toMatchObject({ status: 404 });
    await expect(listUserStamps(prisma, null, author.handle)).rejects.toMatchObject({ status: 403 });
  });
});

describe("per-stamp visibility is the account's privacy: there is no sharing toggle", () => {
  it("a stamp request that tries to set `shared` is refused, and the schema has no such column", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    await expect(createStamp(prisma, me, venue.id, { meta: { caption: "x", lat: "40.7265", lng: "-73.9845", shared: "true" } })).rejects.toThrow();
    const cols = await prisma.$queryRaw<{ column_name: string }[]>`SELECT column_name FROM information_schema.columns WHERE table_name = 'photo'`;
    expect(cols.map((c) => c.column_name)).not.toContain("shared");
  });
});
