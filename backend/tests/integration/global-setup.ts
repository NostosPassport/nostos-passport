import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { TEST_DATABASE_URL } from "./env";

const DIRECT = process.env.DIRECT_URL ?? TEST_DATABASE_URL;

/**
 * Creates the separate test database on first run (no init-script bind mount needed, which is fragile
 * on Docker VMs that only share $HOME), then applies pending migrations, including the hand-written triggers.
 * `migrate deploy` is non-destructive; each test truncates tables in setup.ts instead.
 */
export default async function setup() {
  const url = new URL(DIRECT);
  const dbName = url.pathname.replace(/^\//, "");
  if (!/^[a-z0-9_]+$/.test(dbName)) throw new Error(`Unexpected test database name: ${dbName}`);
  const admin = new URL(DIRECT);
  admin.pathname = "/postgres";
  const client = new PrismaClient({ datasourceUrl: admin.toString() });
  try {
    const rows = await client.$queryRaw<{ exists: boolean }[]>`SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = ${dbName}) AS exists`;
    if (!rows[0]?.exists) await client.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } finally {
    await client.$disconnect();
  }
  execSync("pnpm exec prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: DIRECT, DIRECT_URL: DIRECT, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
  });
}
