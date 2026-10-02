import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { prisma } from "@/lib/db";
import { createPromo, endPromo, requestClaim, setOfficialPhoto, updateOfficialInfo } from "@/server/services/owner";
import { reviewClaim, setPromoPaid } from "@/server/services/admin";
import { addComment, replyAsVenue } from "@/server/services/comments";
import { getVenuePage, venueAccuracy } from "@/server/services/venues";
import { loadActor } from "@/server/actor";
import { PATCH as officialRoute } from "@/app/api/owner/venues/[id]/route";
import { POST as promoRoute } from "@/app/api/owner/venues/[id]/promos/route";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeOwner, makeUser, makeVenue, INSIDE } from "./factories";

installMemoryStorage();
const H = 3600_000;
/** New York wall-clock "YYYY-MM-DDTHH:MM" for an instant, as the promo form sends it. */
const ny = (d: Date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};

const png = () => {
  const p = new PNG({ width: 2, height: 2 });
  p.data.fill(90);
  return PNG.sync.write(p);
};

describe("owner: official info", () => {
  it("only an approved owner of that venue can edit it", async () => {
    const venue = await makeVenue();
    const other = await makeVenue();
    const owner = await makeOwner(venue.id);
    await expect(updateOfficialInfo(prisma, owner, other.id, { dressCode: "x" })).rejects.toMatchObject({ status: 403 });
    await expect(updateOfficialInfo(prisma, await makeActor(), venue.id, { dressCode: "x" })).rejects.toMatchObject({ status: 403 });
    await expect(updateOfficialInfo(prisma, await makeActor({ role: "MODERATOR" }), venue.id, { dressCode: "x" })).rejects.toMatchObject({ status: 403 });
    await expect(updateOfficialInfo(prisma, null, venue.id, { dressCode: "x" })).rejects.toMatchObject({ status: 401 });
    await expect(updateOfficialInfo(prisma, owner, venue.id, { dressCode: "No flip-flops", officialCover: "15" })).resolves.toMatchObject({ dressCode: "No flip-flops", officialCoverCents: 1500 });
  });

  it("a pending claim grants nothing", async () => {
    const venue = await makeVenue();
    const u = await makeUser();
    await prisma.venueClaim.create({ data: { venueId: venue.id, userId: u.id, status: "PENDING" } });
    await expect(updateOfficialInfo(prisma, await loadActor(prisma, u.id), venue.id, { dressCode: "x" })).rejects.toMatchObject({ status: 403 });
  });

  it("appends cover changes to history; 'free' is 0 and blank is not stated", async () => {
    const venue = await makeVenue({ officialCoverCents: 1000 });
    const owner = await makeOwner(venue.id);
    await updateOfficialInfo(prisma, owner, venue.id, { officialCover: "free" });
    await updateOfficialInfo(prisma, owner, venue.id, { officialCover: "" });
    await updateOfficialInfo(prisma, owner, venue.id, { officialCover: "" }); // no-op: no new row
    const hist = await prisma.venueCoverHistory.findMany({ where: { venueId: venue.id }, orderBy: { effectiveFrom: "asc" } });
    expect(hist.map((h) => h.coverCents)).toEqual([1000, 0, null]);
    expect(hist[1]!.changedById).toBe(owner.userId);
    await expect(updateOfficialInfo(prisma, owner, venue.id, { officialCover: "lots" })).rejects.toMatchObject({ status: 400 });
  });

  it("validates hours", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    await expect(updateOfficialInfo(prisma, owner, venue.id, { hours: [{ day: 9, open: "20:00", close: "02:00" }] })).rejects.toThrow();
    await expect(updateOfficialInfo(prisma, owner, venue.id, { hours: [{ day: 5, open: "8pm", close: "02:00" }] })).rejects.toThrow();
  });

  it("official photo: owner only, image validated", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    await expect(setOfficialPhoto(prisma, await makeActor(), venue.id, png())).rejects.toMatchObject({ status: 403 });
    await expect(setOfficialPhoto(prisma, owner, venue.id, Buffer.from("GIF89a"))).rejects.toMatchObject({ status: 415 });
    const v = await setOfficialPhoto(prisma, owner, venue.id, png());
    expect(v.officialPhotoKey).toMatch(/^official\/[a-f0-9]{32}\.png$/);
  });
});

