/**
 * Math that runs inside Reanimated worklets (gestures and animated styles) runs on the UI thread, where a plain imported function
 * can't be called. A file-level "worklet" directive makes every function in it callable there. Jest can't catch a missing one (it
 * runs everything on one thread), so this reads the files: each one listed must start with the directive.
 */
import { readFileSync } from "fs";
import path from "path";

const WORKLET_MATH = ["foil.ts", "open-math.ts", "flip-math.ts", "landing.ts", "zoom.ts"];

describe("worklet math files", () => {
  it.each(WORKLET_MATH)("%s starts with the worklet directive and imports nothing that isn't a worklet", (file) => {
    const src = readFileSync(path.join(__dirname, "..", file), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").trimStart();
    expect(code.startsWith('"worklet";')).toBe(true);
    // Only other worklet math may be imported (a plain module would not be callable on the UI thread).
    for (const m of src.matchAll(/^import .* from "(.*)";$/gm)) expect(["./flip-math", "./foil", "./open-math", "./landing", "./zoom"]).toContain(m[1]);
  });
});
