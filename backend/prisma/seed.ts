/**
 * Deterministic seed: `pnpm db:seed` (or `pnpm db:reset`, which runs it after migrating).
 *
 * Determinism: all content comes from a fixed-seed PRNG, ids are assigned explicitly and every timestamp is derived
 * from an anchor time (SEED_NOW, or the current minute), so the data is "recent" whenever you run it. With a pinned
 * SEED_NOW every row is identical across runs; the only difference is the random salt inside the shared dev password hash.
 *
 * What it makes: public and private accounts, pending follow requests, follows, stamps (photo + caption + song, photo
 * only, caption only, song only) at several places, likes, one verified account, one blocked pair, one hidden stamp, one
 * open report for the moderation queue, and an App Review stamp that only that account can see.
 */
import { pathToFileURL } from "node:url";
import { PrismaClient, type Prisma } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { mulberry32 } from "../src/lib/rng";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "../src/lib/time";
import { storageFromEnv, type BlobStorage } from "../src/lib/storage";
import { CURRENT_TERMS_VERSION } from "../src/server/services/auth";
import { assignNeighborhoods, importNeighborhoods } from "../src/server/services/neighborhoods";
import { placeholderPng } from "./placeholder-image";
import { assertSeedAllowed } from "./seed-guard";
import { CAPTIONS, PEOPLE, PLACES, SONGS } from "./seed-data";

const TABLES = ["rate_event", "verification_event", "photo_like", "follow_request", "block", "login_attempt", "moderation_event", "flag", "follow", "pinned_stamp", "stamp_photo", "photo", "venue", "session", "app_user"];

export type SeedOptions = { now?: Date; storage?: BlobStorage; env?: Record<string, string | undefined> };
export type SeedSummary = { places: number; people: number; stamps: number; likes: number; follows: number; requests: number };

const uid = (handle: string) => `seed_u_${handle}`;

