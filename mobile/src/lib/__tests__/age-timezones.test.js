/* global describe, it, expect, __dirname */
import { execFileSync } from "child_process";
import path from "path";

const fixtures = [
  ["2026-10-03T03:59:59Z", "10/03/2013", false, { y: 2026, m: 10, d: 2 }],
  ["2026-10-03T04:00:00Z", "10/03/2013", true, { y: 2026, m: 10, d: 3 }],
  ["2026-01-02T04:59:59Z", "01/02/2013", false, { y: 2026, m: 1, d: 1 }],
  ["2026-01-02T05:00:00Z", "01/02/2013", true, { y: 2026, m: 1, d: 2 }],
];

const script = `
  const fs = require('fs'), vm = require('vm'), babel = require('@babel/core');
  const filename = process.argv[1];
  const {code} = babel.transformSync(fs.readFileSync(filename,'utf8'), {
    filename, babelrc: false, configFile: false,
    presets: ['@babel/preset-typescript'], plugins: ['@babel/plugin-transform-modules-commonjs']
  });
  const context = {exports: {}};
  vm.runInNewContext(code, context);
  const fixtures = JSON.parse(process.argv[2]);
  process.stdout.write(JSON.stringify(fixtures.map(([instant,birth]) => ({
    today: context.exports.today(new Date(instant)),
    check: context.exports.checkBirthdate(birth,new Date(instant))
  }))));
`;

describe("New York age boundary in every device timezone", () => {
  it.each(["UTC", "America/New_York", "Asia/Tokyo", "Pacific/Honolulu"])("%s agrees with the backend in summer and winter", (zone) => {
    const results = JSON.parse(execFileSync(process.execPath, ["-e", script, path.join(__dirname, "..", "age.ts"), JSON.stringify(fixtures)], {
      cwd: path.resolve(__dirname, "../../.."), env: { ...process.env, TZ: zone }, encoding: "utf8",
    }));
    for (const [i, [, birth, ok, today]] of fixtures.entries()) {
      expect(results[i].today).toEqual(today);
      expect(results[i].check.ok).toBe(ok);
      if (ok) {
        const [month, day, year] = birth.split("/");
        expect(results[i].check.apiDate).toBe(`${year}-${month}-${day}`);
      } else {
        expect(results[i].check).toMatchObject({ reason: "underage" });
        expect(results[i].check).not.toHaveProperty("apiDate");
      }
    }
  });
});
