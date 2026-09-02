# Refactor RF-01, RF-04 y RF-05

## Diagnóstico

- **RF-01:** `controlPublicacion.ts` concentraba 769 líneas y accedía directamente a Prisma, R2, moderación y embeddings. Esto dificultaba probar reglas sin simular objetos HTTP.
- **RF-04:** las rutas y OpenAPI evolucionaban por separado. Había 25 operaciones de Express ausentes del contrato y no existía una matriz que mostrara qué endpoints tenían pruebas HTTP.
- **RF-05:** `tests/setup.ts` solo fijaba dos variables. Las pruebas no tenían PostgreSQL, Redis, namespace ni limpieza propios.

## Solución aplicada

### Separación de responsabilidades

El flujo de escritura de publicaciones quedó dividido así:

```text
router → controlador HTTP → servicioPublicacion → repositorios → Prisma
                                  ├─→ servicioR2
                                  ├─→ moderación en background
                                  └─→ embeddings en background
```

`ErrorServicio` expresa errores esperados con su estado HTTP. El controlador ya
no importa Prisma, R2, moderación de imágenes ni embeddings para crear, editar o
eliminar. El repositorio encapsula reemplazo de etiquetas y eliminación de
relaciones en transacciones. El límite de cinco imágenes se comprueba antes de
cualquier mutación.

### Trazabilidad de endpoints

`scripts/generarMatrizEndpoints.ts` descubre mounts y endpoints en
`src/api_rest`, los cruza con `openApiDocument` y localiza pruebas HTTP. La prueba
`endpoint-inventory.test.ts` impide divergencias futuras. La suite dinámica de
autorización recorre todas las rutas protegidas y comprueba 401; también prueba
403 para rutas limitadas por rol.

La matriz generada está en `docs/matriz-endpoints.md`. Que una fila tenga prueba
de autorización no significa que ya cubra éxito y todos los errores de dominio;
esos pendientes permanecen visibles para priorizarlos por módulo.

### Infraestructura de integración

`docker-compose.integration.yml` crea un proyecto Compose separado con:

- PostgreSQL 16 + pgvector en una base `swap_integration_test` sobre `tmpfs`.
- Redis efímero, sin persistencia, usando exclusivamente DB 15.
- Un contenedor runner con variables no productivas, creación del esquema y pruebas.
- Limpieza antes y después de la suite real, protegida por validaciones de entorno.

`infraestructura-real.test.ts` comprueba un endpoint que atraviesa Express,
repositorio y PostgreSQL, además de una escritura/lectura real en Redis.

## Alcance pendiente recomendado

RF-01 queda mitigado en el controlador de mayor tamaño, pero el mismo patrón se
puede extender gradualmente a anuncios, certificaciones e imágenes. Para RF-04,
la siguiente iteración debe completar por endpoint el caso exitoso y los errores
400/404/409 que la matriz todavía marca como pendientes.
