// Builds REVIEW-BUNDLE-backend.txt for an external reviewer: every API route handler, every test file, the contract,
// the schema and migrations, the server and lib code, the decisions, open questions, the latest review file and a fresh
// test summary. Files are discovered by walking the tree, so nothing silently drops out of the bundle.
// Usage: pnpm bundle (needs the Docker database running).
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const walk = (dir, keep) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    return d.isDirectory() ? walk(p, keep) : keep(p) ? [p] : [];
  });
};
const latestReview = () => {
  const dir = "../reviews";
  if (!existsSync(dir)) return [];
  const names = readdirSync(dir).filter((n) => n.endsWith(".md")).sort();
  return names.length ? [join(dir, names.at(-1))] : [];
};

const files = [
  "REVIEW.md",
  "DECISIONS.md",
  "../OPEN-QUESTIONS.md",
  ...latestReview(),
  "API.md",
  "DEPLOY.md",
  "src/contracts/api.ts",
  "../mobile/src/api/contracts.ts",
  "../mobile/src/auth/auth-context.tsx",
  "vercel.json",
  "prisma/schema.prisma",
  ...walk("prisma/migrations", (p) => p.endsWith(".sql")).sort(),
  ...walk("src/app/api", (p) => /route\.tsx?$/.test(p)).sort(),
  ...walk("src/server", (p) => p.endsWith(".ts")).sort(),
  ...walk("src/lib", (p) => p.endsWith(".ts")).sort(),
  "src/middleware.ts",
  ...walk("prisma", (p) => p.endsWith(".ts") && !p.includes("migrations")).sort(),
  ...walk("tests", (p) => /\.(ts|json)$/.test(p)).sort(),
].filter((f) => existsSync(f) && statSync(f).isFile());

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" } });
  } catch (e) {
    return `${e.stdout ?? ""}${e.stderr ?? ""}\n[command failed: ${cmd}]`;
  }
}

const strip = (s) => s.replace(/\u001b\[[0-9;]*m/g, "");
const commit = run("git rev-parse --short HEAD").trim();
const log = run("git log --oneline -- .").trim();
const typecheck = strip(run("node_modules/.bin/tsc --noEmit")).trim() || "tsc --noEmit: no errors";
const lint = strip(run("node_modules/.bin/eslint .")).trim() || "eslint: no problems";
const tests = strip(run("node_modules/.bin/vitest run --reporter=verbose"))
  .split("\n")
  .filter((l) => /✓|×|↓|Test Files|Tests |Duration|FAIL/.test(l))
  .join("\n");

const sep = (title) => `\n\n${"=".repeat(100)}\n== ${title}\n${"=".repeat(100)}\n\n`;
let out = `NOSTOS BACKEND - REVIEW BUNDLE\nGenerated ${new Date().toISOString()} at commit ${commit}\n`;
out += `\nContents:\n${["TEST SUMMARY", ...files].map((f) => `  - ${f}`).join("\n")}\n`;
out += sep("TEST SUMMARY");
out += `$ pnpm typecheck\n${typecheck}\n\n$ pnpm lint\n${lint}\n\n$ pnpm vitest run --reporter=verbose\n${tests}\n\nGit history:\n${log}\n`;
for (const f of files) out += sep(f) + readFileSync(f, "utf8");
writeFileSync("REVIEW-BUNDLE-backend.txt", out);
console.log(`REVIEW-BUNDLE-backend.txt written (${files.length} files, ${(out.length / 1024).toFixed(0)} KiB)`);