export async function seed(db: PrismaClient, opts: SeedOptions = {}): Promise<SeedSummary> {
  const env = opts.env ?? process.env;
  assertSeedAllowed(env);
  const NOW = opts.now ?? (env.SEED_NOW ? new Date(env.SEED_NOW) : new Date(Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS));
  const ago = (ms: number) => new Date(NOW.getTime() - ms);
  const rng = mulberry32(20261002);
  const storage = opts.storage ?? storageFromEnv(env as Record<string, string | undefined>);

  await db.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await db.venue.createMany({ data: PLACES.map((p, i) => ({ id: `seed_v_${String(i + 1).padStart(3, "0")}`, ...p })) });
  // Neighborhoods are reference data: load them, then file every place under the one that contains it.
  await importNeighborhoods(db);
  await assignNeighborhoods(db);
  const places = await db.venue.findMany({ orderBy: { id: "asc" } });

  // ---------------- People ----------------
  const password = env.DEV_SEED_PASSWORD ?? "lastcall-dev";
  const hash = await hashPassword(password);
  const reviewHash = env.APP_REVIEW_PASSWORD ? await hashPassword(env.APP_REVIEW_PASSWORD) : hash;
  await db.user.createMany({
    data: PEOPLE.map((p) => ({
      id: uid(p.handle), email: `${p.handle}@lastcall.dev`, handle: p.handle, displayName: p.name, passwordHash: p.handle === "appreview" ? reviewHash : hash,
      role: p.role ?? "USER", isPrivate: p.isPrivate, bio: p.bio ?? "", geofenceExempt: p.exempt ?? false,
      createdAt: ago(p.ageDays * DAY_MS), termsAcceptedAt: ago(p.ageDays * DAY_MS), termsVersion: CURRENT_TERMS_VERSION,
    })),
  });
  // The verified badge is only ever set with a log entry in the same transaction (a database trigger insists).
  for (const p of PEOPLE.filter((x) => x.verified)) {
    await db.$transaction(async (tx) => {
      await tx.verificationEvent.create({ data: { userId: uid(p.handle), action: "GRANT", note: "Seeded demo account", createdAt: ago(30 * DAY_MS) } });
      await tx.user.update({ where: { id: uid(p.handle) }, data: { verifiedAt: ago(30 * DAY_MS) } });
    });
  }

  // ---------------- Follows, requests, one block ----------------
  const follows: [string, string][] = [
    ["maya_r", "avaa"], ["theo_k", "avaa"], ["kofi_b", "avaa"], ["avaa", "maya_r"], ["avaa", "theo_k"], ["avaa", "nia_s"],
    ["theo_k", "maya_r"], ["theo_k", "nia_s"], ["nia_s", "maya_r"], ["nia_s", "sol_m"], ["sol_m", "maya_r"], ["kofi_b", "maya_r"],
    ["kofi_b", "theo_k"], ["pia_l", "maya_r"], ["pia_l", "nia_s"], ["jules_v", "maya_r"], ["omar_q", "nia_s"], ["maya_r", "theo_k"],
    ["maya_r", "nia_s"], ["appreview", "maya_r"], ["blocked_bea", "maya_r"], ["maya_r", "kofi_b"],
  ];
  await db.follow.createMany({ data: follows.map(([a, b], i) => ({ followerId: uid(a), followeeId: uid(b), createdAt: ago((60 - i) * HOUR_MS) })) });
  // Pending requests to private accounts: avaa has four waiting. A pending request grants nothing.
  const requests: [string, string][] = [["rowan_k", "avaa"], ["jules_v", "avaa"], ["ines_p", "avaa"], ["omar_q", "avaa"], ["moth_hopeful", "kofi_b"], ["theo_k", "pia_l"]];
  await db.followRequest.createMany({ data: requests.map(([a, b], i) => ({ requesterId: uid(a), targetId: uid(b), createdAt: ago((8 - i) * HOUR_MS) })) });
  // One blocked pair: Blake blocked Bea (and any follows between them were removed).
  await db.block.create({ data: { blockerId: uid("blocker_blake"), blockedId: uid("blocked_bea"), createdAt: ago(5 * DAY_MS) } });

  // ---------------- Stamps ----------------
  const visitors = PEOPLE.filter((p) => !["admin", "mod_morgan", "moth_hopeful"].includes(p.handle));
  const stampIds: { id: string; userId: string; hidden: boolean; countable: boolean }[] = [];
  const near = (p: { lat: number; lng: number; geofenceMeters: number }) => ({ lat: p.lat + (rng.next() - 0.5) * 0.0005, lng: p.lng + (rng.next() - 0.5) * 0.0006 });
  let n = 0;
  for (const person of visitors) {
    const count = person.handle === "maya_r" ? 14 : person.handle === "appreview" ? 2 : rng.int(3, 8);
    const favorites = rng.shuffle(places).slice(0, rng.int(3, 6));
    for (let i = 0; i < count; i++) {
      const place = rng.chance(0.75) ? rng.pick(favorites) : rng.pick(places);
      // Spread over ~60 days with the most recent ones within the last day, so the feed has fresh stamps.
      const age = i < 2 ? rng.int(10, 20 * 60) * MINUTE_MS : rng.int(1, 60) * DAY_MS + rng.int(0, 23) * HOUR_MS;
      const kind = rng.weighted({ all: 3, photo: 3, caption: 2, song: 1, photoCaption: 3 });
      const hasPhoto = kind === "all" || kind === "photo" || kind === "photoCaption";
      const hasCaption = kind === "all" || kind === "caption" || kind === "photoCaption";
      const hasSong = kind === "all" || kind === "song";
      const id = `seed_s_${String(++n).padStart(4, "0")}`;
      const song = hasSong ? rng.pick(SONGS) : null;
      // 1 to 4 photos on a photo stamp; the first is the stamp's cover. Some get a scrapbook layout.
      const keys: string[] = [];
      if (hasPhoto) {
        const count = rng.weighted({ "1": 5, "2": 3, "3": 2, "4": 1 });
        for (let k = 0; k < Number(count); k++) {
          const key = `photos/seed${String(n).padStart(4, "0")}${k === 0 ? "" : `_${k}`}.png`;
          await storage.put(key, placeholderPng(rng), "image/png");
          keys.push(key);
        }
      }
      const exempt = person.exempt === true;
      const where = exempt ? { lat: place.lat + 0.02, lng: place.lng } : near(place);
      await db.photo.create({
        data: {
          id, userId: uid(person.handle), venueId: place.id, storageKey: keys[0] ?? null, mimeType: keys[0] ? "image/png" : null,
          caption: hasCaption ? rng.pick(CAPTIONS) : "", songTitle: song?.title ?? null, songArtist: song?.artist ?? null,
          lat: where.lat, lng: where.lng, createdAt: ago(age), countable: !exempt,
        },
      });
      for (const [k, key] of keys.entries()) {
        const laid = rng.chance(0.5);
        await db.stampPhoto.create({
          data: {
            stampId: id, storageKey: key, mimeType: "image/png", position: k, createdAt: ago(age),
            ...(laid ? { x: Math.round(rng.next() * 80) / 100 + 0.1, y: Math.round(rng.next() * 80) / 100 + 0.1, rotation: Math.round((rng.next() - 0.5) * 20) } : {}),
          },
        });
      }
      stampIds.push({ id, userId: uid(person.handle), hidden: false, countable: !exempt });
    }
  }

  // One stamp hidden by a moderator, one the author removed ("delete from profile"), and one open report in the queue.
  const target = stampIds.find((s) => s.userId === uid("theo_k") && s.countable)!;
  const hiddenAt = ago(2 * DAY_MS);
  await db.photo.update({ where: { id: target.id }, data: { hiddenAt } });
  await db.moderationEvent.createMany({
    data: [
      { action: "FLAGGED", targetType: "PHOTO", targetId: target.id, actorId: uid("nia_s"), note: "Not at this place", createdAt: ago(3 * DAY_MS) },
      { action: "HIDE", targetType: "PHOTO", targetId: target.id, actorId: uid("mod_morgan"), note: "Seeded example of a hidden stamp", createdAt: hiddenAt },
    ],
  });
  await db.flag.create({ data: { targetType: "PHOTO", targetId: target.id, flaggerId: uid("nia_s"), reason: "Not at this place", category: "NOT_AT_PLACE", status: "RESOLVED", createdAt: ago(3 * DAY_MS), venueId: null } });
  stampIds.find((s) => s.id === target.id)!.hidden = true;
  const removable = stampIds.find((s) => s.userId === uid("sol_m") && s.countable)!;
  await db.photo.update({ where: { id: removable.id }, data: { removedAt: ago(DAY_MS) } });
  stampIds.find((s) => s.id === removable.id)!.hidden = true;
  const reported = stampIds.find((s) => s.userId === uid("maya_r") && s.countable && !s.hidden)!;
  await db.flag.create({ data: { targetType: "PHOTO", targetId: reported.id, flaggerId: uid("jules_v"), reason: "Not at this place", category: "NOT_AT_PLACE", createdAt: ago(3 * HOUR_MS) } });
  await db.moderationEvent.create({ data: { action: "FLAGGED", targetType: "PHOTO", targetId: reported.id, actorId: uid("jules_v"), note: "Not at this place", createdAt: ago(3 * HOUR_MS) } });

  // ---------------- Likes ----------------
  // Never your own, never on hidden, removed or App Review stamps (the database refuses those). App Review doesn't like.
  const likers = visitors.filter((p) => !p.exempt && p.handle !== "blocked_bea");
  const likeRows = new Map<string, Prisma.PhotoLikeUncheckedCreateInput>();
  for (const s of stampIds.filter((x) => !x.hidden && x.countable)) {
    for (const liker of likers) {
      if (uid(liker.handle) === s.userId || !rng.chance(0.25)) continue;
      likeRows.set(`${liker.handle}:${s.id}`, { userId: uid(liker.handle), photoId: s.id, createdAt: ago(rng.int(1, 40) * HOUR_MS), countable: true });
    }
  }
  // Bea and Blake never like each other's stamps (they are a blocked pair).
  for (const [k, row] of [...likeRows]) {
    const a = row.userId, b = stampIds.find((s) => s.id === row.photoId)!.userId;
    if ((a === uid("blocked_bea") && b === uid("blocker_blake")) || (a === uid("blocker_blake") && b === uid("blocked_bea"))) likeRows.delete(k);
  }
  await db.photoLike.createMany({ data: [...likeRows.values()] });

  return { places: places.length, people: PEOPLE.length, stamps: stampIds.length, likes: likeRows.size, follows: follows.length, requests: requests.length };
}

async function main() {
  const db = new PrismaClient();
  try {
    const s = await seed(db);
    console.log(`[seed] ${s.places} places, ${s.people} people, ${s.stamps} stamps, ${s.likes} likes, ${s.follows} follows, ${s.requests} pending requests`);
    console.log(`[seed] sign in at /dev/login (password: ${process.env.DEV_SEED_PASSWORD ?? "lastcall-dev"}); try @avaa (private, 4 requests waiting), @maya_r (public, verified), @moth_hopeful (follows no one), @mod_morgan, @admin`);
  } finally {
    await db.$disconnect();
  }
}

// Run only as a script (`tsx prisma/seed.ts`), not when the tests import `seed`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
