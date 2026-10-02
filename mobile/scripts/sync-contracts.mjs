// Re-copies the backend contract verbatim with a provenance header.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The backend is the sibling folder in this repo (../backend from mobile/).
const backend = process.env.NOSTOS_BACKEND ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../backend");
const src = readFileSync(join(backend, "src/contracts/api.ts"), "utf8");
const commit = execFileSync("git", ["-C", backend, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const header = `/**\n * COPIED VERBATIM from backend/src/contracts/api.ts (this repo, commit ${commit}).\n * Do not edit here: change the backend contract, then re-copy with \`npm run sync:contracts\`.\n */\n`;
writeFileSync("src/api/contracts.ts", header + src);
console.log(`contracts synced from ${backend} @ ${commit}`);
