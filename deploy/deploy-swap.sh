#!/usr/bin/env bash
# Deploy y rollback de Swap en el servidor de producción (Contabo).
#
# Se instala en /home/nandez/deploy/deploy-swap.sh y es el ÚNICO comando que
# puede ejecutar la llave SSH de GitHub Actions (forced command en
# ~/.ssh/authorized_keys). GitHub Actions envía la orden como comando SSH.
#
#   deploy-swap.sh backend|frontend               despliega la última versión de main
#   deploy-swap.sh rollback backend|frontend [v]  vuelve a la versión anterior (o a la v indicada)
#   deploy-swap.sh desplegar backend|frontend <v> pone en producción una versión concreta de main
#   deploy-swap.sh versiones backend|frontend     lista las versiones y respaldos disponibles
#   deploy-swap.sh restaurar-bd [archivo]         restaura la base de datos (solo a mano, destructivo)
#   deploy-swap.sh staging backend|frontend       despliega develop en staging (ver deploy-staging.sh)
#
# Una versión <v> es un nombre publicado (v1.4.2) o un commit (623f3dc).
#
# Respaldos con pgBackRest (opcionales): si existe /home/nandez/deploy/respaldos.activos,
# el backend se levanta con docker-compose.prod.yml + docker-compose.respaldos.yml.
# Sin ese marcador (el estado normal hoy) no se usa pgBackRest ni se exige ninguna
# variable BACKUP_*. Ver deploy/README.md → Backups para activarlos.
set -euo pipefail

BASE=/home/nandez/projects/software/swap
RAIZ=/home/nandez/deploy
LOGS="$RAIZ/logs"
ESTADO="$RAIZ/estado"
RESPALDOS_BD="$RAIZ/respaldos-bd"
VERSIONES_A_CONSERVAR=5
RESPALDOS_A_CONSERVAR=10
PG_CONTENEDOR=swap-postgres

# Por SSH la orden llega completa en SSH_ORIGINAL_COMMAND; a mano, en los argumentos.
REMOTO=false
if [ -n "${SSH_ORIGINAL_COMMAND:-}" ]; then
    REMOTO=true
    read -r -a ARGS <<< "$SSH_ORIGINAL_COMMAND"
else
    ARGS=("$@")
fi

# Staging (SWAP-673) lo atiende su propio script: nada de producción interviene.
if [ "${ARGS[0]:-}" = staging ]; then
    exec "$RAIZ/deploy-staging.sh" "${ARGS[@]:1}"
fi

ACCION=deploy
case "${ARGS[0]:-}" in
    rollback|desplegar|versiones|restaurar-bd) ACCION="${ARGS[0]}"; ARGS=("${ARGS[@]:1}") ;;
esac
[ "$ACCION" = restaurar-bd ] && DESTINO=backend || DESTINO="${ARGS[0]:-}"
EXTRA="${ARGS[1]:-}"
[ "$ACCION" = restaurar-bd ] && EXTRA="${ARGS[0]:-}"

case "$DESTINO" in
    backend)
        DIR="$BASE/swap-backend"
        COMPOSE=(docker compose -f docker-compose.prod.yml)
        if [ -f "$RAIZ/respaldos.activos" ]; then
            COMPOSE+=(-f docker-compose.respaldos.yml)
        fi
        SALUD="http://127.0.0.1:3001/api/health"
        IMAGEN=swap-backend-api
        ;;
    frontend)
        DIR="$BASE/swap-frontend"
        COMPOSE=(docker compose)
        SALUD="http://127.0.0.1:3000/"
        IMAGEN=swap-frontend-frontend
        ;;
    *)
        echo "Orden no permitida: '${SSH_ORIGINAL_COMMAND:-$*}' (usa backend o frontend)" >&2
        exit 2
        ;;
esac

# Una restauración de datos nunca debe poder lanzarse desde GitHub Actions.
if [ "$ACCION" = restaurar-bd ] && [ "$REMOTO" = true ]; then
    echo "restaurar-bd solo puede ejecutarse a mano en el servidor." >&2
    exit 2
fi

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
existe_imagen() { docker image inspect "$1" >/dev/null 2>&1; }

