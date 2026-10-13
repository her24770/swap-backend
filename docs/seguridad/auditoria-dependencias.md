# Auditoría automática de dependencias

El job `Auditoría de dependencias` se ejecuta en cada pull request hacia
`develop` o `main`, y también en los pushes a esas ramas. Usa el lockfile con
`npm ci` y ejecuta `npm run audit:security`. Una vulnerabilidad alta o crítica
hace fallar el job. El resultado se muestra en el resumen de GitHub Actions y
se conserva como artefacto durante 14 días.

La misma política se mantiene de forma independiente en `swap-backend` y
`swap-frontend`, porque son repositorios distintos. Los hallazgos moderados o
bajos permanecen visibles, pero no bloquean el PR.

## Gestión de excepciones

La primera opción siempre es actualizar la dependencia directa, regenerar el
lockfile y ejecutar build y pruebas. No debe usarse `npm audit fix --force` sin
evaluar y probar los cambios mayores que proponga.

Una excepción solo se admite cuando no existe una versión corregida compatible
y el riesgo residual está justificado. Debe agregarse al `allowlist` de
`.audit-ci.jsonc` como objeto con:

- identificador exacto `GHSA`, nunca el nombre completo de un módulo;
- motivo, alcance y ticket de seguimiento en `notes`;
- `expiry` no mayor a 30 días;
- aprobación en PR del responsable técnico o de seguridad.

Al vencer `expiry`, la excepción deja de estar activa y el pipeline vuelve a
fallar. Renovarla requiere una nueva revisión del riesgo. Las excepciones no
deben desactivar el escaneo, omitir todas las dependencias de desarrollo ni
cambiar el umbral global.

## Ejecución local

```bash
npm ci
npm run audit:security
```
