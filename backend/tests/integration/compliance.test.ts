import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { deleteAccount } from "@/server/services/account";
import { acceptCurrentTerms, getMe } from "@/server/services/me";
import { updateProfile } from "@/server/services/people";
import { getStamp } from "@/server/services/stamps";
import { loadActor } from "@/server/actor";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeStamp, makeVenue, OUTSIDE, seedEmailChallenge } from "./factories";

const mem = installMemoryStorage();

describe("account deletion", () => {
  it("requires a fresh email challenge for the signed-in account", async () => {
    const me = await makeActor({ handle: "delete_challenge" });
    const wrong = await seedEmailChallenge("someone-else@example.com", "DELETE_ACCOUNT");
    await expect(deleteAccount(prisma, me, wrong)).rejects.toMatchObject({ status: 400 });
    await expect(deleteAccount(prisma, null, wrong)).rejects.toMatchObject({ status: 401 });
  });

  it("anonymizes the account, revokes sessions, removes stamps from the passport, and deletes media", async () => {
    const venue = await makeVenue();
    const me = await makeActor({ handle: "leaver" });
    const stamp = await makeStamp(me, venue.id, { caption: "dance floor" });
    const rowBefore = await prisma.photo.findUniqueOrThrow({ where: { id: stamp.id } });
    const storageKey = rowBefore.storageKey!;
    expect(mem.has(storageKey)).toBe(true);
    await createSession(prisma, me.userId, { client: "IOS" });

    const userBefore = await prisma.user.findUniqueOrThrow({ where: { id: me.userId } });
    const challenge = await seedEmailChallenge(userBefore.email, "DELETE_ACCOUNT");
    await deleteAccount(prisma, me, challenge);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: me.userId } });
    expect(user.deletedAt).not.toBeNull();
    expect(user.email).toMatch(/^deleted-[a-f0-9]{16}@deleted\.invalid$/);
    expect(user.handle).toMatch(/^deleted-[a-f0-9]{16}$/);
    expect(user.displayName).toBe("Deleted user");
    expect(user.passwordHash).toBeNull();
    expect(user.bio).toBe("");
    expect(user.avatarKey).toBeNull();
    expect(user.geofenceExempt).toBe(false);
    expect(await prisma.session.count({ where: { userId: me.userId } })).toBe(0);
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: stamp.id } })).removedAt).not.toBeNull();
    expect(mem.has(storageKey)).toBe(false);
    expect(await loadActor(prisma, me.userId)).toBeNull();
    await expect(getStamp(prisma, me, stamp.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe("objectionable content", () => {
  it("rejects blocked text in stamp and profile entry points", async () => {
    const venue = await makeVenue();
    const me = await makeActor();
    const bad = { status: 400, code: "objectionable_content" };
    await expect(makeStamp(me, venue.id, { caption: "porn night" })).rejects.toMatchObject(bad);
    await expect(makeStamp(me, venue.id, { caption: "ok", meta: { songTitle: "total f4gg0t", songArtist: "Someone" } })).rejects.toMatchObject(bad);
    await expect(updateProfile(prisma, me, { displayName: "Slut Queen" })).rejects.toMatchObject(bad);
  });
});

describe("terms acceptance", () => {
  it("reports whether the current terms are accepted and records acceptance", async () => {
    const me = await makeActor();
    const before = await getMe(prisma, me);
    expect(before.terms.needsAcceptance).toBe(true);
    await expect(acceptCurrentTerms(prisma, me, { version: "1999-01-01" })).rejects.toMatchObject({ status: 400 });
    await acceptCurrentTerms(prisma, me, { version: before.terms.currentVersion });
    expect((await getMe(prisma, me)).terms).toMatchObject({ needsAcceptance: false, acceptedVersion: before.terms.currentVersion });
  });
});

describe("geofence-exempt review accounts", () => {
  it("can stamp outside the geofence and those stamps are marked non-countable", async () => {
    const venue = await makeVenue();
    const reviewer = await makeActor({ geofenceExempt: true });
    const normal = await makeActor();

    await expect(makeStamp(normal, venue.id, { at: OUTSIDE })).rejects.toMatchObject({ status: 403 });
    const stamp = await makeStamp(reviewer, venue.id, { at: OUTSIDE });
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: stamp.id } })).countable).toBe(false);
  });

  it("countable is a write-time snapshot and cannot be rewritten later", async () => {
    const venue = await makeVenue();
    const reviewer = await makeActor({ geofenceExempt: true });
    const real = await makeActor();
    const exemptStamp = await makeStamp(reviewer, venue.id, { at: OUTSIDE });
    const realStamp = await makeStamp(real, venue.id);

    await prisma.user.update({ where: { id: reviewer.userId }, data: { geofenceExempt: false } });
    await prisma.user.update({ where: { id: real.userId }, data: { geofenceExempt: true } });

    expect((await prisma.photo.findUniqueOrThrow({ where: { id: exemptStamp.id } })).countable).toBe(false);
    expect((await prisma.photo.findUniqueOrThrow({ where: { id: realStamp.id } })).countable).toBe(true);
    await expect(prisma.photo.update({ where: { id: exemptStamp.id }, data: { countable: true } })).rejects.toThrow(/immutable/);
  });
});
