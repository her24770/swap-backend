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

## Pendiente

- El servicio de backups (`postgres-backup`) no está en `docker-compose.prod.yml`
  hasta que se agreguen las variables `BACKUP_R2_*` al `.env` del servidor.