construir() {
    if [ "$DESTINO" = frontend ]; then
        "${COMPOSE[@]}" build \
            --build-arg "BUILD_ID=$BUILD_ID" \
            --build-arg "SOURCE_DATE_EPOCH=$SOURCE_DATE_EPOCH" "$@"
    else
        "${COMPOSE[@]}" build "$@"
    fi
}

verificar_digest_frontend() {
    local build_id primero segundo
    primero="$(docker image inspect "$IMAGEN:$1" --format '{{.Id}}')"
    build_id="$(docker run --rm --entrypoint cat "$IMAGEN:$1" .next/BUILD_ID)"
    if [ "$build_id" != "$BUILD_ID" ]; then
        log "BUILD_ID incorrecto: $build_id != $BUILD_ID"
        return 1
    fi
    log "Verificando build reproducible del frontend (sin caché)"
    construir --no-cache
    segundo="$(docker image inspect "$IMAGEN:latest" --format '{{.Id}}')"
    if [ "$primero" != "$segundo" ]; then
        log "Build no reproducible: $primero != $segundo"
        return 1
    fi
    log "Digest reproducible: $primero"
}

# Nombre publicado (vX.Y.Z) de un commit, si tiene; si no, el propio commit.
nombre_version() {
    local nombre
    nombre="$(git -C "$DIR" tag --points-at "$1" 2>/dev/null | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1 || true)"
    echo "${nombre:-$1}"
}

version_para_build() {
    local objetivo="$1" publicada
    publicada="$(nombre_version "$objetivo")"
    if [ "$publicada" != "$objetivo" ]; then
        echo "$publicada"
    elif [ "$objetivo" = "$(git -C "$DIR" rev-parse origin/main)" ] \
        && [ -x "$DIR/.github/scripts/siguiente-version.sh" ]; then
        bash "$DIR/.github/scripts/siguiente-version.sh"
    else
        git -C "$DIR" rev-parse --short "$objetivo"
    fi
}

versiones_disponibles() {
    docker image ls "$IMAGEN" --format '{{.CreatedAt}}\t{{.Tag}}' \
        | awk -F'\t' '$2 ~ /^[0-9a-f]{7,40}$/' | sort -r | cut -f2
}

