// Builds REVIEW-BUNDLE-mobile.txt: the review docs, the contract copy and auth context, every test file, the theme,
// the API client and every screen and feature, plus a fresh test summary. Files are discovered by walking the tree.
// Run: node scripts/make-review-bundle.mjs
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
const code = (p) => /\.(tsx?|jsx?|json)$/.test(p) && !/\.d\.ts$/.test(p);

const files = [
  "REVIEW.md",
  "DECISIONS.md",
  "../OPEN-QUESTIONS.md",
  ...latestReview(),
  "STORE.md",
  "DEVICE-CHECKLIST.md",
  "babel.config.js",
  "jest.setup.tsx",
  "jest.live.config.js",
  "src/config.ts",
  "../backend/prisma/schema.prisma",
  "src/api/contracts.ts",
  "src/auth/auth-context.tsx",
  ...walk("src/theme", code).sort(),
  ...walk("src/api", code).filter((p) => p !== "src/api/contracts.ts").sort(),
  ...walk("src/lib", code).sort(),
  ...walk("src/auth", code).filter((p) => p !== "src/auth/auth-context.tsx").sort(),
  ...walk("src/app", code).sort(),
  ...walk("src/features", code).sort(),
  ...walk("src/components", code).sort(),
  ...walk("eslint-rules", (p) => p.endsWith(".js")).sort(),
].filter((f) => existsSync(f) && statSync(f).isFile());

const run = (cmd) => {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    return `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
};

const jest = run("npx jest --silent 2>&1");
const summary = jest
  .split("\n")
  .filter((l) => /^(PASS|FAIL)|^Tests:|^Test Suites:/.test(l.trim()))
  .join("\n");
const tsc = run("npx tsc --noEmit 2>&1").trim() || "tsc: no errors";
const lint = run("npx expo lint --max-warnings 0 2>&1").trim().split("\n").slice(-3).join("\n") || "lint: clean";
const commit = run("git rev-parse --short HEAD").trim();
const branch = run("git branch --show-current").trim();
const state = run("git status --porcelain").trim() ? "UNCOMMITTED WORKING TREE (HEAD is the base commit)" : "clean committed tree";

let out = `NOSTOS iOS - REVIEW BUNDLE\nHEAD: ${commit}\nBranch: ${branch}\nSnapshot: ${state}\nGenerated: ${new Date().toISOString()}\n\n`;
out += `Contents:\n${files.map((f) => `  - ${f}`).join("\n")}\n\n`;
out += `=== TEST SUMMARY ===\n${summary}\n\n${tsc}\n${lint}\n\n`;
for (const f of files) {
  out += `\n\n===== ${f} =====\n\n${readFileSync(f, "utf8")}`;
}
writeFileSync("REVIEW-BUNDLE-mobile.txt", out);
console.log(`REVIEW-BUNDLE-mobile.txt: ${files.length} files, ${out.length} chars`);
