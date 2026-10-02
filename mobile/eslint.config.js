// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const globals = require("globals");
const local = require("./eslint-rules");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", ".expo/*", "node_modules/*", "coverage/*", "ios/*", "android/*"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { local },
    rules: {
      "local/no-raw-design-values": "error",
      "local/no-emoji": "error",
      "no-console": ["error", { allow: ["info", "warn", "error"] }],
    },
  },
  // Node tooling (lint rules, scripts, configs) and their Jest tests.
  {
    files: ["eslint-rules/**/*.js", "scripts/**/*.{js,cjs,mjs}", "*.config.js", "babel.config.js", "jest.*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
  },
  // Copied verbatim from the backend: values and types intentionally share names.
  { files: ["src/api/contracts.ts"], rules: { "@typescript-eslint/no-redeclare": "off" } },
  // Tokens live here; tests assert on literal values.
  { files: ["src/theme/**", "src/**/__tests__/**", "src/**/*.test.{ts,tsx}"], rules: { "local/no-raw-design-values": "off" } },
]);
