# Deploy automático a producción

Cada push a `main` (normalmente al mergear el PR `develop` → `main`) despliega
en el servidor de Contabo:

- **swap-backend**: `.github/workflows/ci.yml`, job `deploy`. Solo corre si
  pasan lint, typecheck, pruebas unitarias y de integración.
- **swap-frontend**: `.github/workflows/deploy.yml` (también puede lanzarse a
  mano desde la pestaña Actions con *Run workflow*).

## Cómo funciona

1. GitHub Actions se conecta por SSH con una llave dedicada (secret
   `DEPLOY_SSH_KEY`). En `~/.ssh/authorized_keys` del servidor esa llave tiene
   un *forced command*: solo puede ejecutar `/home/nandez/deploy/deploy-swap.sh`,
   sin terminal ni reenvío de puertos.
2. `deploy-swap.sh <backend|frontend>`:
   - aborta si el servidor tiene cambios locales en archivos versionados;
   - hace `git merge --ff-only origin/main`;
   - en el backend, respalda la base de datos antes de cambiar nada (si el
     respaldo falla, no se despliega);
   - construye las imágenes (si el build falla, los contenedores actuales siguen
     corriendo) y luego `up -d`. En el backend, `embeddings` solo se reconstruye
     si cambió `embeddings/`: cada build genera un ID de imagen nuevo y eso haría
     que compose lo recree y que la API espere a que vuelva a estar sano;
   - etiqueta la imagen construida con el commit desplegado y conserva las
     últimas 5 versiones;
   - espera hasta 3 minutos a que el health check responda
     (`/api/health` del backend, `/` del frontend). Si no responde, vuelve sola
     a la versión anterior y el job queda en rojo.
3. Cada corrida queda registrada en `/home/nandez/deploy/logs/` en el servidor.

El backend en producción usa `docker-compose.prod.yml`, **no** `docker-compose.yml`
(ver los comentarios del archivo: los nombres de volumen son los que contienen
los datos reales). El frontend usa el `docker-compose.yml` y el `Dockerfile` que
existen solo en el servidor (están en el `.gitignore` del repo).

Antes del build manual, el dueño exporta `SOURCE_DATE_EPOCH` con la fecha del
commit. El procedimiento y la verificación por digest están en
[`docs/builds-reproducibles.md`](../docs/builds-reproducibles.md).

## Secrets de GitHub (en ambos repos)

| Secret | Contenido |
|---|---|
| `DEPLOY_HOST` | IP del servidor |
| `DEPLOY_USER` | usuario SSH |
| `DEPLOY_SSH_KEY` | llave privada dedicada al deploy |
| `DEPLOY_KNOWN_HOSTS` | huella del servidor (evita aceptar un host suplantado) |

## Versiones

Cada deploy correcto a producción queda publicado como una versión
(`vMAYOR.MENOR.PARCHE`): el job **Publicar versión** crea el tag de git y un
Release en GitHub con la lista de cambios. El número se calcula con
`.github/scripts/siguiente-version.sh` a partir de los commits nuevos:

| Commits desde la versión anterior | Sube | Ejemplo |
|---|---|---|
| Alguno con `!` antes de los dos puntos o `BREAKING CHANGE` | MAYOR | `v1.4.2` → `v2.0.0` |
| Algún `feat:` | MENOR | `v1.4.2` → `v1.5.0` |
| Cualquier otro caso (`fix:`, `docs:`, sin formato…) | PARCHE | `v1.4.2` → `v1.4.3` |

Si el deploy falla no se publica versión. El backend y el frontend llevan su
propia numeración. El campo `version` de `package.json` no se usa.

## Desplegar una versión concreta y rollback

Cada versión desplegada queda guardada como imagen (`swap-backend-api:<commit>`,
`swap-frontend-frontend:<commit>`; se conservan las últimas 5), así que volver a
una reciente no reconstruye nada: tarda lo que tarda en reiniciar el contenedor.
Una versión más antigua se reconstruye desde su tag (unos minutos).

