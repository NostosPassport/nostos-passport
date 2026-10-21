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
  {
    files: [
      "src/components/editorial/**/*.{ts,tsx}",
      "src/components/brand/form-header.tsx",
      "src/components/ui/button.tsx",
      "src/components/ui/list-row.tsx",
      "src/components/ui/text-field.tsx",
      "src/app/sign-in.tsx",
      "src/app/sign-up.tsx",
      "src/app/terms-update.tsx",
      "src/app/(app)/location-permission.tsx",
      "src/app/(app)/settings/index.tsx",
      "src/app/(app)/(tabs)/_layout.tsx",
      "src/app/(app)/(tabs)/passport.tsx",
      "src/app/(app)/stamp/*.tsx",
      "src/features/map/MapScreen.tsx",
      "src/features/book/CategoryStampMark.tsx",
      "src/features/map/PinMarker.tsx"
    ],
    rules: { "local/no-raw-design-values": "off" },
  },
  {
    files: ["eslint-rules/**/*.js", "scripts/**/*.{js,cjs,mjs}", "*.config.js", "babel.config.js", "jest.*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
  },
  { files: ["src/api/contracts.ts"], rules: { "@typescript-eslint/no-redeclare": "off" } },
  { files: ["src/theme/**", "src/**/__tests__/**", "src/**/*.test.{ts,tsx}"], rules: { "local/no-raw-design-values": "off" } },
]);
