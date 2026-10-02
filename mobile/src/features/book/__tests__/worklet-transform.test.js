/* global describe, it, expect, __dirname */
import { transformSync } from "@babel/core";
import { readFileSync } from "fs";
import path from "path";
import { runInNewContext } from "vm";

describe("passport UI runtime helpers", () => {
  it("serializes stageTransform with the installed Worklets plugin and runs its UI-thread code", () => {
    const filename = path.join(__dirname, "..", "book-state.ts");
    const { code } = transformSync(readFileSync(filename, "utf8"), {
      filename,
      babelrc: false,
      configFile: false,
      presets: ["@babel/preset-typescript"],
      plugins: ["react-native-worklets/plugin", "@babel/plugin-transform-modules-commonjs"],
    });
    const context = { exports: {}, global: { Error } };
    runInNewContext(code, context);
    const helper = context.exports.stageTransform;
    expect(typeof helper.__workletHash).toBe("number");
    expect(helper.__initData.code).toContain("stageTransform");
    // Rehydrate only the serialized code, without the original JS function or React Native mocks.
    const onUI = runInNewContext(`(${helper.__initData.code})`);
    expect(onUI(0, 300, 0.55)).toEqual({ scale: 1, translateX: -150 });
    expect(onUI(1, 300, 0.55)).toEqual({ scale: 0.55, translateX: -0 });
    expect(onUI(0.5, 300, 0.5)).toEqual({ scale: 0.75, translateX: -56.25 });
  });
});
