import { readFileSync } from "node:fs";

try {
  const { total } = JSON.parse(readFileSync("coverage/report/coverage-summary.json", "utf8"));
  const metrics = [
    ["Líneas", total.lines],
    ["Sentencias", total.statements],
    ["Funciones", total.functions],
    ["Ramas", total.branches],
  ];

  console.log("### Cobertura de pruebas");
  console.log();
  console.log("| Métrica | Cubiertas / Total | Cobertura |");
  console.log("| --- | ---: | ---: |");
  for (const [name, metric] of metrics) {
    console.log(`| ${name} | ${metric.covered} / ${metric.total} | ${metric.pct}% |`);
  }
  console.log();
  console.log("El reporte HTML completo está en el artefacto de cobertura.");
} catch (error) {
  console.log("### Cobertura de pruebas");
  console.log();
  console.log("No se generó el reporte de cobertura. Revisa el paso de pruebas.");
  console.error(error);
  process.exitCode = 1;
}

