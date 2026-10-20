import "./env";
import { afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db";

const TABLES = [
  "rate_event",
  "login_attempt",
  "collection_share",
  "collection_stamp",
  "collection",
  "pinned_stamp",
  "neighborhood_completion",
  "stamp_photo",
  "photo",
  "venue",
  "neighborhood",
  "session",
  "email_challenge",
  "app_user",
];

beforeEach(async () => {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await prisma.$disconnect();
});
