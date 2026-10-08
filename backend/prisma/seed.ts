import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { mulberry32 } from "../src/lib/rng";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "../src/lib/time";
import { storageFromEnv, type BlobStorage } from "../src/lib/storage";
import { CURRENT_TERMS_VERSION } from "../src/server/services/auth";
import { assignNeighborhoods, importNeighborhoods } from "../src/server/services/neighborhoods";
import { placeholderPng } from "./placeholder-image";
import { assertSeedAllowed } from "./seed-guard";
import { CAPTIONS, PEOPLE, PLACES, SONGS } from "./seed-data";

const TABLES = [
  "rate_event",
  "login_attempt",
  "pinned_stamp",
  "neighborhood_completion",
  "stamp_photo",
  "photo",
  "venue",
  "session",
  "email_challenge",
  "app_user",
  "neighborhood",
];

export type SeedOptions = { now?: Date; storage?: BlobStorage; env?: Record<string, string | undefined> };
export type SeedSummary = { places: number; people: number; stamps: number };

const uid = (handle: string) => `seed_u_${handle}`;

export async function seed(db: PrismaClient, opts: SeedOptions = {}): Promise<SeedSummary> {
  const env = opts.env ?? process.env;
  assertSeedAllowed(env);
  const now = opts.now ?? (env.SEED_NOW ? new Date(env.SEED_NOW) : new Date(Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS));
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const rng = mulberry32(20261002);
  const storage = opts.storage ?? storageFromEnv(env as Record<string, string | undefined>);

  await db.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await importNeighborhoods(db);
  await db.venue.createMany({ data: PLACES.map((p, i) => ({ id: `seed_v_${String(i + 1).padStart(3, "0")}`, ...p })) });
  await assignNeighborhoods(db);
  const places = await db.venue.findMany({ orderBy: { id: "asc" } });

  const password = env.DEV_SEED_PASSWORD ?? "lastcall-dev";
  const hash = await hashPassword(password);
  const reviewHash = env.APP_REVIEW_PASSWORD ? await hashPassword(env.APP_REVIEW_PASSWORD) : hash;
  await db.user.createMany({
    data: PEOPLE.map((p) => ({
      id: uid(p.handle),
      email: `${p.handle}@lastcall.dev`,
      handle: p.handle,
      displayName: p.name,
      passwordHash: p.handle === "appreview" ? reviewHash : hash,
      emailVerifiedAt: ago(p.ageDays * DAY_MS),
      ageVerifiedAt: ago(p.ageDays * DAY_MS),
      bio: p.bio ?? "",
      geofenceExempt: p.exempt ?? false,
      createdAt: ago(p.ageDays * DAY_MS),
      termsAcceptedAt: ago(p.ageDays * DAY_MS),
      termsVersion: CURRENT_TERMS_VERSION,
    })),
  });

  let stampCount = 0;
  const created: { id: string; userId: string; countable: boolean }[] = [];
  const near = (p: { lat: number; lng: number }) => ({ lat: p.lat + (rng.next() - 0.5) * 0.0005, lng: p.lng + (rng.next() - 0.5) * 0.0006 });

  for (const person of PEOPLE) {
    const count = person.handle === "appreview" ? 2 : rng.int(3, 7);
    const favorites = rng.shuffle(places).slice(0, rng.int(3, 6));
    for (let i = 0; i < count; i++) {
      const place = rng.chance(0.75) ? rng.pick(favorites) : rng.pick(places);
      const age = i < 2 ? rng.int(10, 20 * 60) * MINUTE_MS : rng.int(1, 60) * DAY_MS + rng.int(0, 23) * HOUR_MS;
      const kind = rng.weighted({ all: 3, photo: 3, caption: 2, song: 1, photoCaption: 3 });
      const hasPhoto = kind === "all" || kind === "photo" || kind === "photoCaption";
      const hasCaption = kind === "all" || kind === "caption" || kind === "photoCaption";
      const hasSong = kind === "all" || kind === "song";
      const id = `seed_s_${String(++stampCount).padStart(4, "0")}`;
      const song = hasSong ? rng.pick(SONGS) : null;
      const keys: string[] = [];
      if (hasPhoto) {
        const photos = Number(rng.weighted({ "1": 5, "2": 3, "3": 2, "4": 1 }));
        for (let k = 0; k < photos; k++) {
          const key = `photos/seed${String(stampCount).padStart(4, "0")}${k === 0 ? "" : `_${k}`}.png`;
          await storage.put(key, placeholderPng(rng), "image/png");
          keys.push(key);
        }
      }
      const exempt = person.exempt === true;
      const pos = exempt ? { lat: place.lat + 0.02, lng: place.lng } : near(place);
      const createdAt = ago(age);
      await db.$transaction(async (tx) => {
        await tx.photo.create({
          data: {
            id,
            userId: uid(person.handle),
            venueId: place.id,
            storageKey: keys[0] ?? null,
            mimeType: keys[0] ? "image/png" : null,
            caption: hasCaption ? rng.pick(CAPTIONS) : "",
            songTitle: song?.title ?? null,
            songArtist: song?.artist ?? null,
            lat: pos.lat,
            lng: pos.lng,
            createdAt,
            countable: !exempt,
          },
        });
        for (const [position, key] of keys.entries()) {
          const laid = rng.chance(0.5);
          await tx.stampPhoto.create({
            data: {
              stampId: id,
              storageKey: key,
              mimeType: "image/png",
              position,
              createdAt,
              ...(laid ? { x: Math.round(rng.next() * 80) / 100 + 0.1, y: Math.round(rng.next() * 80) / 100 + 0.1, rotation: Math.round((rng.next() - 0.5) * 20) } : {}),
            },
          });
        }
      });
      created.push({ id, userId: uid(person.handle), countable: !exempt });
    }
  }

  const removable = created.find((stamp) => stamp.userId === uid("sol_m") && stamp.countable);
  if (removable) await db.photo.update({ where: { id: removable.id }, data: { removedAt: ago(DAY_MS) } });

  return { places: places.length, people: PEOPLE.length, stamps: created.length };
}

async function main() {
  const db = new PrismaClient();
  try {
    const summary = await seed(db);
    console.log(`[seed] ${summary.places} places, ${summary.people} people, ${summary.stamps} stamps`);
    console.log(`[seed] sign in at /dev/login with ${process.env.DEV_SEED_PASSWORD ?? "lastcall-dev"}; @appreview is geofence-exempt`);
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
