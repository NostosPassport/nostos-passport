// Live contract check (see src/api/__tests__/live.test.ts). Plain Node, so requests use Node's real fetch
// instead of React Native's mocked networking.
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/api/__tests__/live.test.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  globals: { __DEV__: true },
};
