// Creates .env from .env.example on a clean clone, and appends any keys that were added to .env.example
// later (so an existing checkout keeps working after `git pull && pnpm install`). Never overwrites values.
import { existsSync, copyFileSync, readFileSync, appendFileSync } from "node:fs";

if (!existsSync(".env.example")) process.exit(0);
if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("[ensure-env] created .env from .env.example");
  process.exit(0);
}
const keys = (text) => new Set([...text.matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1]));
const have = keys(readFileSync(".env", "utf8"));
const missing = readFileSync(".env.example", "utf8")
  .split("\n")
  .filter((line) => {
    const m = /^([A-Z0-9_]+)=/.exec(line);
    return m && !have.has(m[1]);
  });
if (missing.length) {
  appendFileSync(".env", `\n# Added by ensure-env from .env.example\n${missing.join("\n")}\n`);
  console.log(`[ensure-env] added ${missing.length} new key(s) to .env`);
}
