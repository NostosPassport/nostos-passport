// Point every Prisma client in the test process at the separate test database.
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
if (!/nostos_test/.test(url) || !/nostos_test/.test(process.env.TEST_DIRECT_URL ?? url)) {
  throw new Error(`Refusing to run integration tests against a non-test database: ${url}`);
}
process.env.DATABASE_URL = url;
// Migrations run through DIRECT_URL. Tests may override it (e.g. pooled runs point DATABASE_URL at PgBouncer).
process.env.DIRECT_URL = process.env.TEST_DIRECT_URL ?? url;
export const TEST_DATABASE_URL = url;
