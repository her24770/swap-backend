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
      reportsDirectory: "coverage/report",
      reportOnFailure: true,
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",
        "src/**/*.test.ts",
        "src/**/*.d.ts",
      ],
      // Línea base: 461 pruebas unitarias y de integración con Docker (24/10/2026).
      thresholds: { lines: 59.86 },
    },
  },
});
