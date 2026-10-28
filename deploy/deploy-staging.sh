#!/usr/bin/env bash
# Deploy de STAGING de Swap (SWAP-673): despliega la rama develop en un ambiente
# aparte de producción para probar los releases antes de mergear a main.
#
# Se instala en /home/nandez/deploy/deploy-staging.sh. Lo ejecuta deploy-swap.sh
# (la única orden que puede lanzar la llave SSH de GitHub Actions):
#
#   deploy-swap.sh staging backend|frontend
#
# Staging NO comparte nada con producción: proyectos de compose distintos
# (swap-staging, swap-staging-web), contenedores swap-staging-*, volúmenes y red
# propios, puertos 127.0.0.1:3300 (web) y 3301 (API), y su propio .env.staging.
# No hace respaldos, versiones ni rollback: si falla, se arregla y se vuelve a
# desplegar. Preparación inicial: deploy/README.md → "Staging".
set -euo pipefail

BASE=/home/nandez/projects/software/swap-staging
RAIZ=/home/nandez/deploy
LOGS="$RAIZ/logs"
CLAVE_ACCIONES="$RAIZ/secretos/next-server-actions-staging.key"
URL_STAGING=https://swap-staging.jhgo.online

DESTINO="${1:-}"
DIR_API="$BASE/swap-backend"
case "$DESTINO" in
    backend)
        DIR="$DIR_API"
        COMPOSE=(docker compose -p swap-staging --env-file .env.staging -f docker-compose.staging.yml)
        SALUD="http://127.0.0.1:3301/api/health"
        ;;
    frontend)
        DIR="$BASE/swap-frontend"
        COMPOSE=(docker compose -p swap-staging-web -f "$DIR_API/deploy/staging/frontend-compose.yml" --project-directory "$DIR")
        SALUD="http://127.0.0.1:3300/"
        ;;
    *)
        echo "Uso: deploy-swap.sh staging backend|frontend" >&2
        exit 2
        ;;
esac

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }

mkdir -p "$LOGS"
exec > >(tee -a "$LOGS/staging-$DESTINO-$(date +%Y%m%d-%H%M%S).log") 2>&1

# Un solo deploy de staging por destino a la vez.
exec 9>"/tmp/deploy-staging-$DESTINO.lock"
if ! flock -n 9; then
    log "Ya hay un deploy de staging $DESTINO en curso; se cancela esta."
    exit 3
fi

if [ ! -d "$DIR/.git" ]; then
    log "ABORTADO: falta $DIR (clonar el repo ahí; ver deploy/README.md → Staging)."
    exit 1
fi
cd "$DIR"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    log "ABORTADO: hay cambios locales sin commitear en $DIR:"
    git status --short --untracked-files=no
    exit 4
fi

log "Staging $DESTINO en $DIR (rama develop)"
git fetch --quiet origin develop
git checkout --quiet develop
git merge --ff-only --quiet origin/develop
log "Versión: $(git rev-parse --short HEAD) ($(git log -1 --format=%s))"
export SOURCE_DATE_EPOCH="$(git log -1 --format=%ct)"

if [ "$DESTINO" = backend ]; then
    if [ ! -f .env.staging ]; then
        log "ABORTADO: falta $DIR/.env.staging (copiar deploy/staging/env.staging.example)."
        exit 1
    fi
    # Red de seguridad: staging nunca debe apuntar al dominio de producción.
    if ! grep -q '^FRONTEND_URL=.*swap-staging' .env.staging; then
        log "ABORTADO: FRONTEND_URL de .env.staging debe ser $URL_STAGING."
        exit 1
    fi
    # La imagen de embeddings (stateless, ~1 GB) se reutiliza de producción.
    if ! docker image inspect swap-backend-embeddings:latest >/dev/null 2>&1; then
        log "ABORTADO: no existe la imagen swap-backend-embeddings:latest (se crea con el deploy de producción)."
        exit 1
    fi
else
    # Clave de Server Actions propia de staging, generada una sola vez.
    if [ ! -s "$CLAVE_ACCIONES" ]; then
        mkdir -p "$(dirname "$CLAVE_ACCIONES")"
        ( umask 077; openssl rand -base64 32 > "$CLAVE_ACCIONES" )
        log "Se generó la clave de Server Actions de staging."
    fi
    export BUILD_ID="staging-$(git rev-parse --short HEAD)"
fi

# Se construye primero: si falla, el staging que corre sigue como estaba.
log "Construyendo"
if [ "$DESTINO" = backend ]; then
    "${COMPOSE[@]}" build api
else
    "${COMPOSE[@]}" build
fi

log "Levantando contenedores"
"${COMPOSE[@]}" up -d

log "Esperando health check ($SALUD)"
for _ in $(seq 1 36); do
    codigo="$(curl -s -o /dev/null -w '%{http_code}' "$SALUD" || true)"
    case "$codigo" in
        2??|3??) log "Responde HTTP $codigo"; log "Staging $DESTINO OK"; exit 0 ;;
    esac
    sleep 5
done

log "FALLÓ: sin respuesta correcta tras 3 minutos (último código: ${codigo:-ninguno})"
"${COMPOSE[@]}" ps || true
"${COMPOSE[@]}" logs --tail 60 || true
exit 1
