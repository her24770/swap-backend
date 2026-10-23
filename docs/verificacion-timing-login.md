# Verificación del tiempo de respuesta del login

Fecha local: 2026-10-08. Entorno: contenedores aislados de integración,
PostgreSQL 16, Redis 7, Node 20 y bcrypt con costo 10.

El script `scripts/medirTimingLogin.ts` realiza 10 calentamientos y 100
solicitudes por caso. Los casos existente/inexistente se intercalan y se
alterna el orden de cada pareja para reducir el efecto de deriva. La limpieza
del rate limit ocurre fuera del intervalo medido. Todas las muestras deben
responder HTTP 401.

El modo `--legacy` reproduce dentro del benchmark la rama anterior que omitía
bcrypt para correos inexistentes. No existe ninguna bandera equivalente en la
aplicación ni se puede habilitar ese comportamiento en producción.

## Resultados

| Versión y caso | n | Media | p25 | Mediana | p75 | p95 |
|---|---:|---:|---:|---:|---:|---:|
| Antes: correo existente | 100 | 70.70 ms | 54.18 ms | 66.08 ms | 82.25 ms | 99.65 ms |
| Antes: correo inexistente | 100 | 4.21 ms | 3.05 ms | 3.65 ms | 4.69 ms | 7.70 ms |
| Después: correo existente | 100 | 75.14 ms | 68.94 ms | 72.22 ms | 79.53 ms | 91.25 ms |
| Después: correo inexistente | 100 | 74.58 ms | 68.21 ms | 72.00 ms | 80.28 ms | 91.21 ms |

Comparación de distribuciones:

| Métrica | Antes | Después |
|---|---:|---:|
| Diferencia de medianas | 62.43 ms | 0.22 ms |
| Delta de Cliff | 1.0000 (separación total) | 0.0222 (efecto despreciable) |

Después del cambio, mediana, rango intercuartílico y p95 son prácticamente
iguales. Las distribuciones se superponen y el tamaño de efecto es cercano a
cero; con estas muestras no hay una señal temporal útil para distinguir si el
correo existe.

## Reproducción

Con el entorno de integración configurado:

```bash
# Flujo corregido
npx tsx scripts/medirTimingLogin.ts

# Reproducción aislada del flujo anterior
npx tsx scripts/medirTimingLogin.ts --legacy
```

El script imprime también las 100 muestras crudas de cada caso en JSON para
generar histogramas o boxplots sin repetir la prueba.
