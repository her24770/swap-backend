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
   - construye las imágenes (si el build falla, los contenedores actuales siguen
     corriendo) y luego `up -d`. En el backend, `embeddings` solo se reconstruye
     si cambió `embeddings/`: cada build genera un ID de imagen nuevo y eso haría
     que compose lo recree y que la API espere a que vuelva a estar sano;
   - espera hasta 3 minutos a que el health check responda
     (`/api/health` del backend, `/` del frontend). Si no responde, el job queda
     en rojo y el log muestra el comando exacto para volver a la versión anterior.
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

## Rollback manual

```bash
cd /home/nandez/projects/software/swap/swap-backend
git checkout <commit-anterior>
docker compose -f docker-compose.prod.yml up -d --build
```

El siguiente deploy vuelve a `main` automáticamente.

## Backups

El servicio `postgres-backup` ejecuta pgBackRest con el mismo calendario en
desarrollo y producción: full los domingos e incremental de lunes a sábado,
siempre a las 03:00 de Guatemala. El `.env` del servidor debe definir `BACKUP_R2_*` y
`BACKUP_ENCRYPTION_KEY`. Ver la guía de
[backups de PostgreSQL](../docs/backups-postgresql.md).
