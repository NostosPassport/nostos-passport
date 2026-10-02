/**
 * Deterministic seed: `pnpm db:seed` (or `pnpm db:reset`, which runs it after migrating).
 * Wipes every table and inserts places plus the staff and App Review accounts. The full demo data (people, stamps,
 * likes, follows) is added in phase 6.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { CURRENT_TERMS_VERSION } from "../src/server/services/auth";
import { assertSeedAllowed } from "./seed-guard";
import { PLACES } from "./seed-data";

const db = new PrismaClient();

async function truncateAll() {
  const tables = ["rate_event", "verification_event", "photo_like", "follow_request", "block", "login_attempt", "moderation_event", "flag", "follow", "photo", "venue", "session", "app_user"];
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

async function main() {
  assertSeedAllowed(process.env);
  await truncateAll();
  await db.venue.createMany({ data: PLACES.map((p) => ({ ...p })) });
  const passwordHash = await hashPassword(process.env.DEV_SEED_PASSWORD ?? "lastcall-dev");
  const reviewHash = process.env.APP_REVIEW_PASSWORD ? await hashPassword(process.env.APP_REVIEW_PASSWORD) : passwordHash;
  const accounts = [
    { handle: "admin", role: "ADMIN" as const, hash: passwordHash, exempt: false },
    { handle: "mod_morgan", role: "MODERATOR" as const, hash: passwordHash, exempt: false },
    { handle: "appreview", role: "USER" as const, hash: reviewHash, exempt: true },
  ];
  for (const a of accounts) {
    await db.user.create({
      data: {
        email: `${a.handle}@lastcall.dev`, handle: a.handle, displayName: a.handle, passwordHash: a.hash, role: a.role,
        geofenceExempt: a.exempt, isPrivate: a.exempt ? false : true, termsAcceptedAt: new Date(), termsVersion: CURRENT_TERMS_VERSION,
      },
    });
  }
  console.log(`[seed] ${PLACES.length} places, ${accounts.length} accounts (password: ${process.env.DEV_SEED_PASSWORD ?? "lastcall-dev"})`);
}

main().finally(() => db.$disconnect());