if [ "$ACCION" = versiones ]; then
    git -C "$DIR" fetch --quiet --tags origin main 2>/dev/null || true
    en_uso="$(cat "$ESTADO/$DESTINO.actual" 2>/dev/null || true)"
    previa="$(cat "$ESTADO/$DESTINO.anterior" 2>/dev/null || true)"
    describir() {
        [ -z "$1" ] && { echo "$2"; return; }
        local nombre; nombre="$(nombre_version "$1")"
        [ "$nombre" = "$1" ] && echo "$1" || echo "$nombre ($1)"
    }
    echo "Versión en uso: $(describir "$en_uso" desconocida)"
    echo "Versión anterior: $(describir "$previa" ninguna)"
    echo "Guardadas en el servidor (rollback inmediato, más reciente primero):"
    for v in $(versiones_disponibles); do
        printf '  %-9s %s  %s\n' "$(nombre_version "$v")" "$v" "$(git -C "$DIR" log -1 --format='%ad %s' --date=short "$v" 2>/dev/null | cut -c1-70)"
    done
    echo "Todas las versiones publicadas (las no guardadas se reconstruyen al desplegarlas):"
    git -C "$DIR" tag -l 'v[0-9]*' --merged origin/main --sort=-v:refname | head -15 | sed 's/^/  /' 
    if [ "$DESTINO" = backend ]; then
        echo "Respaldos de la base de datos:"
        ls -1t "$RESPALDOS_BD"/*.dump 2>/dev/null | head -"$RESPALDOS_A_CONSERVAR" | sed 's/^/  /' || true
    fi
    exit 0
fi

mkdir -p "$LOGS" "$ESTADO"
LOG="$LOGS/$ACCION-$DESTINO-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1

# Un solo deploy, rollback o restauración a la vez por destino.
exec 9>"/tmp/deploy-swap-$DESTINO.lock"
if ! flock -n 9; then
    log "Ya hay una operación de $DESTINO en curso; se cancela esta."
    exit 3
fi

cd "$DIR"

esperar_salud() {
    local codigo=""
    log "Esperando health check ($SALUD)"
    for _ in $(seq 1 36); do
        codigo="$(curl -s -o /dev/null -w '%{http_code}' "$SALUD" || true)"
        case "$codigo" in
            2??|3??) log "Responde HTTP $codigo"; return 0 ;;
        esac
        sleep 5
    done
    log "Sin respuesta correcta tras 3 minutos (último código: ${codigo:-ninguno})"
    return 1
}

guardar_estado() {
    # $1 = versión en uso, $2 = versión a la que se puede volver
    echo "$1" > "$ESTADO/$DESTINO.actual"
    [ "$1" != "$2" ] && echo "$2" > "$ESTADO/$DESTINO.anterior"
    return 0
}

# Pone en marcha una versión ya construida, sin reconstruir nada.
activar_version() {
    local version="$1"
    git checkout --quiet --detach "$version" \
        && docker tag "$IMAGEN:$version" "$IMAGEN:latest" \
        && "${COMPOSE[@]}" up -d --no-build
}

respaldar_bd() {
    # $1 = texto que identifica el motivo en el nombre del archivo
    mkdir -p "$RESPALDOS_BD"; chmod 700 "$RESPALDOS_BD"
    local archivo="$RESPALDOS_BD/bd-$(date +%Y%m%d-%H%M%S)-$1.dump"
    # Un respaldo que pg_restore no puede leer no sirve: se valida antes de seguir.
    if ! ( umask 077
           docker exec "$PG_CONTENEDOR" sh -c \
               'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' > "$archivo" ) \
        || ! docker exec -i "$PG_CONTENEDOR" pg_restore --list < "$archivo" >/dev/null; then
        rm -f "$archivo"
        log "ABORTADO: no se pudo respaldar la base de datos; no se cambió nada."
        exit 5
    fi
    log "Respaldo de la base de datos: $archivo ($(du -h "$archivo" | cut -f1))"
    ls -1t "$RESPALDOS_BD"/*.dump | tail -n +"$((RESPALDOS_A_CONSERVAR + 1))" | xargs -r rm -f
    ULTIMO_RESPALDO="$archivo"
}

# Con los respaldos activos, el commit que se va a poner en marcha debe traer su capa de
# compose; si no (una versión anterior a esta función), se aborta ANTES de tocar nada.
exigir_capa_respaldos() {
    # $1 = commit o rama que se pondrá en marcha
    [ "$DESTINO" = backend ] && [ -f "$RAIZ/respaldos.activos" ] || return 0
    if ! git cat-file -e "$1:docker-compose.respaldos.yml" 2>/dev/null; then
        log "ABORTADO: existe $RAIZ/respaldos.activos pero '$1' no trae docker-compose.respaldos.yml."
        log "Para esa versión desactiva los respaldos (borra el marcador) o elige una versión más reciente."
        exit 1
    fi
}

exigir_arbol_limpio() {
    if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
        log "ABORTADO: hay cambios locales sin commitear en archivos versionados:"
        git status --short --untracked-files=no
        exit 4
    fi
}

# ── Restauración de la base de datos (manual) ───────────────────────────────
if [ "$ACCION" = restaurar-bd ]; then
    ARCHIVO="${EXTRA:-$(ls -1t "$RESPALDOS_BD"/*.dump 2>/dev/null | head -1)}"
    case "$ARCHIVO" in */*) ;; *) ARCHIVO="$RESPALDOS_BD/$ARCHIVO" ;; esac
    if [ ! -f "$ARCHIVO" ]; then
        log "No existe el respaldo '$ARCHIVO'."; exit 1
    fi
    docker exec -i "$PG_CONTENEDOR" pg_restore --list < "$ARCHIVO" >/dev/null
    BD="$(docker exec "$PG_CONTENEDOR" sh -c 'printf %s "$POSTGRES_DB"')"
    log "Se va a REEMPLAZAR la base '$BD' con: $ARCHIVO"
    log "Todo lo guardado después de ese respaldo se perderá."
    printf "Escribe el nombre de la base para confirmar: "
    read -r confirmacion
    if [ "$confirmacion" != "$BD" ]; then
        log "CANCELADO: la confirmación no coincide."; exit 1
    fi
    respaldar_bd "antes-de-restaurar"
    log "Deteniendo la API para que nadie escriba durante la restauración"
    "${COMPOSE[@]}" stop api
    # En una sola transacción: si algo falla, la base queda exactamente como estaba.
    RESTAURADA=true
    docker exec -i "$PG_CONTENEDOR" sh -c \
        'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --single-transaction --no-owner --no-acl' \
        < "$ARCHIVO" || RESTAURADA=false
    if [ "$RESTAURADA" = true ]; then log "Base restaurada"; else log "FALLÓ la restauración: la base no cambió"; fi
    "${COMPOSE[@]}" start api
    if esperar_salud && [ "$RESTAURADA" = true ]; then
        log "Restauración completa. El estado previo quedó en: $ULTIMO_RESPALDO"
        exit 0
    fi
    exit 1
