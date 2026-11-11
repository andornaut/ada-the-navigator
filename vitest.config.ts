import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    maxWorkers: 4,
    setupFiles: ["src/test-setup.ts"],
    testTimeout: 10000,
  },
});
