import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.ts"],
    environment: "node",

    include: [
      "src/**/*.test.ts",
      "tests/**/*.test.ts",
    ],

    testTimeout: 30_000,

    // Las suites que comparten la infraestructura real limpian y recrean la
    // misma BD/Redis por caso. En ese modo los archivos deben ser secuenciales
    // para impedir que un TRUNCATE de una suite alcance a otra.
    fileParallelism: process.env.RUN_INTEGRATION !== "true",

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
