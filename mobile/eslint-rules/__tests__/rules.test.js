/**
 * Tests for the design-system lint rules, plus a scan of the real source tree so the rule
 * can't be silently switched off in eslint.config.js.
 */
const path = require("path");
const { execFileSync } = require("child_process");
const { RuleTester } = require("eslint");

const { rules } = require("..");

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
});

describe("local/no-raw-design-values", () => {
  tester.run("no-raw-design-values", rules["no-raw-design-values"], {
    valid: [
      "const s = { color: colors.accent, padding: space.md, borderRadius: radius.card };",
      "const s = { margin: 0, flex: 1, opacity: 0.5, zIndex: 2 };",
      "const label = 'Packed. 20 min line.';",
      "const tag = '#hashtag';",
      "<Icon size={size.icon} />",
      "const s = { borderRadius: size.marker / 2 };",
      "const label = { title: 'Red Room' };",
      "<Text color='textPrimary' />",
    ],
    invalid: [
      { code: "const s = { color: '#FFB224' };", errors: [{ messageId: "color" }] },
      { code: "const s = { backgroundColor: 'rgba(255,255,255,0.08)' };", errors: [{ messageId: "color" }] },
      { code: "const c = `hsl(10, 20%, 30%)`;", errors: [{ messageId: "color" }] },
      { code: "<View tint='#fff' />", errors: [{ messageId: "color" }] },
      { code: "const s = { padding: 17 };", errors: [{ messageId: "number" }] },
      { code: "const s = { marginLeft: -8 };", errors: [{ messageId: "number" }] },
      { code: "const s = { fontSize: 15, lineHeight: 20 };", errors: [{ messageId: "number" }, { messageId: "number" }] },
      { code: "<Icon size={24} />", errors: [{ messageId: "number" }] },
      { code: "const s = { color: 'white' };", errors: [{ messageId: "color" }] },
      { code: "const s = { backgroundColor: 'Red' };", errors: [{ messageId: "color" }] },
      { code: "<Icon tintColor='black' />", errors: [{ messageId: "color" }] },
      { code: "const s = { padding: 4 * 3 };", errors: [{ messageId: "number" }] },
      { code: "const s = { flexBasis: 120 };", errors: [{ messageId: "number" }] },
      { code: "<Pressable hitSlop={10} />", errors: [{ messageId: "number" }] },
      { code: "const c = PlatformColor('systemRed');", errors: [{ messageId: "color" }] },
    ],
  });
});

describe("local/no-emoji", () => {
  tester.run("no-emoji", rules["no-emoji"], {
    valid: ["const a = 'Packed · 20 min line';", "const b = '#1 spot';", "<Text>© OpenStreetMap contributors</Text>"],
    invalid: [
      { code: "const a = 'Packed 🔥';", errors: [{ messageId: "emoji" }] },
      { code: "<Text>Cheers 🍻</Text>", errors: [{ messageId: "emoji" }] },
    ],
  });
});

describe("the source tree", () => {
  it("has no raw colors or emoji outside src/theme, and the rules are enabled", () => {
    const out = execFileSync(process.execPath, [path.join(__dirname, "../scan.js")], { encoding: "utf8", timeout: 120000 });
    const { rules: enabled, hits, files } = JSON.parse(out);
    expect(enabled).toEqual({ raw: [2], emoji: [2] });
    expect(files).toBeGreaterThan(10);
    expect(hits).toEqual([]);
  });
});
