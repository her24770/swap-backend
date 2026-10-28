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

El deploy también exporta `APP_VERSION`: usa el tag `vX.Y.Z` del commit o, para
el `main` aún no publicado, calcula la misma siguiente versión que CI convertirá
en Release después del health check. La imagen la devuelve en `GET /api/health`;
un rollback recupera la versión embebida en su propia imagen.

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

## Scripts de servidor (`deploy/servidor/` y `scripts/`)

Se ejecutan a mano en el servidor; ninguno corre desde GitHub. Los que cambian
configuración del sistema piden `sudo`, hacen respaldo de lo que modifican, validan
antes de aplicar y se revierten solos si algo falla. Todos están instalados en
`/home/nandez/deploy/`.

| Script | Tarea | Qué hace |
|---|---|---|
| `liberar-disco.sh` | SWAP-668 | Borra la caché de builds y las imágenes colgantes (no toca contenedores, volúmenes ni las versiones guardadas para rollback). Ejecutado el 28/10: disco de 78 % a 35 % |
| `alerta-disco.sh` | SWAP-668 | Avisa por webhook de Discord cuando el disco pasa del 85 %. Programado cada hora en el cron de `nandez`; configuración en `/home/nandez/deploy/alertas.env` (permisos 600) |
| `nginx-swap-solo-cloudflare.sh` | SWAP-666 | El sitio de Swap solo acepta IPs de Cloudflare; espera hasta 15 s tras recargar y comprueba que lo directo da 403 y lo normal 200 |
| `nginx-servidor-por-defecto.sh` | SWAP-672 | Opcional: hosts desconocidos reciben respuesta vacía en vez de "Welcome to nginx". Toca configuración compartida, por eso compara la respuesta de todos los sitios antes y después |
| `ssh-sin-root.sh` | SWAP-670 | `PermitRootLogin no` **y** `PasswordAuthentication no`. Se llama `10-...` porque `50-cloud-init.conf` (solo legible por root) lo anulaba. Se niega a correr si el usuario no tiene llave autorizada. Mantener una sesión abierta mientras se prueba |
| `reinicios-nocturnos.sh` | SWAP-669 | Reinicio automático tras actualizaciones a las 04:00 de Guatemala (la hora se calcula según la zona horaria del servidor) |
| `activar-respaldos.sh` | SWAP-664 | Activa/desactiva los respaldos con pgBackRest (ver Backups) |
| `simulacro-rollback.sh` | SWAP-665 | `restauracion`: restaura el último respaldo en un contenedor temporal y lo compara (no afecta producción). `rollback`: vuelve a la versión anterior y regresa midiendo la caída. Guarda el informe en `mediciones/` |
| `instalar-nginx-staging.sh` | SWAP-673 | Instala el sitio de nginx de staging con respaldo y reversión |
| `scripts/probar-respaldos-r2.sh` | SWAP-664 | Prueba respaldo completo, incremental y restauración contra un bucket R2 **de prueba**, comparando los datos |
| `scripts/configurar-status-checks.sh` | SWAP-685 | Exige que el CI pase antes de mergear a develop y main. Por defecto es una simulación; `--aplicar` cambia los rulesets (con respaldo para revertir) |

Orden sugerido para un servidor nuevo: `liberar-disco.sh`, `nginx-swap-solo-cloudflare.sh`,
`ssh-sin-root.sh`, `reinicios-nocturnos.sh` y, si se quiere, `nginx-servidor-por-defecto.sh`.

## Staging (SWAP-673)

Ambiente de pruebas para validar `develop` antes de mergear a `main`, en
`https://swap-staging.jhgo.online`. El dominio es de un solo nivel a propósito: el SSL
universal de Cloudflare no cubre `swap.staging.jhgo.online`. No comparte nada con
producción: proyectos de compose `swap-staging` y `swap-staging-web`, contenedores
`swap-staging-*`, volúmenes `swap_staging_*`, puertos `127.0.0.1:3300` (web) y `3301`
(API; los 3100 y 3101 los usa uvghelp en el mismo servidor), y su propio `.env.staging`.
Reutiliza la imagen de embeddings de producción. Sin respaldos, versiones ni rollback.

Ya preparado en el servidor (28/10/2026): carpeta `/home/nandez/projects/software/swap-staging`
con los dos clones en `develop`, `swap-backend/.env.staging` con secretos aleatorios propios,
la clave de Server Actions de staging y los scripts en `/home/nandez/deploy/`.

Pasos pendientes (en este orden):

1. **Variables de prueba:** completar en `.env.staging` las vacías: `RESEND_API_KEY`,
   `OPENAI_API_KEY`, `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY`. Llaves de PRUEBA, nunca las de
   producción. Sin ellas staging funciona, pero no envía correos ni modera imágenes con IA.
2. **DNS:** en Cloudflare, registro `swap-staging` (proxied) hacia el mismo origen que `swap`.
   Recomendado: protegerlo con Cloudflare Access para que solo entre el equipo.
