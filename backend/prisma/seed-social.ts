/**
 * The social layer's demo data, called by seed.ts after reputations are computed (featuring reads them).
 *
 * Deterministic: its own fixed-seed PRNG (so the rest of the seed is unchanged), explicit ids, and every time derived
 * from the anchor. Featured galleries come from the real nightly job (`runFeaturing`), run once per past week, so they
 * follow exactly the production rules (eligible likes, top 20 stored, 3-like minimum).
 *
 * The mix: public and private accounts with bios and some profile photos; pending follow requests (four waiting on
 * the demo account, which is private); rated posts at many venues since the start of the month two months back; a few
 * Regulars (3+ nights at one venue in 60); likes; featured photos for the two past months and this one; verified
 * accounts (log entry then badge, in one transaction); a private author whose shared photo reads "Anonymous" to
 * people who don't follow them; one removed post; one featured photo hidden by a moderator (the next one moves up).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import type { BlobStorage } from "../src/lib/storage";
import { mulberry32 } from "../src/lib/rng";
import { runFeaturing } from "../src/server/services/featuring";
import { addNights, HOUR_MS, localParts, MINUTE_MS, nightBounds, nightKey, zonedTimeToUtc } from "../src/lib/time";
import { placeholderPng } from "./placeholder-image";
import type { VenueFixture } from "./seed-data";

type SeedUser = { id: string; handle: string; createdAt?: Date | string | null };

export type SocialContext = {
  db: PrismaClient;
  storage: BlobStorage;
  now: Date;
  venues: readonly VenueFixture[];
  venueId: (slug: string) => string;
  regulars: SeedUser[];
  demo: SeedUser;
  admin: SeedUser;
  mod: SeedUser;
};

const BIOS = [
  "Mostly on Avenue A. Here for the jukebox.",
  "Bartender by day, regular by night.",
  "Rating every negroni in the East Village.",
  "LES after midnight.",
  "If there's a patio, I'm on it.",
  "Dance floor first, questions later.",
];
const POST_CAPTIONS = [
  "Best negroni on the block",
  "Packed but worth it",
  "The DJ went off tonight",
  "Quiet corner, great drinks",
  "Back patio is open",
  "Line moved fast",
  "Live band until 1",
  "",
  "",
];

let n = 0;
// Its own id prefix, so these never collide with seed.ts's counter.
const id = (prefix: string) => `seed_s_${prefix}_${String(++n).padStart(6, "0")}`;

export async function seedSocial(ctx: SocialContext) {
  const { db, storage, now, venues, venueId, regulars, demo, admin, mod } = ctx;
  const r = mulberry32(20260927);
  const at = (u: SeedUser) => new Date(u.createdAt ?? 0).getTime();
  const tonight = nightKey(now);
  // Start of the month two months back ("July" when it's September), in New York.
  const p = localParts(now);
  const startMonth = p.month - 2 <= 0 ? p.month + 10 : p.month - 2;
  const startYear = p.month - 2 <= 0 ? p.year - 1 : p.year;
  const firstNight = `${startYear}-${String(startMonth).padStart(2, "0")}-01`;
  const tonightStart = nightBounds(tonight).start.getTime();
  /** Tonight's posts: a few minutes to hours ago, but never before tonight started (5am). */
  const earlierTonight = (minutes: number) => new Date(Math.min(now.getTime(), Math.max(now.getTime() - minutes * MINUTE_MS, tonightStart + MINUTE_MS)));

  // The demo account has posts, a Regular badge and a featured photo going back months: it must be older than they are.
  const demoCreated = new Date(now.getTime() - 150 * 24 * HOUR_MS);
  await db.user.update({ where: { id: demo.id }, data: { createdAt: demoCreated, termsAcceptedAt: demoCreated } });
  demo.createdAt = demoCreated;

  // ---------------- Profiles: public / private, bios, photos ----------------
  // About 40% public. The demo account stays private (it has requests waiting); regulars[4] is the private author
  // whose shared photo shows as Anonymous.
  const anon = regulars[4]!;
  const isPublic = (u: SeedUser, i: number) => u.id !== demo.id && u.id !== anon.id && (i % 5 === 1 || i % 5 === 3);
  for (const [i, u] of regulars.entries()) {
    const data: Prisma.UserUpdateInput = { isPrivate: !isPublic(u, i) };
    if (i % 3 === 0) data.bio = BIOS[i % BIOS.length]!;
    if (i % 4 === 1 || u.id === demo.id) {
      const key = `avatars/seed-${u.handle}.png`;
      await storage.put(key, placeholderPng(r, 240, 240), "image/png");
      data.avatarKey = key;
    }
    await db.user.update({ where: { id: u.id }, data });
  }
  const publicIds = new Set(regulars.filter((u, i) => isPublic(u, i)).map((u) => u.id));

  // ---------------- Verified (the log entry first; the database refuses a badge without one) ----------------
  const verified = [regulars[1]!, regulars[6]!, regulars[13]!];
  for (const u of verified) {
    const when = new Date(now.getTime() - r.int(10, 60) * 24 * HOUR_MS);
    await db.$transaction(async (tx) => {
      await tx.verificationEvent.create({ data: { id: id("ve"), userId: u.id, action: "GRANT", note: "Local nightlife writer (seed)", actorId: admin.id, createdAt: when } });
      await tx.user.update({ where: { id: u.id }, data: { verifiedAt: when } });
    });
  }

  // ---------------- Pending follow requests ----------------
  // One explicit follower of the private author, so "@handle to followers, Anonymous to others" doesn't depend on
  // seed.ts's random follows.
  const fan = regulars[2]!;
  await db.follow.createMany({ data: [{ followerId: fan.id, followeeId: anon.id, createdAt: new Date(now.getTime() - 20 * 24 * HOUR_MS) }], skipDuplicates: true });
  const follows = await db.follow.findMany({ select: { followerId: true, followeeId: true } });
  const following = new Set(follows.map((f) => `${f.followerId}>${f.followeeId}`));
  const requests: Prisma.FollowRequestCreateManyInput[] = [];
  const request = (from: SeedUser, to: SeedUser, minutesAgo: number) => {
    const key = `${from.id}>${to.id}`;
    if (from.id === to.id || following.has(key) || requests.some((q) => q.requesterId === from.id && q.targetId === to.id)) return false;
    // Never before either account existed.
    const when = Math.max(now.getTime() - minutesAgo * MINUTE_MS, at(from) + HOUR_MS, at(to) + HOUR_MS);
    if (when > now.getTime()) return false;
    requests.push({ requesterId: from.id, targetId: to.id, createdAt: new Date(when) });
    return true;
  };
  // Four on the demo account: going public offers "Approve 4 pending requests?".
  let onDemo = 0;
  for (const u of r.shuffle(regulars)) if (onDemo < 4 && request(u, demo, r.int(30, 60 * 72))) onDemo++;
  // A handful elsewhere, to private accounts only (following a public account is instant).
  const privates = regulars.filter((u) => !publicIds.has(u.id) && u.id !== demo.id);
  for (let i = 0; i < 12; i++) request(r.pick(regulars), r.pick(privates), r.int(60, 60 * 24 * 10));
  await db.followRequest.createMany({ data: requests });

  // ---------------- Posts ----------------
  const posters = regulars.filter((u) => now.getTime() - at(u) > 14 * 24 * HOUR_MS);
  const photos: (Prisma.PhotoCreateManyInput & { id: string; userId: string; createdAt: Date; shared: boolean })[] = [];
  const nightTime = (night: string, minutesAfter10pm: number) => {
    const [y, m, d] = night.split("-").map(Number) as [number, number, number];
    return new Date(zonedTimeToUtc(y, m, d, 22).getTime() + minutesAfter10pm * MINUTE_MS);
  };
  const venue = (slug: string) => venues.find((v) => v.slug === slug)!;
  const near = (v: VenueFixture) => ({ lat: v.lat + (r.next() - 0.5) * 0.0006, lng: v.lng + (r.next() - 0.5) * 0.0007 });
  const post = async (u: SeedUser, slug: string, createdAt: Date, opts: { shared?: boolean; rating?: number; removed?: boolean } = {}) => {
    const v = venue(slug);
    const pid = id("sp");
    const key = `photos/seed-post-${pid}.png`;
    await storage.put(key, placeholderPng(r), "image/png");
    const shared = opts.shared ?? (publicIds.has(u.id) ? r.chance(0.9) : r.chance(0.25));
    const row = {
      id: pid, userId: u.id, venueId: venueId(slug), storageKey: key, mimeType: "image/png", caption: r.pick(POST_CAPTIONS), ...near(v),
      createdAt, rating: opts.rating ?? Number(r.weighted({ "6": 1, "7": 3, "8": 4, "9": 3, "10": 1 })), shared,
      removedAt: opts.removed ? new Date(createdAt.getTime() + HOUR_MS) : null,
    };
    photos.push(row);
    return row;
  };

  // Everyday posting: about one venue-night in eight has posts.
  for (let night = firstNight; night < tonight; night = addNights(night, 1)) {
    for (const v of venues) {
      if (!r.chance(0.12)) continue;
      const existing = posters.filter((u) => at(u) < nightTime(night, 0).getTime());
      for (const u of r.shuffle(existing).slice(0, r.int(1, 4))) await post(u, v.slug, nightTime(night, r.int(0, 200)));
    }
  }
  // Regulars: four long-standing accounts and the demo account, each with 3-4 separate nights at one venue in the last 50.
  const veterans = regulars.filter((u) => u.id !== demo.id && u.id !== anon.id && now.getTime() - at(u) > 90 * 24 * HOUR_MS);
  const regularPlan: [SeedUser, string][] = [
    [veterans[0]!, "lantern-and-lark"], [veterans[1]!, "velvet-anchor"], [veterans[2]!, "copper-fox"],
    [veterans[3]!, "delancey-echo"], [demo, "lantern-and-lark"],
  ];
  for (const [u, slug] of regularPlan) {
    const nights = r.shuffle(Array.from({ length: 45 }, (_, i) => addNights(tonight, -(i + 2)))).slice(0, r.int(3, 4));
    for (const night of nights) await post(u, slug, nightTime(night, r.int(0, 150)), { shared: publicIds.has(u.id) || u.id === demo.id ? true : undefined });
  }
  // The demo account's featured photo: a shared post early last month with plenty of likes.
  const lastMonthNight = `${p.month === 1 ? p.year - 1 : p.year}-${String(p.month === 1 ? 12 : p.month - 1).padStart(2, "0")}-08`;
  const demoStar = await post(demo, "copper-fox", nightTime(lastMonthNight, 60), { shared: true, rating: 9 });
  // And a recent one (within Activity's 30 days and the job's 7-night catch-up), so Activity shows likes and "featured".
  const demoRecent = await post(demo, "half-moon-hifi", nightTime(addNights(tonight, -3), 90), { shared: true, rating: 8 });
  const boosted = new Map([[demoStar.id, 12], [demoRecent.id, 7]]);
  // One post the demo account removed from its profile (hidden for good).
  await post(demo, "saint-marigold", nightTime(addNights(tonight, -9), 30), { shared: false, rating: 6, removed: true });
  // Tonight: rated posts in the live feed, including the private author's shared one (Anonymous to non-followers).
  const anonTonight = await post(anon, "velvet-anchor", earlierTonight(35), { shared: true, rating: 8 });
  for (const slug of ["velvet-anchor", "lantern-and-lark", "delancey-echo", "rivington-riot", "neon-oyster", "copper-fox"]) {
    for (const u of r.shuffle(posters).slice(0, r.int(1, 2))) await post(u, slug, earlierTonight(r.int(10, 160)));
  }
  for (let i = 0; i < photos.length; i += 500) await db.photo.createMany({ data: photos.slice(i, i + 500) });

  // ---------------- Likes ----------------
  // Likers existed before they liked; about half the posts get a few, a fifth get enough to be featured.
  const reps = new Map((await db.user.findMany({ select: { id: true, reputation: true } })).map((u) => [u.id, u.reputation]));
  const likes: Prisma.PhotoLikeCreateManyInput[] = [];
  for (const ph of photos) {
    if (!ph.shared || ph.removedAt) continue;
    const count = boosted.get(ph.id) ?? (r.chance(0.2) ? r.int(3, 11) : r.chance(0.5) ? r.int(1, 3) : 0);
    const latest = Math.min(now.getTime(), ph.createdAt.getTime() + 3 * HOUR_MS);
    const pool = regulars.filter((u) => u.id !== ph.userId && at(u) < ph.createdAt.getTime() && (!boosted.has(ph.id) || (reps.get(u.id) ?? 0) >= 0.5));
    for (const u of r.shuffle(pool).slice(0, count)) {
      likes.push({ userId: u.id, photoId: ph.id, createdAt: new Date(ph.createdAt.getTime() + r.int(1, Math.max(1, Math.floor((latest - ph.createdAt.getTime()) / MINUTE_MS))) * MINUTE_MS) });
    }
  }
  for (let i = 0; i < likes.length; i += 2000) await db.photoLike.createMany({ data: likes.slice(i, i + 2000) });

  // ---------------- Featuring: the real job, once per past week, then as of now ----------------
  let featured = 0;
  for (let night = addNights(firstNight, 6); night < tonight; night = addNights(night, 7)) {
    // As if run at 5:15am after that week's last night, but never later than the anchor.
    const runAt = new Date(Math.min(nightBounds(night).end.getTime() + 10 * MINUTE_MS, now.getTime()));
    featured += (await runFeaturing(db, runAt)).featured;
  }
  featured += (await runFeaturing(db, now)).featured;

  // A moderator hides last month's top photo at one venue: the next-ranked visible photo takes its place.
  const top = await db.featuredPhoto.findFirst({
    where: { rank: 1, photoId: { not: demoStar.id }, night: { startsWith: lastMonthNight.slice(0, 7) } },
    orderBy: [{ night: "asc" }, { venueId: "asc" }],
  });
  if (top) {
    const hiddenAt = new Date(now.getTime() - 2 * 24 * HOUR_MS);
    await db.photo.update({ where: { id: top.photoId }, data: { hiddenAt } });
    await db.moderationEvent.create({ data: { id: id("me"), action: "HIDE", targetType: "PHOTO", targetId: top.photoId, actorId: mod.id, note: "Not taken at this venue (seed)", createdAt: hiddenAt } });
  }

  const regularHandles = regularPlan.map(([u, slug]) => `@${u.handle} at ${slug}`).join(", ");
  console.log(`[seed] social: ${publicIds.size} public accounts, ${requests.length} pending requests (${onDemo} on @${demo.handle}), ${photos.length} posts, ${likes.length} likes, ${featured} featured`);
  console.log(`[seed] social: verified ${verified.map((u) => `@${u.handle}`).join(", ")}; Regulars ${regularHandles}`);
  console.log(`[seed] social: @${anon.handle} is private; their shared photo at velvet-anchor (${anonTonight.id}) reads "Anonymous" to non-followers (@${fan.handle} follows them and sees the handle)`);
}
