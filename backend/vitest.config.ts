import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Integration tests share one test database, so files run one at a time.
    fileParallelism: false,
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: { name: "unit", env: { SOCIAL_ENABLED: "1" }, include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "integration",
          // The social layer is built and tested with the flag on; flag-off tests switch it per test.
          env: { SOCIAL_ENABLED: "1" },
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          testTimeout: 30000,
          hookTimeout: 60000,
        },
      },
    ],
  },
});
