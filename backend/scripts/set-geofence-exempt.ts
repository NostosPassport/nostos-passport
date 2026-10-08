import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env") && !process.env.DATABASE_URL) process.loadEnvFile(".env");
const [emailArg, valueArg] = process.argv.slice(2);
if (!emailArg || !valueArg || !["true", "false"].includes(valueArg.toLowerCase())) {
  console.error("Usage: pnpm user:geofence-exempt <email> <true|false>");
  process.exit(1);
}
const email = emailArg.trim().toLowerCase();
const geofenceExempt = valueArg.toLowerCase() === "true";
const db = new PrismaClient();

async function main() {
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) throw new Error(`No active account with email ${email}`);
  const updated = await db.user.update({ where: { id: user.id }, data: { geofenceExempt }, select: { handle: true, geofenceExempt: true } });
  console.log(`[user:geofence-exempt] @${updated.handle}: ${updated.geofenceExempt}`);
}

main().catch((e: Error) => { console.error(`[user:geofence-exempt] ${e.message}`); process.exitCode = 1; }).finally(() => db.$disconnect());
