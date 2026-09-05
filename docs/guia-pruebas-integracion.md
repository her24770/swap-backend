# Guía para pruebas de integración

Esta guía aplica al backend. Las pruebas frontend de chat se ejecutan desde
`Front/swap-frontend` con `npm run test:run`.

## Requisitos

- Docker Desktop/Engine iniciado y Docker Compose disponible.
- Dependencias instaladas en `Back/swap-backend` (`npm install`).

## Ejecución recomendada

Desde `Back/swap-backend`:

```bash
npm run test:integration:docker
```

Ese comando realiza todo el ciclo: elimina una ejecución aislada anterior,
crea PostgreSQL 16 y Redis 7 efímeros, prepara Prisma, ejecuta las suites y
destruye contenedores, red y almacenamiento al finalizar. No usa los servicios
de desarrollo ni producción.

Dentro de cada caso real, el hook de la suite limpia PostgreSQL y Redis, reinicia
identidades/rate limiters y crea fixtures nuevos. No se deben reutilizar IDs ni
datos creados por otro caso.

## Depuración desde el host

Cuando se necesita ejecutar o depurar Vitest fuera del runner:

```bash
cp .env.integration.example .env.integration
set -a
. ./.env.integration
set +a
docker compose -f docker-compose.integration.yml up -d postgres-integration redis-integration
npx prisma db execute --file ./prisma/setup.sql
npx prisma db push --skip-generate
npm run test:integration
npm run test:integration:down
```

El último comando es obligatorio si una prueba falla o se interrumpe. Las
variables apuntan a `swap_integration_test`, `localhost:55432` y Redis DB 15;
si se cambia un puerto mediante `INTEGRATION_POSTGRES_PORT` o
`INTEGRATION_REDIS_PORT`, la URL debe reflejarlo.

## Cómo agregar una IT

1. Crear el archivo en `tests/integration/` y nombrarlo `*.test.ts`.
2. Encerrar los casos que requieran servicios reales con
   `describe.runIf(process.env.RUN_INTEGRATION === "true")`.
3. En `beforeEach`, llamar primero a `limpiarEntornoIntegracion()` y crear todos
   los fixtures del caso; en `afterEach`, llamar nuevamente a la limpieza.
4. Usar `prisma` y `redis` reales para verificar persistencia, notificaciones y
   aislamiento; no depender de datos de otra prueba.
5. Para flujos HTTP, importar `app` y usar Supertest. Para Socket.IO, registrar
   el evento con un socket falso o levantar el servidor si se necesita probar el
   transporte.
6. Documentar el identificador IT, request, actores, estado inicial, respuesta
   esperada y efectos persistidos.

Las suites rápidas con mocks pueden coexistir para feedback local, pero no
sustituyen las suites `*-real.test.ts` que corren contra PostgreSQL y Redis.

## IT de chat existentes

`mensajeria-coordinacion-real.test.ts` cubre IT-19 (historial), IT-20 (activa,
pendiente y bloqueada en REST y Socket.IO), IT-21 (cambio de vista), IT-22
(participación al crear acuerdo) e IT-23 (recordatorio de acuerdo). La prueba
de mapeo visual de IT-21 e IT-23 está en el frontend.

## Protecciones

La limpieza aborta si `NODE_ENV` no es `test`, `RUN_INTEGRATION` no es `true`,
la base no es exactamente `swap_integration_test` o las URLs no corresponden a
los hosts/puertos aislados documentados. Nunca apuntar estas variables a una
base o Redis compartidos.