describe("invariant 4: the accuracy score is computed only from data, never set", () => {
  it("rejects any attempt to send an accuracy score (service and HTTP)", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    await expect(updateOfficialInfo(prisma, owner, venue.id, { accuracyScore: 100 })).rejects.toThrow(/Unrecognized key/);
    await expect(updateOfficialInfo(prisma, owner, venue.id, { dressCode: "x", accuracy: { scorePct: 100 } })).rejects.toThrow();
    const u = await prisma.user.findFirstOrThrow({ where: { id: owner.userId } });
    const { token } = await createSession(prisma, u.id);
    const res = await officialRoute(
      new Request(`http://localhost/api/owner/venues/${venue.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
        body: JSON.stringify({ accuracyScore: 100 }),
      }),
      { params: Promise.resolve({ id: venue.id }) },
    );
    expect(res.status).toBe(400);
  });

  it("there is no accuracy column anywhere in the schema", async () => {
    const cols = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name ILIKE '%accura%'`;
    expect(cols).toEqual([]);
  });

  it("changing the official cover now doesn't rewrite past windows", async () => {
    const venue = await makeVenue({ officialCoverCents: 1000 });
    const owner = await makeOwner(venue.id);
    const now = new Date();
    const base = Math.floor(now.getTime() / H) * H;
    // 5 past hours where users paid $20 against an official $10: 0% accurate
    for (let k = 1; k <= 5; k++) {
      for (let i = 0; i < 3; i++) {
        const u = await makeUser();
        await prisma.report.create({ data: { userId: u.id, venueId: venue.id, type: "COVER", coverCents: 2000, ...INSIDE, createdAt: new Date(base - k * H + (i + 1) * 60_000) } });
      }
    }
    expect(await venueAccuracy(prisma, venue.id, now)).toMatchObject({ status: "ok", scorePct: 0, qualifyingWindows: 5 });
    await updateOfficialInfo(prisma, owner, venue.id, { officialCover: "20" }, now);
    expect(await venueAccuracy(prisma, venue.id, now)).toMatchObject({ status: "ok", scorePct: 0, qualifyingWindows: 5 });
  });

  it("the accuracy score on the page reflects data only", async () => {
    const venue = await makeVenue();
    const page = await getVenuePage(prisma, venue.slug, null);
    expect(page.official.accuracy).toMatchObject({ status: "insufficient", qualifyingWindows: 0 });
  });
});

describe("promos", () => {
  it("owners create unpaid promos; isPaid in the payload is rejected", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    const window = { startsAt: ny(new Date()), endsAt: ny(new Date(Date.now() + 3 * H)) };
    await expect(createPromo(prisma, owner, venue.id, { title: "Hi", body: "there", ...window, isPaid: true })).rejects.toThrow(/Unrecognized key/);
    const p = await createPromo(prisma, owner, venue.id, { title: "Happy hour", body: "Half-price", ...window });
    expect(p.isPaid).toBe(false);
    await expect(createPromo(prisma, await makeActor(), venue.id, { title: "Spam", body: "spam", ...window })).rejects.toMatchObject({ status: 403 });
  });

  it("only admins can set the paid flag", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    const p = await createPromo(prisma, owner, venue.id, { title: "Happy hour", body: "x!!", startsAt: ny(new Date()), endsAt: ny(new Date(Date.now() + H)) });
    await expect(setPromoPaid(prisma, owner, p.id, { isPaid: true })).rejects.toMatchObject({ status: 403 });
    await expect(setPromoPaid(prisma, await makeActor({ role: "MODERATOR" }), p.id, { isPaid: true })).rejects.toMatchObject({ status: 403 });
    await expect(setPromoPaid(prisma, await makeActor({ role: "ADMIN" }), p.id, { isPaid: true })).resolves.toMatchObject({ isPaid: true });
  });

  it("owner can end their own promo but not another venue's", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    const rival = await makeOwner((await makeVenue()).id);
    const p = await createPromo(prisma, owner, venue.id, { title: "Happy hour", body: "x!!", startsAt: ny(new Date(Date.now() - H)), endsAt: ny(new Date(Date.now() + H)) });
    await expect(endPromo(prisma, rival, p.id)).rejects.toMatchObject({ status: 403 });
    const ended = await endPromo(prisma, owner, p.id);
    expect(ended.endsAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect((await getVenuePage(prisma, venue.slug, null)).official.promos).toHaveLength(0);
  });
});

