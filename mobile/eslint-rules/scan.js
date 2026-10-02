/** Prints the design-rule config and violations for src/ as JSON. Run by the Jest test in a child process. */
const path = require("path");
const { ESLint } = require("eslint");

(async () => {
  const root = path.resolve(__dirname, "..");
  // allowInlineConfig: false so `eslint-disable` comments can't hide a violation from this check.
  const eslint = new ESLint({ cwd: root, allowInlineConfig: false });
  const config = await eslint.calculateConfigForFile(path.join(root, "src/app/_layout.tsx"));
  const results = await eslint.lintFiles(["src/**/*.{ts,tsx}"]);
  const hits = results.flatMap((r) =>
    r.messages
      .filter((m) => m.ruleId === "local/no-raw-design-values" || m.ruleId === "local/no-emoji")
      .map((m) => `${path.relative(root, r.filePath)}:${m.line} ${m.message}`),
  );
  process.stdout.write(
    JSON.stringify({ rules: { raw: config.rules["local/no-raw-design-values"], emoji: config.rules["local/no-emoji"] }, hits, files: results.length }),
  );
})().catch((e) => {
  process.stderr.write(String(e && e.stack));
  process.exit(1);
});
