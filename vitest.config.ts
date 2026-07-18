import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",

    include: [
      "src/**/*.test.ts",
      "tests/**/*.test.ts",
    ],

    env: {
      NODE_ENV: "test",
    },

    testTimeout: 30_000,

    sequence: {
      concurrent: false,
    },

    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",
        "src/**/*.test.ts",
        "src/**/*.d.ts",
      ],
    },
  },
});