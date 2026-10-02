/** The contract must stay a verbatim copy of the backend's (when the backend repo is on this machine). */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

// mobile/src/api/__tests__ -> repo root -> backend/
const backendFile = join(process.env.NOSTOS_BACKEND ?? join(__dirname, "../../../../backend"), "src/contracts/api.ts");
const local = readFileSync(join(__dirname, "../contracts.ts"), "utf8");

describe("contracts.ts", () => {
  it("names its source", () => {
    expect(local).toMatch(/COPIED VERBATIM from backend\/src\/contracts\/api\.ts/);
  });

  (existsSync(backendFile) ? it : it.skip)("matches the backend contract byte for byte", () => {
    const body = local.replace(/^\/\*\*\n \* COPIED VERBATIM[\s\S]*?\*\/\n/, "");
    expect(body).toBe(readFileSync(backendFile, "utf8"));
  });
});