3. **Instalar el deploy actualizado** (ahora entiende `staging`; respaldar antes el actual):
   ```bash
   cp /home/nandez/deploy/deploy-swap.sh /home/nandez/deploy/deploy-swap.sh.respaldo-$(date +%Y%m%d)
   cp /home/nandez/projects/software/swap-staging/swap-backend/deploy/deploy-swap.sh /home/nandez/deploy/
   ```
4. **nginx:** `sudo /home/nandez/deploy/instalar-nginx-staging.sh`.
5. **Primer deploy:** `/home/nandez/deploy/deploy-staging.sh backend` y luego
   `/home/nandez/deploy/deploy-staging.sh frontend`. El backend aplica las migraciones al arrancar.
6. **Datos de prueba:** la seed necesita las herramientas de desarrollo (no están en la imagen de
   producción), por ejemplo un contenedor temporal de Node en la red `swap-staging_default`, y un
   bucket de pruebas para las imágenes de `SEED_*_KEY`.
7. **Automatizar:** crear la variable `STAGING_ACTIVO=true` en Settings → Variables de cada repo.
   Desde entonces, cada push a `develop` despliega en staging (`ci.yml` en el backend,
   `staging.yml` en el frontend).

Staging ocupa unos 1,7 GB de RAM. Para liberarla cuando no se use:
`docker compose -p swap-staging --env-file .env.staging -f docker-compose.staging.yml stop`
(y `docker compose -p swap-staging-web stop` para la web).

## Backups

Los respaldos con pgBackRest son **opcionales**: `docker-compose.prod.yml` usa el Postgres de
siempre y no exige ninguna variable `BACKUP_*`. Se activan sumando `docker-compose.respaldos.yml`,
que reemplaza Postgres por `swap-postgres:16` (la misma base pgvector más pgBackRest), archiva los
WAL en R2 y agrega el servicio `postgres-backup` (full los domingos e incremental de lunes a
sábado, a las 03:00 de Guatemala). El script de deploy suma esa capa solo si existe
`/home/nandez/deploy/respaldos.activos`. Detalle técnico en la guía de
[backups de PostgreSQL](../docs/backups-postgresql.md).

Qué se verificó (28/10/2026, con un S3 local en lugar de R2): cambiar la imagen sobre un volumen con
datos los conserva idénticos; stanza-create y check pasan; el respaldo completo, el incremental y su
reporte funcionan; y **restaurar el último respaldo en un volumen vacío devuelve las mismas filas y la
misma huella de contenido**. Lo que solo se comprueba con R2 real es el endpoint, la región y la
subida del reporte: para eso está `scripts/probar-respaldos-r2.sh`.

Cómo activarlos en producción (en este orden):

1. **Bucket de prueba:** crear en tu Cloudflare un bucket cuyo nombre contenga "prueba" y un token
   "Lectura y escritura de objetos" limitado a ese bucket. Ubicación por defecto (no UE).
2. **Probar R2 de verdad** sin tocar producción: exportar `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY` y `R2_BUCKET`, y ejecutar `./scripts/probar-respaldos-r2.sh`. Debe terminar con
   "TODO CORRECTO". Después borrar ese bucket.
3. **Bucket y token de producción** (otro bucket, por ejemplo `swap-respaldos`) y una clave de cifrado:
   `openssl rand -base64 48`. **Guardar la clave fuera del servidor y no cambiarla nunca**: queda atada
   al repositorio, y una clave de relleno como `change_me...` es pública. Cargar las cinco variables
   `BACKUP_R2_ACCOUNT_ID`, `BACKUP_R2_ACCESS_KEY_ID`, `BACKUP_R2_SECRET_ACCESS_KEY`,
   `BACKUP_R2_BUCKET_NAME` y `BACKUP_ENCRYPTION_KEY` en el `.env` del backend del servidor
   (`chmod 600`). Pedir que revoquen la llave de la otra cuenta (`swap-backup`).
4. `/home/nandez/deploy/activar-respaldos.sh preparar` (valida las variables y crea el marcador).
5. **Deploy del backend** (workflow o `deploy-swap.sh backend`). Construye la imagen de Postgres antes
   de tocar nada; si falla, producción sigue como estaba.
6. **Enseguida:** `/home/nandez/deploy/activar-respaldos.sh inicializar` (stanza-create, check y primer
   respaldo completo). Hasta ese momento Postgres archiva sin repositorio y los WAL se acumulan en disco
   (no se pierden); con 47 GB libres hay holgura, pero no lo dejes días.
7. Probar una restauración que compare datos (`scripts/probar-respaldos-r2.sh` o
   `simulacro-rollback.sh restauracion`) y repetirla cada mes.

Para desactivarlos: `activar-respaldos.sh desactivar` y un deploy del backend (los respaldos ya subidos
al bucket no se borran).
