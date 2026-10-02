// Dependency ledger check: every dependency in backend/package.json and mobile/package.json needs a line in
// DEPENDENCIES.md of the form "- name@version: why". A version change without updating the ledger fails.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ledger = readFileSync(join(root, "DEPENDENCIES.md"), "utf8");
const lines = new Set(
  ledger.split("\n").map((l) => /^- (\S+@\S+): \S/.exec(l)?.[1]).filter(Boolean),
);
const missing = [];
for (const dir of ["backend", "mobile"]) {
  const pkg = JSON.parse(readFileSync(join(root, dir, "package.json"), "utf8"));
  for (const section of ["dependencies", "devDependencies"]) {
    for (const [name, version] of Object.entries(pkg[section] ?? {})) {
      if (!lines.has(`${name}@${version}`)) missing.push(`${dir}: ${name}@${version}`);
    }
  }
}
if (missing.length) {
  console.error("DEPENDENCIES.md is missing lines (format: '- name@version: why'):\n  " + missing.join("\n  "));
  process.exit(1);
}
console.log(`dependency ledger ok (${lines.size} lines)`);
