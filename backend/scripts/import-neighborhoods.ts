/**
 * pnpm neighborhoods:import
 * Loads NYC neighborhood boundaries (prisma/data/neighborhoods.json, built by scripts/build-neighborhoods.mjs from NYC Open
 * Data's Neighborhood Tabulation Areas) into the neighborhood table, then files every place under the one that contains it.
 * Idempotent. Run it after migrating and before importing places.
 */
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { assignNeighborhoods, importNeighborhoods } from "../src/server/services/neighborhoods";

if (existsSync(".env")) process.loadEnvFile(".env");
const db = new PrismaClient();
try {
  const n = await importNeighborhoods(db);
  const assigned = await assignNeighborhoods(db);
  console.log(`[neighborhoods:import] ${n} neighborhoods loaded, ${assigned} places filed`);
} finally {
  await db.$disconnect();
}
