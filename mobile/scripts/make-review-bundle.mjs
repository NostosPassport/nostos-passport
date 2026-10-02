// Builds REVIEW-BUNDLE-mobile.txt: the review docs, the design tokens, the API client, and the core screens, plus a
// fresh test summary. Run: node scripts/make-review-bundle.mjs
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "REVIEW.md",
  "DECISIONS.md",
  "STORE.md",
  "DEVICE-CHECKLIST.md",
  "src/theme/colors.ts",
  "src/theme/typography.ts",
  "src/theme/layout.ts",
  "src/theme/motion.ts",
  "src/api/client.ts",
  "src/api/base-url.ts",
  "src/api/index.ts",
  "src/api/queries.ts",
  "src/app/(app)/venue/[id].tsx",
  "src/features/venue/live-section.tsx",
  "src/features/venue/official-section.tsx",
  "src/features/venue/report-bar.tsx",
  "src/features/venue/report-bar-state.ts",
  "src/features/venue/presence.ts",
  "src/app/(app)/venue/report.tsx",
  "src/features/map/venue-marker.tsx",
  "src/api/keys.ts",
  "src/features/people/profile-screen.tsx",
  "src/features/people/profile-tabs.tsx",
  "src/features/people/author.ts",
  "src/features/people/author-line.tsx",
  "src/features/people/use-follow.ts",
  "src/features/people/use-requests.ts",
  "src/features/people/edit-profile.ts",
  "src/app/(app)/edit-profile.tsx",
  "src/app/(app)/venue/photo.tsx",
  "src/features/posts/composer.ts",
  "src/features/posts/use-like.ts",
  "src/features/posts/like-button.tsx",
  "src/components/ui/rating-picker.tsx",
  "src/components/ui/verified-badge.tsx",
  "src/app/(app)/post/[id].tsx",
  "src/features/venue/featured-section.tsx",
  "src/app/(app)/venue/photos.tsx",
  "eslint-rules/index.js",
];

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

let out = `NOSTOS iOS — REVIEW BUNDLE\nCommit: ${commit}\nGenerated: ${new Date().toISOString()}\n\n`;
out += `=== TEST SUMMARY ===\n${summary}\n\n${tsc}\n${lint}\n\n`;
for (const f of files) {
  out += `\n\n===== ${f} =====\n\n${readFileSync(f, "utf8")}`;
}
writeFileSync("REVIEW-BUNDLE-mobile.txt", out);
console.log(`REVIEW-BUNDLE-mobile.txt: ${files.length} files, ${out.length} chars`);
