// Runs the seed guard on its own, BEFORE `prisma migrate reset` drops the database (see `db:reset`).
import { existsSync } from "node:fs";
import { assertSeedAllowed } from "./seed-guard";

if (existsSync(".env")) process.loadEnvFile(".env");
try {
  assertSeedAllowed(process.env);
} catch (e) {
  console.error(`[db:reset] ${(e as Error).message}`);
  process.exit(1);
}