fi

# ── Rollback y despliegue de una versión concreta ───────────────────────────
if [ "$ACCION" = rollback ] || [ "$ACCION" = desplegar ]; then
    git fetch --quiet --tags origin main || log "Aviso: no se pudo actualizar la lista de versiones desde GitHub."
    PEDIDA="${EXTRA:-$(cat "$ESTADO/$DESTINO.anterior" 2>/dev/null || true)}"
    if ! [[ "$PEDIDA" =~ ^(v[0-9]+\.[0-9]+\.[0-9]+|[0-9a-f]{7,40})$ ]]; then
        log "Falta la versión o no es válida: '${PEDIDA}' (usa un nombre como v1.4.2 o un commit)."
        log "Guardadas en el servidor: $(versiones_disponibles | tr '\n' ' ')"
        exit 1
    fi
    OBJETIVO="$(git rev-parse --short "$PEDIDA^{commit}" 2>/dev/null || true)"
    if [ -z "$OBJETIVO" ]; then
        log "No existe la versión '$PEDIDA'."
        exit 1
    fi
    # Solo código que pasó por main: un tag o commit de otra rama no se despliega.
    if ! git merge-base --is-ancestor "$OBJETIVO" origin/main; then
        log "RECHAZADO: '$PEDIDA' no pertenece al historial de main."
        exit 1
    fi
    exigir_arbol_limpio
    exigir_capa_respaldos "$OBJETIVO"
    EN_USO="$(git rev-parse --short HEAD)"
    log "$ACCION de $DESTINO: $(nombre_version "$EN_USO") -> $(nombre_version "$OBJETIVO") ($(git log -1 --format=%s "$OBJETIVO"))"
    log "Solo cambia el código; la base de datos no se restaura."
    ULTIMO_RESPALDO=""
    [ "$DESTINO" = backend ] && respaldar_bd "antes-de-$OBJETIVO"

    if ! existe_imagen "$IMAGEN:$OBJETIVO"; then
        log "No hay imagen guardada de esa versión: se reconstruye (puede tardar unos minutos)."
        git checkout --quiet --detach "$OBJETIVO"
        export SOURCE_DATE_EPOCH="$(git log -1 --format=%ct)"
        export APP_VERSION="$(version_para_build "$OBJETIVO")"
        export BUILD_ID="$(git rev-parse "$OBJETIVO^{commit}")"
        CONSTRUIR=()
        if [ "$DESTINO" = backend ]; then
            CONSTRUIR=(api)
            git diff --quiet "$EN_USO" "$OBJETIVO" -- embeddings/ || CONSTRUIR+=(embeddings)
        fi
        if ! construir "${CONSTRUIR[@]}"; then
            git checkout --quiet --detach "$EN_USO"
            log "FALLÓ la construcción; producción sigue en $(nombre_version "$EN_USO") sin cambios."
            exit 1
        fi
        docker tag "$IMAGEN:latest" "$IMAGEN:$OBJETIVO"
    fi

    if activar_version "$OBJETIVO" && esperar_salud; then
        guardar_estado "$OBJETIVO" "$EN_USO"
        log "OK: producción está en $(nombre_version "$OBJETIVO"). El próximo deploy vuelve a main."
        exit 0
    fi
    "${COMPOSE[@]}" ps || true
    "${COMPOSE[@]}" logs --tail 60 || true
    log "FALLÓ $(nombre_version "$OBJETIVO")."
    if [ "$EN_USO" != "$OBJETIVO" ] && existe_imagen "$IMAGEN:$EN_USO"; then
        log "Se vuelve a $(nombre_version "$EN_USO")"
        if activar_version "$EN_USO" && esperar_salud; then
            log "Producción volvió a $(nombre_version "$EN_USO")."
        else
            log "TAMBIÉN falló volver: producción necesita atención manual."
        fi
    fi
    exit 1