| Situación | Qué hacer |
|---|---|
| El deploy no pasa el health check | Nada: el script vuelve solo a la versión anterior y el job queda en rojo |
| El deploy pasó pero la versión tiene un problema | GitHub → Actions → **Desplegar versión** → *Run workflow* con el campo vacío (vuelve a la anterior) |
| Quiero una versión concreta | El mismo workflow, escribiendo `v1.4.2` (o un commit) |
| Desde el servidor | `/home/nandez/deploy/deploy-swap.sh rollback backend` · `... desplegar backend v1.4.2` |
| Ver versiones y respaldos | `/home/nandez/deploy/deploy-swap.sh versiones backend` |

Solo se aceptan versiones que estén en el historial de `main`: un tag o commit
de otra rama se rechaza, para que no llegue a producción código sin revisar.
Estas operaciones **solo cambian el código**; la base de datos no se toca. El
siguiente deploy vuelve a `main` automáticamente. La imagen de `embeddings` no
se versiona: al volver a una versión guardada se mantiene la actual.

### Base de datos

Antes de cada deploy del backend se guarda un respaldo en
`/home/nandez/deploy/respaldos-bd/` (`bd-<fecha>-antes-de-<commit>.dump`, se
conservan los últimos 10). Es independiente de los backups programados en R2.

Restaurar es una decisión aparte y deliberada, porque **borra todo lo que se
guardó después del respaldo**. Solo tiene sentido si un deploy dañó los datos
(por ejemplo, una migración). Se hace a mano en el servidor, nunca desde GitHub:

```bash
/home/nandez/deploy/deploy-swap.sh restaurar-bd                 # el respaldo más reciente
/home/nandez/deploy/deploy-swap.sh restaurar-bd <archivo.dump>  # uno concreto
```

Pide escribir el nombre de la base para confirmar, guarda antes el estado
actual, detiene la API y restaura en una sola transacción (si algo falla, la
base queda como estaba).

Para que un rollback de código casi nunca necesite restaurar datos, las
migraciones deben ser compatibles hacia atrás: agregar columnas en un release
y eliminar o renombrar en uno posterior.

## Logs y límites de recursos (SWAP-667, SWAP-671)

El servidor aloja unos 25 contenedores de otros proyectos, así que cada servicio de
Swap tiene rotación de logs (10 MB × 3 archivos) y un tope de memoria y CPU en
`docker-compose.prod.yml`:

| Servicio | Memoria | CPU | Uso medido (2026-10-25) |
|---|---|---|---|
| api | 768 MB | 2 | 58 MB |
| embeddings | 2 GB | 2 | 640 MB (el arranque sube más) |
| postgres | 1 GB | 1 | 61 MB |
| redis | 256 MB (`maxmemory` 200 MB, `noeviction`) | 0,5 | 11 MB |

Los topes son techos, no reservas. Redis rechaza escrituras al llenarse en vez de
borrar claves, porque guarda tokens revocados y contadores del rate limiting. El
frontend (compose solo en el servidor) lleva `max-size: 10m`, `max-file: 3`,
`mem_limit: 512m` y `cpus: 1.0`. Cambiar estos valores recrea los contenedores en el
siguiente deploy. Para ver el consumo: `docker stats --no-stream`.

## Scripts de servidor (`deploy/servidor/`)

Se ejecutan a mano en el servidor; ninguno corre desde GitHub. Los que cambian
configuración del sistema piden `sudo`, hacen respaldo de lo que modifican, validan
antes de aplicar y se revierten solos si algo falla.

| Script | Tarea | Qué hace |
|---|---|---|
| `liberar-disco.sh` | SWAP-668 | Borra la caché de builds y las imágenes colgantes (no toca contenedores, volúmenes ni las versiones guardadas para rollback) |
| `alerta-disco.sh` | SWAP-668 | Avisa por webhook cuando el disco pasa del 85 %. Instalar en `/home/nandez/deploy/` y programar con `crontab -e`: `0 * * * * /home/nandez/deploy/alerta-disco.sh` |
| `nginx-swap-solo-cloudflare.sh` | SWAP-666 | El sitio de Swap solo acepta IPs de Cloudflare; comprueba que lo directo da 403 y lo normal 200 |
| `nginx-servidor-por-defecto.sh` | SWAP-672 | Opcional: hosts desconocidos reciben respuesta vacía en vez de "Welcome to nginx". Toca configuración compartida, por eso compara la respuesta de todos los sitios antes y después |
| `ssh-sin-root.sh` | SWAP-670 | `PermitRootLogin no`. Mantener una sesión abierta mientras se prueba |
| `reinicios-nocturnos.sh` | SWAP-669 | Reinicio automático tras actualizaciones a las 04:00 de Guatemala |

