// Builds REVIEW-BUNDLE-backend.txt for an external reviewer: REVIEW.md, DECISIONS.md, the Prisma schema and
// migrations, the consensus/accuracy/reputation modules, the service-layer permission checks, and a
// fresh test summary. Usage: pnpm bundle (needs the Docker database running).
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const files = [
  "REVIEW.md",
  "DECISIONS.md",
  "../OPEN-QUESTIONS.md",
  "API.md",
  "DEPLOY.md",
  "src/contracts/api.ts",
  "vercel.json",
  "prisma/schema.prisma",
  ...readdirSync("prisma/migrations", { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => `prisma/migrations/${d.name}/migration.sql`)
    .sort(),
  "src/lib/consensus/index.ts",
  "src/lib/accuracy/index.ts",
  "src/server/services/reputation.ts",
  "src/lib/time.ts",
  "src/lib/geo.ts",
  // Service-layer permission checks and the services that call them.
  "src/server/permissions.ts",
  "src/server/actor.ts",
  "src/server/http.ts",
  "src/server/services/reports.ts",
  "src/server/services/photos.ts",
  "src/server/services/comments.ts",
  "src/server/services/social.ts",
  "src/server/services/owner.ts",
  "src/server/services/admin.ts",
  "src/server/services/moderation.ts",
  "src/server/services/venues.ts",
  "src/server/services/account.ts",
  "src/server/services/blocks.ts",
  "src/server/services/me.ts",
  "src/server/privacy.ts",
  "src/server/rate-limit.ts",
  "src/server/services/people.ts",
  "src/server/services/posts.ts",
  "src/server/services/likes.ts",
  "src/server/services/featuring.ts",
  "src/server/services/gallery.ts",
  "src/server/services/activity.ts",
  "src/server/services/verification.ts",
  "src/server/services/regulars.ts",
  "src/lib/likes.ts",
  "src/lib/regulars.ts",
  "prisma/seed-social.ts",
  "src/server/services/osm-import.ts",
  "src/server/cron.ts",
  "src/lib/storage/index.ts",
  "src/lib/content-filter/index.ts",
  "src/lib/content-filter/wordlist.ts",
  "src/lib/osm.ts",
  "src/lib/auth/session.ts",
  "prisma/seed-guard.ts",
  "src/middleware.ts",
];

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" } });
  } catch (e) {
    return `${e.stdout ?? ""}${e.stderr ?? ""}\n[command failed: ${cmd}]`;
  }
}

const strip = (s) => s.replace(/\u001b\[[0-9;]*m/g, "");
const commit = run("git rev-parse --short HEAD").trim();
// Only this folder's history (the repo also holds mobile/).
const log = run("git log --oneline -- .").trim();
// The local binaries, not `pnpm -s`: newer pnpm versions reject `-s`, which silently emptied the summary.
const typecheck = strip(run("node_modules/.bin/tsc --noEmit")).trim() || "tsc --noEmit: no errors";
const lint = strip(run("node_modules/.bin/eslint .")).trim() || "eslint: no problems";
const tests = strip(run("node_modules/.bin/vitest run --reporter=verbose"))
  .split("\n")
  .filter((l) => /✓|×|↓|Test Files|Tests |Duration|FAIL/.test(l))
  .join("\n");

const sep = (title) => `\n\n${"=".repeat(100)}\n== ${title}\n${"=".repeat(100)}\n\n`;
let out = `NOSTOS — REVIEW BUNDLE\nGenerated ${new Date().toISOString()} at commit ${commit}\n`;
out += `\nContents:\n${["TEST SUMMARY", ...files].map((f) => `  - ${f}`).join("\n")}\n`;
out += sep("TEST SUMMARY");
out += `$ pnpm typecheck\n${typecheck}\n\n$ pnpm lint\n${lint}\n\n$ pnpm vitest run --reporter=verbose\n${tests}\n\nGit history:\n${log}\n`;
for (const f of files) out += sep(f) + readFileSync(f, "utf8");
writeFileSync("REVIEW-BUNDLE-backend.txt", out);
console.log(`REVIEW-BUNDLE-backend.txt written (${files.length} files, ${(out.length / 1024).toFixed(0)} KiB)`);
