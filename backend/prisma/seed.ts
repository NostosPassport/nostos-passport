/**
 * Deterministic seed: `pnpm db:seed` (or `pnpm db:reset`, which runs it after migrating).
 *
 * Determinism: all content comes from a fixed-seed PRNG, ids are assigned explicitly and every timestamp is
 * derived from an anchor time, so the "Friday night" data is live whenever you run it. With a pinned anchor
 * (SEED_NOW=2026-09-26T03:30:00Z, a Friday 11:30pm) every row is identical across runs; the only
 * difference is the random salt inside the shared dev password hash.
 */
import { PrismaClient, type LineWait, type Prisma, type Vibe } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { CURRENT_TERMS_VERSION } from "../src/server/services/auth";
import { mulberry32 } from "../src/lib/rng";
import { DAY_MS, HOUR_MS, MINUTE_MS, localParts, nightKey, zonedTimeToUtc } from "../src/lib/time";
import { recomputeAllReputations } from "../src/server/services/reputation";
import { placeholderPng } from "./placeholder-image";
import { storageFromEnv } from "../src/lib/storage";
import { assertSeedAllowed } from "./seed-guard";
import { seedSocial } from "./seed-social";
import { CAPTIONS, COMMENTS_BAD, COMMENTS_GOOD, FIRST_NAMES, LAST_INITIALS, VENUES, type VenueFixture } from "./seed-data";

const db = new PrismaClient();
const rng = mulberry32(20260925);
const NOW = process.env.SEED_NOW ? new Date(process.env.SEED_NOW) : new Date(Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS);
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * MINUTE_MS);
const TONIGHT = nightKey(NOW);
// Placeholder images go through the configured storage driver (local disk in development, R2 in preview).
const storage = storageFromEnv(process.env);

const OPPOSITE_VIBE: Record<Vibe, Vibe> = { PACKED: "DEAD", BUSY: "DEAD", CHILL: "PACKED", DEAD: "PACKED" };
const OPPOSITE_LINE: Record<LineWait, LineWait> = { NONE: "OVER_30", UNDER_10: "OVER_30", TEN_TO_30: "NONE", OVER_30: "NONE" };

let idCounter = 0;
const nextId = (prefix: string) => `seed_${prefix}_${String(++idCounter).padStart(6, "0")}`;

/** Jitter a coordinate by up to ~40m so reports sit inside the 100m geofence. */
function near(v: { lat: number; lng: number }) {
  return { lat: v.lat + (rng.next() - 0.5) * 0.0006, lng: v.lng + (rng.next() - 0.5) * 0.0007 };
}

