# Plan de actualización de dependencias mayores

Estado revisado el 27 de octubre de 2026 contra las etiquetas publicadas en el
registro oficial de npm. Las migraciones se harán por separado para que una
regresión tenga una causa y un rollback claros.

| Dependencia | Proyecto | Objetivo estable | Estado |
| --- | --- | --- | --- |
| Multer | 1.4.5-lts | 2.5.0 | Migrado en este sprint |
| Prisma / `@prisma/client` | 5.22.0 | 7.10.1 | Planificado |
| Express | 4.21.2 | 5.3.0 | Planificado |
| `redis` (node-redis) | 4.7.0 | 6.3.0 | Planificado |

## Multer 2

Impacto: Multer 1 LTS ya no recibe mantenimiento y su parser multipart quedó
expuesto a vulnerabilidades corregidas en 2.x. El proyecto usa un
`StorageEngine` propio, validación de magic bytes, límites de tamaño/cantidad y
mapeo de `MulterError`; esos eran los puntos con riesgo de incompatibilidad.

Se actualizaron `multer` y `@types/multer` a 2.x sin cambiar el contrato HTTP.
La suite focalizada cubre JPEG/PNG/WEBP/PDF, contenido con MIME falso, límites,
errores del stream, una carga multipart válida y un body multipart truncado. La
respuesta para payload malformado continúa siendo HTTP 400.

Referencia: [releases oficiales de Multer](https://github.com/expressjs/multer/releases).

## Prisma 5 → 7

Impacto esperado:

- Prisma 7 es ESM, requiere revisar `tsconfig.json`, scripts de seed y el target
  de producción antes de cambiar dependencias.
- La configuración del CLI pasa a `prisma.config.ts`; URLs y carga de variables
  deben salir del bloque histórico del schema según la guía de migración.
- El generador exige un `output` explícito y cambia cómo se importa el cliente.
- El cliente usa adaptadores de base de datos; hay que validar pool, TLS,
  transacciones, shutdown y métricas con PostgreSQL real.
- `prisma`, `@prisma/client` y el cliente generado deben actualizarse juntos.

Plan:

1. Crear un PR exclusivo y fijar ambos paquetes en la misma versión 7.x.
2. Añadir `prisma.config.ts`, configurar el output y adaptar imports, seeds y
   Docker build sin cambiar el schema ni generar migraciones SQL.
3. Ejecutar `prisma validate`, `prisma generate`, build, unitarios, contratos e
   integración Docker sobre una base desechable.
4. Probar `migrate deploy`, seed y rollback de la imagen en staging; comparar
   conexiones, latencia y errores antes de producción.

Referencia: [guía oficial para actualizar a Prisma 7](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7).

## Express 4 → 5

Impacto esperado:

- Las promesas rechazadas llegan automáticamente al middleware de errores; se
  deben buscar wrappers async o `next(error)` que puedan reportar dos veces.
- Cambia la sintaxis de rutas de `path-to-regexp`, especialmente comodines,
  opcionales y caracteres reservados.
- `req.body` puede ser `undefined` y varias firmas/deprecaciones de respuesta y
  parsing desaparecen o cambian.
- Hay que verificar middleware de cookies, CORS, Helmet, rate limit, Swagger,
  proxy confiable y los tipos de Express en conjunto.

Plan:

1. Ejecutar el codemod oficial y revisar manualmente rutas y middleware async.
2. Actualizar Express y sus tipos en un PR aislado; compilar con reglas estrictas.
3. Ejecutar inventario/contratos de endpoints, integración completa y ZAP,
   comparando códigos, cuerpos, cookies y manejo de errores con Express 4.
4. Desplegar primero en staging y conservar rollback a la imagen anterior.

Referencia: [guía oficial de migración a Express 5](https://expressjs.com/en/guide/migrating-5.html).

## Redis 4 → 6

Impacto esperado:

- La migración cruza dos mayores; debe hacerse 4→5 y luego 5→6 para aislar
  cambios de API, tipos y comportamiento.
- Hay que revisar reconexión, eventos de error, cierre del cliente y comandos
  usados por sesiones, rate limiting y caché.
- Redis 6 requiere Node 20 o superior; la imagen actual usa Node 22 y cumple.
- Las opciones nuevas de caché del lado cliente no se habilitarán en la primera
  migración para no cambiar semántica ni consumo de memoria.

Plan:

1. Inventariar comandos y eventos usados en `src/persistencia/redisClient.ts` y
   consumidores; agregar pruebas de caída/reconexión y expiración.
2. Migrar a 5.x, ejecutar unitarios e integración Docker y observar staging.
3. Migrar a 6.x sin activar client-side caching; repetir pruebas de carga,
   reconexión y cierre limpio.
4. Activar características nuevas sólo en otro cambio medido y reversible.

Referencias: [node-redis oficial](https://github.com/redis/node-redis) y
[guía 4→5](https://github.com/redis/node-redis/blob/master/docs/v4-to-v5.md).