describe("promo scheduling", () => {
  it("interprets form times as New York wall-clock time", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    const now = new Date("2026-09-25T20:00:00Z");
    const p = await createPromo(prisma, owner, venue.id, { title: "Late set", body: "DJ at 11", startsAt: "2026-09-25T23:00", endsAt: "2026-09-26T02:00" }, now);
    expect(p.startsAt.toISOString()).toBe("2026-09-26T03:00:00.000Z");
    expect(p.endsAt.toISOString()).toBe("2026-09-26T06:00:00.000Z");
  });

  it("rejects promos already over, too far ahead, or with blank dates", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    const now = new Date("2026-09-25T20:00:00Z");
    await expect(createPromo(prisma, owner, venue.id, { title: "Old", body: "old!", startsAt: "2026-09-01T20:00", endsAt: "2026-09-01T23:00" }, now)).rejects.toMatchObject({ status: 400 });
    await expect(createPromo(prisma, owner, venue.id, { title: "Far", body: "far!", startsAt: "2027-06-01T20:00", endsAt: "2027-06-01T23:00" }, now)).rejects.toMatchObject({ status: 400 });
    await expect(createPromo(prisma, owner, venue.id, { title: "Blank", body: "blank", startsAt: "", endsAt: "" }, now)).rejects.toThrow();
  });

  it("works end to end through the HTTP route (raw body reaches the service once)", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    const { token } = await createSession(prisma, owner.userId);
    const res = await promoRoute(
      new Request(`http://localhost/api/owner/venues/${venue.id}/promos`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
        body: JSON.stringify({ title: "Tonight", body: "Live band", startsAt: ny(new Date()), endsAt: ny(new Date(Date.now() + 2 * H)) }),
      }),
      { params: Promise.resolve({ id: venue.id }) },
    );
    expect(res.status).toBe(201);
  });

  it("a scheduled promo can be cancelled before it starts", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    const p = await createPromo(prisma, owner, venue.id, { title: "Next week", body: "soon", startsAt: ny(new Date(Date.now() + 48 * H)), endsAt: ny(new Date(Date.now() + 50 * H)) });
    const ended = await endPromo(prisma, owner, p.id);
    expect(ended.endsAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(ended.startsAt.getTime()).toBeLessThan(ended.endsAt.getTime());
  });
});