async function truncateAll() {
  const tables = [
    "rate_event", "verification_event", "featured_run", "featured_photo", "photo_like", "follow_request",
  "block", "login_attempt", "moderation_event", "flag", "follow", "rsvp", "presence", "comment", "photo", "report", "promo",
    "venue_claim", "venue_cover_history", "venue", "session", "app_user",
  ];
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

type SeedUser = Prisma.UserCreateManyInput & { id: string; handle: string };

async function main() {
  assertSeedAllowed(process.env);
  console.log(`[seed] anchor ${NOW.toISOString()} (night ${TONIGHT})`);
  await truncateAll();

  // ---------------- Users ----------------
  // One shared hash for every seeded account: dev convenience, and seeding stays fast.
  const passwordHash = await hashPassword(process.env.DEV_SEED_PASSWORD ?? "lastcall-dev");
  const users: SeedUser[] = [];
  const mk = (handle: string, displayName: string, role: SeedUser["role"], ageDays: number): SeedUser => {
    const u: SeedUser = {
      id: `seed_u_${handle}`, handle, displayName, role, passwordHash,
      email: `${handle}@lastcall.dev`, createdAt: new Date(NOW.getTime() - ageDays * DAY_MS),
      termsAcceptedAt: new Date(NOW.getTime() - ageDays * DAY_MS), termsVersion: CURRENT_TERMS_VERSION,
    };
    users.push(u);
    return u;
  };
  const admin = mk("admin", "Admin Ada", "ADMIN", 400);
  const mod = mk("mod_morgan", "Morgan (Mod)", "MODERATOR", 380);
  const ownerVelvet = mk("owner_velvet", "Velvet Anchor Mgmt", "VENUE_OWNER", 300);
  const ownerNeon = mk("owner_neon", "Neon Oyster Team", "VENUE_OWNER", 200);
  const ownerBlue = mk("owner_bluehour", "Blue Hour Group", "VENUE_OWNER", 250);
  const ownerLantern = mk("owner_lantern", "Lantern & Lark", "VENUE_OWNER", 150);
  const troll = mk("partyhard99", "PARTYHARD", "USER", 45);
  const claimant = mk("moth_hopeful", "Moth Room Manager", "USER", 20);
  // App Review / QA account: may post from anywhere (reviewers aren't in NYC); nothing it posts is counted.
  const appReview = mk("appreview", "App Review", "USER", 30);
  appReview.geofenceExempt = true;
  if (process.env.APP_REVIEW_PASSWORD) appReview.passwordHash = await hashPassword(process.env.APP_REVIEW_PASSWORD);
  const regulars: SeedUser[] = [];
  for (let i = 0; regulars.length < 52; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length]!;
    const last = LAST_INITIALS[(i * 7) % LAST_INITIALS.length]!;
    const handle = `${first.toLowerCase()}${last.toLowerCase()}${i < FIRST_NAMES.length ? "" : i}`;
    // Varied account ages: a handful brand new, most months to years old.
    const age = i % 9 === 0 ? rng.int(0, 3) : rng.int(10, 900);
    regulars.push(mk(handle, `${first} ${last}.`, "USER", age));
  }
  const demo = regulars[0]!; // "ava" — the account the README suggests for a first look
  await db.user.createMany({ data: users });
  console.log(`[seed] ${users.length} users`);

  // ---------------- Venues ----------------
  const venueId = (slug: string) => `seed_v_${slug}`;
  await db.venue.createMany({
    data: VENUES.map((v) => ({
      id: venueId(v.slug), slug: v.slug, name: v.name, address: v.address, neighborhood: v.neighborhood,
      lat: v.lat, lng: v.lng, officialCoverCents: v.officialCoverCents, dressCode: v.dressCode,
      hours: [0, 1, 2, 3, 4, 5, 6].filter((d) => !v.closedDays?.includes(d)).map((day) => ({ day, open: v.open, close: v.close })),
      createdAt: new Date(NOW.getTime() - 120 * DAY_MS),
      updatedAt: new Date(NOW.getTime() - 120 * DAY_MS),
    })),
  });
  await db.venueCoverHistory.createMany({
    data: VENUES.map((v) => ({
      id: nextId("ch"), venueId: venueId(v.slug), coverCents: v.officialCoverCents, effectiveFrom: new Date(NOW.getTime() - 120 * DAY_MS),
    })),
  });

  // Claims (pre-approved owners + one pending for the admin queue)
  const approvedClaims: [SeedUser, string][] = [
    [ownerVelvet, "velvet-anchor"], [ownerNeon, "neon-oyster"], [ownerBlue, "blue-hour-social"],
    [ownerBlue, "delancey-echo"], [ownerLantern, "lantern-and-lark"],
  ];
  await db.venueClaim.createMany({
    data: [
      ...approvedClaims.map(([u, slug]) => ({
        id: nextId("cl"), userId: u.id, venueId: venueId(slug), status: "APPROVED" as const,
        reviewedById: admin.id, reviewedAt: new Date(NOW.getTime() - 60 * DAY_MS), createdAt: new Date(NOW.getTime() - 61 * DAY_MS),
      })),
      { id: nextId("cl"), userId: claimant.id, venueId: venueId("moth-room"), status: "PENDING" as const, createdAt: ago(600) },
    ],
  });

  // Official photos for claimed venues
  for (const [, slug] of approvedClaims) {
    const key = `official/seed-${slug}.png`;
    await writeImage(key);
    await db.venue.update({ where: { id: venueId(slug) }, data: { officialPhotoKey: key, updatedAt: new Date(NOW.getTime() - 60 * DAY_MS) } });
  }

  // Promos: one paid promo on a venue whose live reports are bad; one unpaid.
  await db.promo.createMany({
    data: [
      {
        id: nextId("pr"), venueId: venueId("neon-oyster"), title: "2-for-1 cocktails all night",
        body: "Tonight only: every cocktail is 2-for-1 until close. Best party on Avenue A!",
        startsAt: ago(180), endsAt: new Date(NOW.getTime() + 6 * HOUR_MS), isPaid: true, createdById: ownerNeon.id, createdAt: ago(200),
      },
      {
        id: nextId("pr"), venueId: venueId("blue-hour-social"), title: "Free entry before 10pm",
        body: "Skip the cover when you arrive before 10.", startsAt: ago(60 * 20), endsAt: new Date(NOW.getTime() + 5 * DAY_MS),
        isPaid: false, createdById: ownerBlue.id, createdAt: ago(60 * 21),
      },
    ],
  });

  // ---------------- Tonight: reports ----------------
  const reports: Prisma.ReportCreateManyInput[] = [];
  const reportersByVenue = new Map<string, SeedUser[]>();
  const recentMinute = () => Math.floor(rng.next() ** 1.7 * 170) + 1; // skewed toward "just now"

  for (const v of VENUES) {
    const reporters = rng.shuffle(regulars).slice(0, v.tonight.reporters);
    reportersByVenue.set(v.slug, reporters);
    for (const u of reporters) {
      const base = recentMinute();
      // a vibe report, sometimes a second one 20-60 min earlier (rate limit is 15 min per type)
      const vibeTimes = rng.chance(0.4) && base + 60 < 179 ? [base, base + rng.int(20, 60)] : [base];
      for (const m of vibeTimes) {
        reports.push({ id: nextId("r"), userId: u.id, venueId: venueId(v.slug), type: "VIBE", vibe: rng.weighted(v.tonight.vibe), ...near(v), createdAt: ago(m) });
      }
      if (rng.chance(0.8) && Object.keys(v.tonight.line).length) {
        reports.push({ id: nextId("r"), userId: u.id, venueId: venueId(v.slug), type: "LINE", line: rng.weighted(v.tonight.line), ...near(v), createdAt: ago(base + rng.int(0, 5)) });
      }
      if (rng.chance(0.65)) {
        const noise = rng.chance(0.1) ? rng.pick([-500, 500]) : 0;
        reports.push({ id: nextId("r"), userId: u.id, venueId: venueId(v.slug), type: "COVER", coverCents: Math.max(0, v.tonight.realCoverCents + noise), ...near(v), createdAt: ago(base + rng.int(0, 5)) });
      }
    }
  }
  // Troll: contradicts reality at busy venues tonight.
  for (const slug of ["velvet-anchor", "delancey-echo", "lantern-and-lark", "rivington-riot"]) {
    const v = VENUES.find((x) => x.slug === slug)!;
    const m = rng.int(5, 50);
    const topVibe = rng.weighted(v.tonight.vibe);
    reports.push({ id: nextId("r"), userId: troll.id, venueId: venueId(slug), type: "VIBE", vibe: OPPOSITE_VIBE[topVibe], ...near(v), createdAt: ago(m) });
    reports.push({ id: nextId("r"), userId: troll.id, venueId: venueId(slug), type: "COVER", coverCents: 0, ...near(v), createdAt: ago(m) });
  }

  // ---------------- History: 30 days of hour windows (accuracy score + reputation) ----------------
  const historyPool = regulars.slice(1); // everyone but the demo account
  let windows = 0;
  for (let d = 1; d <= 30; d++) {
    const p = localParts(new Date(NOW.getTime() - d * DAY_MS));
    const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(); // 0=Sun
    for (const v of VENUES) {
      if (!v.history) continue;
      const nights = v.history.nightsPerWeek >= 3 ? [4, 5, 6] : v.history.nightsPerWeek === 2 ? [5, 6] : [6];
      if (!nights.includes(weekday)) continue;
      const windowCount = v.slug === "clinton-cellar" ? 1 : 3; // Clinton Cellar: too few windows -> "Not enough data yet"
      // Each person reports at a venue in at most one window per night, so seeded data respects the 15-minute rate limit.
      const nightCrowd = rng.shuffle(historyPool);
      let trollUsedTonight = false;
      for (let w = 0; w < windowCount; w++) {
        const windowStart = zonedTimeToUtc(p.year, p.month, p.day, 22).getTime() + w * HOUR_MS;
        const people = nightCrowd.splice(0, rng.int(3, 5));
        const vibe = rng.weighted(v.tonight.vibe.PACKED || v.tonight.vibe.BUSY ? v.tonight.vibe : { CHILL: 2, BUSY: 1 });
        const line = rng.weighted(Object.keys(v.tonight.line).length ? v.tonight.line : { NONE: 1 });
        for (const u of people) {
          const at = new Date(windowStart + rng.int(1, 58) * MINUTE_MS);
          const jitter = v.history.jitterCents ? rng.int(-v.history.jitterCents / 100, v.history.jitterCents / 100) * 100 : 0;
          reports.push({ id: nextId("r"), userId: u.id, venueId: venueId(v.slug), type: "COVER", coverCents: Math.max(0, v.history.realCoverCents + jitter), ...near(v), createdAt: at });
          reports.push({ id: nextId("r"), userId: u.id, venueId: venueId(v.slug), type: "VIBE", vibe: rng.chance(0.85) ? vibe : rng.pick(["PACKED", "BUSY", "CHILL", "DEAD"] as const), ...near(v), createdAt: at });
          if (rng.chance(0.6)) reports.push({ id: nextId("r"), userId: u.id, venueId: venueId(v.slug), type: "LINE", line, ...near(v), createdAt: at });
        }
        if (!trollUsedTonight && rng.chance(0.5)) {
          trollUsedTonight = true;
          const at = new Date(windowStart + rng.int(1, 58) * MINUTE_MS);
          reports.push({ id: nextId("r"), userId: troll.id, venueId: venueId(v.slug), type: "VIBE", vibe: OPPOSITE_VIBE[vibe], ...near(v), createdAt: at });
          reports.push({ id: nextId("r"), userId: troll.id, venueId: venueId(v.slug), type: "LINE", line: OPPOSITE_LINE[line], ...near(v), createdAt: at });
          reports.push({ id: nextId("r"), userId: troll.id, venueId: venueId(v.slug), type: "COVER", coverCents: v.history.realCoverCents >= 1000 ? 0 : 3000, ...near(v), createdAt: at });
        }
        windows++;
      }
    }
  }
  for (let i = 0; i < reports.length; i += 2000) await db.report.createMany({ data: reports.slice(i, i + 2000) });
  console.log(`[seed] ${reports.length} reports (${windows} historical hour windows)`);

  // ---------------- Presence ("here now") ----------------
  const presence: Prisma.PresenceCreateManyInput[] = [];
  const placed = new Set<string>();
  for (const v of VENUES) {
    // Fixture counts are relative crowd sizes; scale to the ~50 regulars we have (a user is in one place at a time).
    const here = v.tonight.here ? Math.max(1, Math.round(v.tonight.here * 0.35)) : 0;
    const candidates = [...new Set([...(reportersByVenue.get(v.slug) ?? []), ...rng.shuffle(regulars)])].filter((u) => !placed.has(u.id));
    for (const u of candidates.slice(0, here)) {
      placed.add(u.id);
      presence.push({ userId: u.id, venueId: venueId(v.slug), lastSeenAt: ago(rng.int(0, 40)) });
    }
  }
  // A few stale check-ins (older than 45 min) that must NOT count as here now.
  for (const u of regulars.filter((u) => !placed.has(u.id)).slice(0, 4)) {
    presence.push({ userId: u.id, venueId: venueId(rng.pick(VENUES).slug), lastSeenAt: ago(rng.int(50, 120)) });
  }
  await db.presence.createMany({ data: presence });

  // ---------------- RSVPs ("going tonight") + one from last night that must not count ----------------
  const rsvps: Prisma.RsvpCreateManyInput[] = [];
  for (const v of VENUES) {
    for (const u of rng.shuffle(regulars.slice(1)).slice(0, v.tonight.going)) {
      rsvps.push({ userId: u.id, venueId: venueId(v.slug), night: TONIGHT, createdAt: ago(rng.int(30, 600)) });
    }
  }
  rsvps.push({ userId: demo.id, venueId: venueId("copper-fox"), night: nightKey(new Date(NOW.getTime() - DAY_MS)), createdAt: ago(60 * 26) });
  await db.rsvp.createMany({ data: rsvps, skipDuplicates: true });

  // ---------------- Follows ----------------
  const follows: Prisma.FollowCreateManyInput[] = [];
  for (const u of regulars) {
    for (const f of rng.shuffle(regulars.filter((x) => x.id !== u.id)).slice(0, rng.int(4, 9))) {
      follows.push({ followerId: u.id, followeeId: f.id, createdAt: ago(rng.int(1000, 40000)) });
    }
  }
  // Demo account follows a dozen people who are out tonight, so "friends going" badges show up.
  const goingIds = [...new Set(rsvps.filter((r) => r.night === TONIGHT).map((r) => r.userId))];
  // Friends are mutual follows, so they follow back.
  for (const id of goingIds.filter((id) => id !== demo.id).slice(0, 12)) {
    follows.push({ followerId: demo.id, followeeId: id, createdAt: ago(5000) });
    follows.push({ followerId: id, followeeId: demo.id, createdAt: ago(4900) });
  }
  await db.follow.createMany({ data: follows, skipDuplicates: true });

  // ---------------- Photos ----------------
  const photos: Prisma.PhotoCreateManyInput[] = [];
  for (const v of VENUES) {
    const reporters = reportersByVenue.get(v.slug) ?? [];
    if (!reporters.length) continue;
    const live = Math.min(reporters.length, rng.int(1, 3));
    const earlier = rng.int(0, 2);
    for (let i = 0; i < live + earlier; i++) {
      const u = reporters[i % reporters.length]!;
      const key = `photos/seed-${v.slug}-${i}.png`;
      await writeImage(key);
      // live: within the last 2h40m; earlier: 3h05m to 7h ago (must land in the collapsed "Earlier" section)
      const minutes = i < live ? rng.int(3, 160) : rng.int(185, 420);
      // Live-only photos always appear on the venue page; `shared` defaults to false (fails closed), so set it.
      photos.push({ id: nextId("p"), userId: u.id, venueId: venueId(v.slug), storageKey: key, mimeType: "image/png", caption: rng.pick(CAPTIONS), ...near(v), createdAt: ago(minutes), shared: true });
    }
  }
  await db.photo.createMany({ data: photos });

  // ---------------- Comments + venue replies ----------------
  const comments: Prisma.CommentCreateManyInput[] = [];
  const ownerOf = new Map(approvedClaims.map(([u, slug]) => [slug, u]));
  for (const v of VENUES) {
    const pool = reportersByVenue.get(v.slug) ?? [];
    if (!pool.length) continue;
    const bad = v.slug === "neon-oyster" || v.slug === "velvet-anchor";
    for (let i = 0; i < Math.min(pool.length, rng.int(1, 4)); i++) {
      const id = nextId("c");
      comments.push({ id, venueId: venueId(v.slug), userId: pool[i]!.id, body: bad ? COMMENTS_BAD[i % COMMENTS_BAD.length]! : rng.pick(COMMENTS_GOOD), createdAt: ago(rng.int(5, 170)) });
      const owner = ownerOf.get(v.slug);
      if (owner && i === 0) {
        comments.push({
          id: nextId("c"), venueId: venueId(v.slug), userId: owner.id, parentId: id, isVenueReply: true, createdAt: ago(rng.int(1, 4)),
          body: v.slug === "velvet-anchor" ? "Our posted cover is $10. Please DM us if you were charged more at the door." : "Thanks for coming out! See you next weekend.",
        });
      }
    }
  }
  const trollComment = nextId("c");
  comments.push({ id: trollComment, venueId: venueId("delancey-echo"), userId: troll.id, body: "totally dead lol dont bother, $0 cover", createdAt: ago(25) });
  await db.comment.createMany({ data: comments });

  // ---------------- Flags + moderation log ----------------
  const events: Prisma.ModerationEventCreateManyInput[] = [];
  const flags: Prisma.FlagCreateManyInput[] = [];
  const flag = (targetType: "PHOTO" | "COMMENT", targetId: string, venueSlug: string, by: SeedUser, reason: string, minutesAgo: number) => {
    flags.push({ id: nextId("f"), targetType, targetId, venueId: venueId(venueSlug), flaggerId: by.id, reason, createdAt: ago(minutesAgo) });
    events.push({ id: nextId("me"), action: "FLAGGED", targetType, targetId, actorId: by.id, note: reason, createdAt: ago(minutesAgo) });
  };
  // Photo with 2 flags: in the queue, still visible.
  const lanternPhoto = photos.find((p) => p.venueId === venueId("lantern-and-lark"))!;
  flag("PHOTO", lanternPhoto.id!, "lantern-and-lark", regulars[5]!, "Not taken here, this is a different bar", 40);
  flag("PHOTO", lanternPhoto.id!, "lantern-and-lark", regulars[9]!, "Looks like an old photo", 30);
  // Photo with 3 distinct flags: auto-hidden pending review.
  const delanceyPhoto = photos.find((p) => p.venueId === venueId("delancey-echo"))!;
  delanceyPhoto.hiddenAt = ago(10);
  for (const [i, u] of [regulars[3]!, regulars[7]!, regulars[11]!].entries()) flag("PHOTO", delanceyPhoto.id!, "delancey-echo", u, "Inappropriate", 20 - i * 3);
  events.push({ id: nextId("me"), action: "AUTO_HIDE", targetType: "PHOTO", targetId: delanceyPhoto.id!, actorId: null, note: "3 distinct user flags", createdAt: ago(10) });
  await db.photo.update({ where: { id: delanceyPhoto.id! }, data: { hiddenAt: delanceyPhoto.hiddenAt } });
  // Venue owner flags a user comment they dispute: goes to the queue, NOT hidden.
  const velvetComplaint = comments.find((c) => c.venueId === venueId("velvet-anchor") && !c.isVenueReply)!;
  flag("COMMENT", velvetComplaint.id!, "velvet-anchor", ownerVelvet, "False: our cover is $10", 15);
  // Users flag the troll comment.
  flag("COMMENT", trollComment, "delancey-echo", regulars[2]!, "Obviously false, it's packed", 12);
  await db.flag.createMany({ data: flags });
  await db.moderationEvent.createMany({ data: events });

  // ---------------- Reputation (same code path as the scheduled job) ----------------
  // A few passes: each pass weights peers by the previous pass's reputations (fixed-point iteration).
  for (let pass = 1; pass <= 3; pass++) {
    const rep = await recomputeAllReputations(db, NOW);
    console.log(`[seed] reputation pass ${pass}: judged ${rep.judged} reports, updated ${rep.updated} users`);
  }
  // ---------------- Social layer (after reputations: featuring reads them) ----------------
  await seedSocial({ db, storage, now: NOW, venues: VENUES, venueId, regulars, demo, admin, mod });

  const trollRep = await db.user.findUniqueOrThrow({ where: { id: troll.id }, select: { reputation: true } });
  console.log(`[seed] troll @${troll.handle} reputation ${trollRep.reputation.toFixed(2)}`);
  console.log(`[seed] done. ${VENUES.length} venues, ${photos.length} photos, ${comments.length} comments, ${flags.length} flags`);
  console.log(`[seed] sign in at /dev/login (password: ${process.env.DEV_SEED_PASSWORD ?? "lastcall-dev"}); try @${demo.handle}, @${ownerVelvet.handle}, @${mod.handle}`);
}

async function writeImage(key: string) {
  await storage.put(key, placeholderPng(rng), "image/png");
}

// Keep the fixture type referenced so edits to seed-data stay type-checked here.
export type { VenueFixture };

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
