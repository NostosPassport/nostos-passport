import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { recordPresence, setGoingTonight } from "@/server/services/social";
import { follow, getProfile, searchUsers, unfollow } from "@/server/services/people";
import { getVenuePage, listVenuesForMap } from "@/server/services/venues";
import { makeActor, makeActor as makeActorWith, makeOwner, makeVenue, INSIDE, OUTSIDE, VENUE_POS } from "./factories";

const MIN = 60_000;

describe("presence (here now)", () => {
  it("records presence only inside the geofence", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    expect(await recordPresence(prisma, me, venue.id, OUTSIDE)).toMatchObject({ here: false, reason: "outside" });
    expect((await getVenuePage(prisma, venue.slug, null)).live.hereNow).toBe(0);
    expect(await recordPresence(prisma, me, venue.id, INSIDE)).toMatchObject({ here: true });
    expect((await getVenuePage(prisma, venue.slug, null)).live.hereNow).toBe(1);
  });

  it("expires 45 minutes after the last refresh; a refresh extends it", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const t0 = new Date();
    await recordPresence(prisma, me, venue.id, INSIDE, t0);
    const at = (m: number) => new Date(t0.getTime() + m * MIN);
    expect((await getVenuePage(prisma, venue.slug, null, at(44))).live.hereNow).toBe(1);
    expect((await getVenuePage(prisma, venue.slug, null, at(45))).live.hereNow).toBe(0);
    await recordPresence(prisma, me, venue.id, INSIDE, at(30));
    expect((await getVenuePage(prisma, venue.slug, null, at(74))).live.hereNow).toBe(1);
  });

  it("a ping from outside the geofence clears presence at that venue", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    await recordPresence(prisma, me, venue.id, INSIDE);
    await recordPresence(prisma, me, venue.id, OUTSIDE);
    expect((await getVenuePage(prisma, venue.slug, null)).live.hereNow).toBe(0);
  });

  it("you are only here at one venue at a time", async () => {
    const a = await makeVenue();
    const b = await makeVenue({ lat: VENUE_POS.lat + 0.01 });
    const me = await makeActor();
    await recordPresence(prisma, me, a.id, INSIDE);
    await recordPresence(prisma, me, b.id, { lat: b.lat, lng: b.lng });
    expect((await getVenuePage(prisma, a.slug, null)).live.hereNow).toBe(0);
    expect((await getVenuePage(prisma, b.slug, null)).live.hereNow).toBe(1);
  });

  it("venue accounts can't inflate their own here-now or going counts", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    expect(await recordPresence(prisma, owner, venue.id, INSIDE)).toMatchObject({ here: false, reason: "venue_account" });
    await expect(setGoingTonight(prisma, owner, venue.id, true)).rejects.toMatchObject({ status: 403 });
  });

  it("requires sign-in", async () => {
    const venue = await makeVenue();
    await expect(recordPresence(prisma, null, venue.id, INSIDE)).rejects.toMatchObject({ status: 401 });
  });
});

describe("going tonight", () => {
  it("toggles, is idempotent and resets at 5am America/New_York", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const fri11pm = new Date("2026-09-26T03:00:00Z");
    const sat4am = new Date("2026-09-26T08:59:00Z");
    const sat5am = new Date("2026-09-26T09:00:00Z");
    await setGoingTonight(prisma, me, venue.id, true, fri11pm);
    expect((await setGoingTonight(prisma, me, venue.id, true, fri11pm)).goingTonight).toBe(1);
    expect((await getVenuePage(prisma, venue.slug, me, sat4am)).live.goingTonight).toBe(1);
    expect((await getVenuePage(prisma, venue.slug, me, sat4am)).viewer.going).toBe(true);
    expect((await getVenuePage(prisma, venue.slug, me, sat5am)).live.goingTonight).toBe(0);
    expect((await getVenuePage(prisma, venue.slug, me, sat5am)).viewer.going).toBe(false);
    expect((await setGoingTonight(prisma, me, venue.id, false, fri11pm)).goingTonight).toBe(0);
  });
});

describe("follows and friends going", () => {
  // Public accounts, so follows are instant (requests are covered in people.test.ts).
  const makeActor = () => makeActorWith({ isPrivate: false });
  const plans = async (handle: string, viewer: Parameters<typeof getProfile>[2]) => {
    const p = await getProfile(prisma, handle, viewer);
    return p.access === "full" ? p.goingTonight : "limited";
  };

  it("friends going counts only mutual follows who RSVP'd tonight", async () => {
    const venue = await makeVenue();
    const [me, friend, stranger, crush] = [await makeActor(), await makeActor(), await makeActor(), await makeActor()];
    await follow(prisma, me, friend.handle);
    await follow(prisma, friend, me.handle);
    await follow(prisma, me, crush.handle); // one-way: crush's plans stay private
    await setGoingTonight(prisma, crush, venue.id, true);
    await setGoingTonight(prisma, friend, venue.id, true);
    await setGoingTonight(prisma, stranger, venue.id, true);
    const page = await getVenuePage(prisma, venue.slug, me);
    expect(page.live.goingTonight).toBe(3);
    expect(page.live.friendsGoing.map((f) => f.handle)).toEqual([friend.handle]);
    expect((await listVenuesForMap(prisma, me)).find((v) => v.id === venue.id)!.friendsGoing).toBe(1);
    expect((await listVenuesForMap(prisma, null)).find((v) => v.id === venue.id)!.friendsGoing).toBe(0);
    await unfollow(prisma, me, friend.handle);
    expect((await getVenuePage(prisma, venue.slug, me)).live.friendsGoing).toHaveLength(0);
  });

  it("can't follow yourself; follow is idempotent", async () => {
    const [me, other] = [await makeActor(), await makeActor()];
    await expect(follow(prisma, me, me.handle)).rejects.toMatchObject({ status: 400 });
    await follow(prisma, me, other.handle);
    await follow(prisma, me, other.handle);
    expect(await prisma.follow.count()).toBe(1);
  });

  it("plans are visible to mutual follows and self only; a one-way follow reveals nothing", async () => {
    const venue = await makeVenue();
    const [me, friend, fan, stranger] = [await makeActor(), await makeActor(), await makeActor(), await makeActor()];
    await setGoingTonight(prisma, me, venue.id, true);
    await follow(prisma, fan, me.handle);
    await follow(prisma, friend, me.handle);
    await follow(prisma, me, friend.handle);
    expect(await plans(me.handle, fan)).toBeNull();
    expect(await plans(me.handle, friend)).toHaveLength(1);
    expect(await plans(me.handle, me)).toHaveLength(1);
    expect(await plans(me.handle, stranger)).toBeNull();
    expect(await plans(me.handle, null)).toBeNull();
  });

  it("search finds people by handle and flags who you follow", async () => {
    const me = await makeActor();
    const other = await makeActorWith({ handle: "nightowl_42", isPrivate: false });
    await follow(prisma, me, other.handle);
    expect(await searchUsers(prisma, me, "@nightowl")).toEqual([
      { handle: "nightowl_42", displayName: "nightowl_42", avatarUrl: null, verified: false, follow: "following", isSelf: false },
    ]);
    expect(await searchUsers(prisma, me, "n")).toEqual([]);
  });
});
