import "./env";
import { afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db";

const TABLES = [
  "rate_event", "verification_event", "photo_like", "follow_request", "block", "login_attempt",
  "moderation_event", "flag", "follow", "pinned_stamp", "stamp_photo", "photo", "venue", "session", "app_user",
];

beforeEach(async () => {
  // TRUNCATE does not fire the row-level no-delete triggers, so tests start from a clean slate.
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await prisma.$disconnect();
});