fi

# ── Deploy ──────────────────────────────────────────────────────────────────
log "Deploy de $DESTINO en $DIR"
exigir_arbol_limpio

ANTERIOR="$(git rev-parse --short HEAD)"
git fetch --quiet --tags origin main
exigir_capa_respaldos origin/main
git checkout --quiet main
git merge --ff-only --quiet origin/main
ACTUAL="$(git rev-parse --short HEAD)"
log "Versión: $ANTERIOR -> $ACTUAL ($(git log -1 --format=%s))"

# La imagen que corre hoy se conserva con su versión para poder volver a ella.
if ! existe_imagen "$IMAGEN:$ANTERIOR" && existe_imagen "$IMAGEN:latest"; then
    docker tag "$IMAGEN:latest" "$IMAGEN:$ANTERIOR"
fi

# Si el respaldo falla no se despliega: todavía no se ha tocado nada.
ULTIMO_RESPALDO=""
if [ "$DESTINO" = backend ]; then
    respaldar_bd "antes-de-$ACTUAL"
fi

# Todos los builds del commit usan el mismo origen temporal.
export SOURCE_DATE_EPOCH="$(git log -1 --format=%ct)"
export APP_VERSION="$(version_para_build "$ACTUAL")"
export BUILD_ID="$(git rev-parse HEAD)"

# Embeddings casi nunca cambia y la API espera a que esté sano para arrancar,
# así que solo se reconstruye cuando cambia su código o falta su imagen (SWAP-634).
CONSTRUIR=()
if [ "$DESTINO" = backend ]; then
    CONSTRUIR=(api postgres)
    if ! git diff --quiet "$ANTERIOR" "$ACTUAL" -- embeddings/ \
        || ! existe_imagen swap-backend-embeddings:latest; then
        CONSTRUIR+=(embeddings)
    fi
fi

# Se construye primero: si el build falla, los contenedores actuales siguen
# corriendo sin cambios.
log "Construyendo imágenes: ${CONSTRUIR[*]:-todas}"
construir "${CONSTRUIR[@]}"
docker tag "$IMAGEN:latest" "$IMAGEN:$ACTUAL"

log "Levantando contenedores"
"${COMPOSE[@]}" up -d

if esperar_salud \
    && { [ "$DESTINO" != frontend ] || verificar_digest_frontend "$ACTUAL"; }; then
    guardar_estado "$ACTUAL" "$ANTERIOR"
    # Se conservan las últimas versiones; nunca se borra la actual ni la anterior.
    for v in $(versiones_disponibles | tail -n +"$((VERSIONES_A_CONSERVAR + 1))"); do
        if [ "$v" != "$ACTUAL" ] && [ "$v" != "$ANTERIOR" ]; then
            docker rmi "$IMAGEN:$v" >/dev/null 2>&1 || true
        fi
    done
    docker image prune -f >/dev/null || true
    log "Deploy OK"
    exit 0
fi

log "FALLÓ el deploy de $ACTUAL"
"${COMPOSE[@]}" ps || true
"${COMPOSE[@]}" logs --tail 60 || true

if [ "$ANTERIOR" != "$ACTUAL" ] && existe_imagen "$IMAGEN:$ANTERIOR"; then
    log "Rollback automático a $ANTERIOR (solo código; la base de datos no se toca)"
    if activar_version "$ANTERIOR" && esperar_salud; then
        guardar_estado "$ANTERIOR" "$ANTERIOR"
        log "Producción volvió a $ANTERIOR. El deploy de $ACTUAL queda como fallido."
    else
        log "El rollback automático TAMBIÉN falló: producción necesita atención manual."
    fi
    [ -n "$ULTIMO_RESPALDO" ] && log "Respaldo de la base previo al deploy: $ULTIMO_RESPALDO"
else
    log "No hay una versión anterior guardada para volver automáticamente."
fi
exit 1
