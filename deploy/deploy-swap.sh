#!/usr/bin/env bash
# Deploy de Swap en el servidor de producción (Contabo).
#
# Se instala en /home/nandez/deploy/deploy-swap.sh y es el ÚNICO comando que
# puede ejecutar la llave SSH de GitHub Actions (forced command en
# ~/.ssh/authorized_keys). GitHub Actions envía el destino como comando SSH:
#     ssh deploy@servidor backend    |    ssh deploy@servidor frontend
# También puede correrse a mano:  ./deploy-swap.sh backend
set -euo pipefail

DESTINO="${SSH_ORIGINAL_COMMAND:-${1:-}}"
BASE=/home/nandez/projects/software/swap
LOGS=/home/nandez/deploy/logs

case "$DESTINO" in
    backend)
        DIR="$BASE/swap-backend"
        COMPOSE=(docker compose -f docker-compose.prod.yml)
        SALUD="http://127.0.0.1:3001/api/health"
        ;;
    frontend)
        DIR="$BASE/swap-frontend"
        COMPOSE=(docker compose)
        SALUD="http://127.0.0.1:3000/"
        ;;
    *)
        echo "Destino no permitido: '$DESTINO' (usa backend o frontend)" >&2
        exit 2
        ;;
esac

mkdir -p "$LOGS"
LOG="$LOGS/deploy-$DESTINO-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }

# Un solo deploy a la vez por destino.
exec 9>"/tmp/deploy-swap-$DESTINO.lock"
if ! flock -n 9; then
    log "Ya hay un deploy de $DESTINO en curso; se cancela este."
    exit 3
fi

cd "$DIR"
log "Deploy de $DESTINO en $DIR"

# Nunca pisar cambios locales en archivos versionados del servidor.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    log "ABORTADO: hay cambios locales sin commitear en archivos versionados:"
    git status --short --untracked-files=no
    exit 4
fi

ANTERIOR="$(git rev-parse --short HEAD)"
git fetch --quiet origin main
git checkout --quiet main
git merge --ff-only --quiet origin/main
ACTUAL="$(git rev-parse --short HEAD)"
log "Versión: $ANTERIOR -> $ACTUAL ($(git log -1 --format=%s))"

# Docker genera un ID de imagen distinto en cada build aunque todo salga de la
# caché, y compose recrea el contenedor si cambia el ID. Embeddings casi nunca
# cambia y la API espera a que esté sano para arrancar, así que solo se
# reconstruye cuando cambia su código o falta su imagen (SWAP-634).
CONSTRUIR=()
if [ "$DESTINO" = backend ]; then
    CONSTRUIR=(api)
    if ! git diff --quiet "$ANTERIOR" "$ACTUAL" -- embeddings/ \
        || ! docker image inspect swap-backend-embeddings:latest >/dev/null 2>&1; then
        CONSTRUIR+=(embeddings)
    fi
fi

# Se construye primero: si el build falla, los contenedores actuales siguen
# corriendo sin cambios.
log "Construyendo imágenes: ${CONSTRUIR[*]:-todas}"
"${COMPOSE[@]}" build "${CONSTRUIR[@]}"

log "Levantando contenedores"
"${COMPOSE[@]}" up -d

log "Esperando health check ($SALUD)"
for _ in $(seq 1 36); do
    codigo="$(curl -s -o /dev/null -w '%{http_code}' "$SALUD" || true)"
    case "$codigo" in
        2??|3??)
            log "Responde HTTP $codigo — deploy OK"
            docker image prune -f >/dev/null || true
            exit 0
            ;;
    esac
    sleep 5
done

log "FALLÓ el health check tras 3 minutos (último código: ${codigo:-ninguno})"
"${COMPOSE[@]}" ps
"${COMPOSE[@]}" logs --tail 60
log "Para volver a la versión anterior:"
log "  cd $DIR && git checkout $ANTERIOR && ${COMPOSE[*]} up -d --build"
exit 1