Orden sugerido: `liberar-disco.sh`, `nginx-swap-solo-cloudflare.sh`, `ssh-sin-root.sh`,
`reinicios-nocturnos.sh` y, al final y si se quiere, `nginx-servidor-por-defecto.sh`.

## Staging (SWAP-673)

Ambiente de pruebas para validar `develop` antes de mergear a `main`, en
`https://swap-staging.jhgo.online`. El dominio es de un solo nivel a propósito: el SSL
universal de Cloudflare no cubre `swap.staging.jhgo.online`. No comparte nada con
producción: proyectos de compose `swap-staging` y `swap-staging-web`, contenedores
`swap-staging-*`, volúmenes `swap_staging_*`, puertos `127.0.0.1:3100` (web) y `3101`
(API), y su propio `.env.staging`. Reutiliza la imagen de embeddings de producción.
Sin respaldos, versiones ni rollback.

Preparación inicial (una sola vez, en el servidor):

1. **DNS:** en Cloudflare, registro `swap-staging` (proxied) hacia el mismo origen que
   `swap`. Recomendado: protegerlo con Cloudflare Access para que solo entre el equipo.
2. **Clones** (el script despliega desde ellos):
   ```bash
   mkdir -p /home/nandez/projects/software/swap-staging && cd /home/nandez/projects/software/swap-staging
   git clone "$(git -C ../swap/swap-backend remote get-url origin)" swap-backend
   git clone "$(git -C ../swap/swap-frontend remote get-url origin)" swap-frontend
   ```
3. **Variables:** `cp swap-backend/deploy/staging/env.staging.example swap-backend/.env.staging`,
   `chmod 600`, y completar con secretos nuevos y llaves de prueba. Nunca los de producción.
4. **Scripts** (respaldar antes el `deploy-swap.sh` instalado; ahora delega `staging`):
   ```bash
   cp /home/nandez/deploy/deploy-swap.sh /home/nandez/deploy/deploy-swap.sh.respaldo-$(date +%Y%m%d)
   cp deploy/deploy-swap.sh deploy/deploy-staging.sh /home/nandez/deploy/
   ```
5. **nginx:** instalar `deploy/staging/nginx-swap-staging.conf` (instrucciones en el archivo).
   Requiere haber ejecutado antes `nginx-swap-solo-cloudflare.sh`, que crea el filtro de IPs.
6. **Primer deploy a mano:** `/home/nandez/deploy/deploy-swap.sh staging backend` y luego
   `... staging frontend`.
7. **Datos de prueba:** las migraciones corren solas al arrancar la API. Para cargar la seed
   hay que ejecutarla con las herramientas de desarrollo (no están en la imagen de producción),
   por ejemplo con un contenedor temporal de Node en la red `swap-staging_default`; requiere
   un bucket de pruebas para las imágenes de `SEED_*_KEY`.
8. **Automatizar:** crear la variable `STAGING_ACTIVO=true` en Settings → Variables de cada
   repo. Desde entonces, cada push a `develop` despliega en staging (`ci.yml` en el backend,
   `staging.yml` en el frontend).

Para liberar memoria cuando no se use:
`docker compose -p swap-staging --env-file .env.staging -f docker-compose.staging.yml stop`
(y `docker compose -p swap-staging-web stop` para la web).

## Backups

El servicio `postgres-backup` ejecuta pgBackRest con el mismo calendario en
desarrollo y producción: full los domingos e incremental de lunes a sábado,
siempre a las 03:00 de Guatemala. El `.env` del servidor debe definir `BACKUP_R2_*` y
`BACKUP_ENCRYPTION_KEY`. Ver la guía de
[backups de PostgreSQL](../docs/backups-postgresql.md).
