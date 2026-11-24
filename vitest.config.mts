import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // server-only throws outside a React Server environment; it is a no-op in tests.
      "server-only": path.resolve(import.meta.dirname, "tests/support/empty.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    setupFiles: ["tests/support/setup.ts"],
    // Integration tests share one database and each file resets it, so files run one at a time.
    fileParallelism: false,
  },
});
