/** pnpm user:role <email> <USER|MODERATOR|ADMIN>  (uses DATABASE_URL; see DEPLOY.md) */
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { setStaffRoleByEmail } from "../src/server/services/admin";

if (existsSync(".env") && !process.env.DATABASE_URL) process.loadEnvFile(".env");
const [email, role] = process.argv.slice(2);
if (!email || !role) {
  console.error("Usage: pnpm user:role <email> <USER|MODERATOR|ADMIN>");
  process.exit(1);
}
const db = new PrismaClient();
setStaffRoleByEmail(db, email, role)
  .then((u) => console.log(`[user:role] @${u.handle} is now ${u.role}`))
  .catch((e: Error) => {
    console.error(`[user:role] ${e.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