describe("claims", () => {
  it("a rejected claim can be re-requested; duplicate or already-approved claims are refused", async () => {
    const venue = await makeVenue();
    const admin = await makeActor({ role: "ADMIN" });
    const u = await makeActor();
    const c = await requestClaim(prisma, u, { venueId: venue.id });
    await expect(requestClaim(prisma, u, { venueId: venue.id })).rejects.toMatchObject({ status: 409 });
    await reviewClaim(prisma, admin, c.id, { approve: false });
    expect((await requestClaim(prisma, u, { venueId: venue.id })).status).toBe("PENDING");
    await reviewClaim(prisma, admin, c.id, { approve: true });
    await expect(requestClaim(prisma, (await loadActor(prisma, u.userId))!, { venueId: venue.id })).rejects.toMatchObject({ status: 409 });
  });

  it("two admins can't both decide the same claim", async () => {
    const venue = await makeVenue();
    const [a1, a2] = [await makeActor({ role: "ADMIN" }), await makeActor({ role: "ADMIN" })];
    const u = await makeActor();
    const c = await requestClaim(prisma, u, { venueId: venue.id });
    const results = await Promise.allSettled([reviewClaim(prisma, a1, c.id, { approve: true }), reviewClaim(prisma, a2, c.id, { approve: false })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const final = await prisma.venueClaim.findUniqueOrThrow({ where: { id: c.id } });
    const role = (await prisma.user.findUniqueOrThrow({ where: { id: u.userId } })).role;
    expect(role === "VENUE_OWNER").toBe(final.status === "APPROVED");
  });

  it("an existing owner can claim a second venue", async () => {
    const [v1, v2] = [await makeVenue(), await makeVenue()];
    const owner = await makeOwner(v1.id);
    const c = await requestClaim(prisma, owner, { venueId: v2.id });
    await reviewClaim(prisma, await makeActor({ role: "ADMIN" }), c.id, { approve: true });
    expect((await loadActor(prisma, owner.userId))!.ownedVenueIds.sort()).toEqual([v1.id, v2.id].sort());
  });

  it("user claims, admin approves, user becomes VENUE_OWNER of exactly that venue", async () => {
    const venue = await makeVenue();
    const other = await makeVenue();
    const u = await makeActor();
    const claim = await requestClaim(prisma, u, { venueId: venue.id });
    await expect(reviewClaim(prisma, u, claim.id, { approve: true })).rejects.toMatchObject({ status: 403 });
    await reviewClaim(prisma, await makeActor({ role: "ADMIN" }), claim.id, { approve: true });
    const now = (await loadActor(prisma, u.userId))!;
    expect(now.role).toBe("VENUE_OWNER");
    expect(now.ownedVenueIds).toEqual([venue.id]);
    await expect(updateOfficialInfo(prisma, now, other.id, { dressCode: "x" })).rejects.toMatchObject({ status: 403 });
  });

  it("staff can't claim venues", async () => {
    const venue = await makeVenue();
    await expect(requestClaim(prisma, await makeActor({ role: "MODERATOR" }), { venueId: venue.id })).rejects.toMatchObject({ status: 400 });
  });
});

describe("venue replies", () => {
  it("owner replies to a user comment at their venue, labelled, one level deep", async () => {
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    const c = await addComment(prisma, await makeActor(), venue.id, { body: "charged $20" });
    const reply = await replyAsVenue(prisma, owner, c.id, { body: "Sorry! Our cover is $10." });
    expect(reply).toMatchObject({ isVenueReply: true, parentId: c.id });
    await expect(replyAsVenue(prisma, owner, reply.id, { body: "nested" })).rejects.toMatchObject({ status: 400 });
    const page = await getVenuePage(prisma, venue.slug, null);
    expect(page.live.comments).toHaveLength(1);
    expect(page.live.comments[0]!.replies.map((r) => r.body)).toEqual(["Sorry! Our cover is $10."]);
  });

  it("only owners of that venue can reply", async () => {
    const venue = await makeVenue();
    const rival = await makeOwner((await makeVenue()).id);
    const c = await addComment(prisma, await makeActor(), venue.id, { body: "fun" });
    await expect(replyAsVenue(prisma, rival, c.id, { body: "come to ours" })).rejects.toMatchObject({ status: 403 });
    await expect(replyAsVenue(prisma, await makeActor(), c.id, { body: "me too" })).rejects.toMatchObject({ status: 403 });
  });
});

describe("bootstrapping staff roles", () => {
  it("promotes a signed-up account to ADMIN or MODERATOR by email, never to VENUE_OWNER", async () => {
    const { setStaffRoleByEmail } = await import("@/server/services/admin");
    const u = await makeUser({ handle: "first_admin" });
    expect(await setStaffRoleByEmail(prisma, "FIRST_ADMIN@test.dev", "ADMIN")).toEqual({ handle: "first_admin", role: "ADMIN" });
    await expect(setStaffRoleByEmail(prisma, "first_admin@test.dev", "VENUE_OWNER")).rejects.toThrow();
    await expect(setStaffRoleByEmail(prisma, "nobody@test.dev", "ADMIN")).rejects.toMatchObject({ status: 404 });
    const venue = await makeVenue();
    const owner = await makeOwner(venue.id);
    const ownerRow = await prisma.user.findUniqueOrThrow({ where: { id: owner.userId } });
    await expect(setStaffRoleByEmail(prisma, ownerRow.email, "ADMIN")).rejects.toMatchObject({ status: 400 });
    void u;
  });
});
