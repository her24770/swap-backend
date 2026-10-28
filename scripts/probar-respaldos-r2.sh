#!/usr/bin/env bash
# SWAP-664: prueba de punta a punta los respaldos con pgBackRest contra un bucket REAL de R2,
# sin tocar producción. Levanta un Postgres temporal, respalda, restaura en un volumen vacío y
# compara los datos. Usa una clave de cifrado aleatoria propia de la prueba.
#
# Requisitos: Docker (con buildx si debe construir la imagen) y un bucket de PRUEBA vacío.
# Ejecutar en el servidor o en cualquier máquina con Docker, desde la raíz del repo:
#
#   export R2_ACCOUNT_ID=...  R2_ACCESS_KEY_ID=...  R2_SECRET_ACCESS_KEY=...
#   export R2_BUCKET=swap-respaldos-prueba        # el nombre debe contener "prueba" o "test"
#   ./scripts/probar-respaldos-r2.sh
#
# Opcionales: R2_ENDPOINT (por defecto <cuenta>.r2.cloudflarestorage.com), R2_VERIFY_TLS=n,
# R2_NETWORK (red de Docker a la que unirse), IMAGEN_POSTGRES (usar una imagen ya construida).
# Los contenedores y volúmenes temporales se borran siempre; los objetos de prueba quedan en el
# bucket: bórralo al terminar. NUNCA lo apuntes al bucket de producción (la stanza chocaría).
set -Eeuo pipefail

: "${R2_ACCOUNT_ID:?Falta R2_ACCOUNT_ID}" "${R2_ACCESS_KEY_ID:?Falta R2_ACCESS_KEY_ID}"
: "${R2_SECRET_ACCESS_KEY:?Falta R2_SECRET_ACCESS_KEY}" "${R2_BUCKET:?Falta R2_BUCKET}"
case "$R2_BUCKET" in
    *prueba*|*test*) ;;
    *) echo "El bucket '$R2_BUCKET' no parece de prueba (debe contener 'prueba' o 'test'). Abortado para no mezclar con producción." >&2; exit 64 ;;
esac

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
ENDPOINT="${R2_ENDPOINT:-$R2_ACCOUNT_ID.r2.cloudflarestorage.com}"
S="$(date +%s)-$$"
PG="r2p-pg-$S"; VOL_DATOS="r2p-datos-$S"; VOL_REST="r2p-rest-$S"; REST="r2p-restaurada-$S"
CLAVE="$(openssl rand -base64 48)"
IMG="${IMAGEN_POSTGRES:-}"
RED=(); [ -n "${R2_NETWORK:-}" ] && RED=(--network "$R2_NETWORK")
PASOS=(); FALLAS=0

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
paso() { # $1 = descripción, resto = comando
    local d="$1"; shift
    if "$@" > "$TMP/paso.log" 2>&1; then PASOS+=("OK    $d"); log "OK    $d"
    else PASOS+=("FALLA $d"); FALLAS=$((FALLAS+1)); log "FALLA $d"; tail -8 "$TMP/paso.log" | sed 's/^/        /'; return 1; fi
}
TMP="$(mktemp -d)"
limpiar() { docker rm -f "$PG" "$REST" >/dev/null 2>&1 || true; docker volume rm "$VOL_DATOS" "$VOL_REST" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap limpiar EXIT

ENV_PGB=(-e PGBACKREST_PG1_USER=swap -e PGBACKREST_REPO1_S3_BUCKET="$R2_BUCKET" -e PGBACKREST_REPO1_S3_ENDPOINT="$ENDPOINT"
         -e PGBACKREST_REPO1_S3_KEY="$R2_ACCESS_KEY_ID" -e PGBACKREST_REPO1_S3_KEY_SECRET="$R2_SECRET_ACCESS_KEY"
         -e PGBACKREST_REPO1_CIPHER_PASS="$CLAVE" -e BACKUP_REPORT_ENVIRONMENT=prueba)
if [ "${R2_VERIFY_TLS:-y}" = n ]; then ENV_PGB+=(-e PGBACKREST_REPO1_STORAGE_VERIFY_TLS=n -e RCLONE_NO_CHECK_CERTIFICATE=true); fi
psql_pg() { docker exec "$PG" psql -U swap -d swap_prueba -Atc "$1"; }
psql_rest() { docker exec "$REST" psql -U swap -d swap_prueba -Atc "$1"; }
HUELLA="select md5(string_agg(texto, chr(10) order by id)) from datos_reales"

log "Endpoint: $ENDPOINT | bucket: $R2_BUCKET (clave de cifrado aleatoria solo para esta prueba)"
if [ -z "$IMG" ]; then
    docker buildx version >/dev/null 2>&1 || { echo "Este Docker no tiene buildx y la imagen necesita BuildKit. Construye la imagen en otra máquina o pasa IMAGEN_POSTGRES." >&2; exit 65; }
    IMG="swap-postgres-prueba:$S"
    paso "Construir la imagen de Postgres con pgBackRest" docker build -q -t "$IMG" "$RAIZ/docker/postgres" || exit 1
fi

paso "Levantar un Postgres temporal con archivado a R2" docker run -d --name "$PG" --memory 512m "${RED[@]}" \
    -e POSTGRES_USER=swap -e POSTGRES_PASSWORD=prueba -e POSTGRES_DB=swap_prueba "${ENV_PGB[@]}" \
    -v "$VOL_DATOS:/var/lib/postgresql/data" "$IMG" postgres -c archive_mode=on \
    -c 'archive_command=pgbackrest --stanza=swap archive-push %p' -c archive_timeout=60s || exit 1
for _ in $(seq 1 60); do docker exec "$PG" pg_isready -U swap -d swap_prueba >/dev/null 2>&1 && break; sleep 1; done
# La primera inicialización apaga y vuelve a levantar Postgres: se espera a la definitiva.
sleep 3; for _ in $(seq 1 60); do docker exec "$PG" pg_isready -U swap -d swap_prueba >/dev/null 2>&1 && break; sleep 1; done
paso "Crear 1000 filas de datos de prueba" docker exec "$PG" psql -U swap -d swap_prueba -qc \
    "create table datos_reales(id serial primary key, texto text); insert into datos_reales(texto) select repeat(md5(g::text),20) from generate_series(1,1000) g;" || exit 1

paso "stanza-create (crear el repositorio cifrado en R2)" docker exec -u postgres "$PG" pgbackrest --stanza=swap stanza-create || exit 1
paso "check (Postgres, bucket y archivado de WAL)" docker exec -u postgres "$PG" pgbackrest --stanza=swap check || exit 1
paso "Respaldo COMPLETO con el wrapper (incluye subir el reporte)" docker exec -u postgres "$PG" run-pgbackrest-backup full manual || true
psql_pg "insert into datos_reales(texto) select repeat(md5((g+5000)::text),20) from generate_series(1,500) g" >/dev/null
psql_pg "select pg_switch_wal()" >/dev/null
paso "Respaldo INCREMENTAL (tras agregar 500 filas)" docker exec -u postgres "$PG" run-pgbackrest-backup incr manual || true
FILAS_ORIG="$(psql_pg 'select count(*) from datos_reales')"; HUELLA_ORIG="$(psql_pg "$HUELLA")"

ETIQUETA="$(docker exec -u postgres "$PG" pgbackrest --stanza=swap --output=json info | python3 -c 'import sys,json; print(json.load(sys.stdin)[0]["backup"][-1]["label"])' 2>/dev/null || true)"
[ -n "$ETIQUETA" ] || { log "No hay respaldos en el catálogo"; FALLAS=$((FALLAS+1)); exit 1; }
log "Restaurando $ETIQUETA en un volumen vacío"
docker volume create "$VOL_REST" >/dev/null
paso "Restaurar el último respaldo en un volumen vacío" docker run --rm "${RED[@]}" --user postgres "${ENV_PGB[@]}" \
    -v "$VOL_REST:/var/lib/postgresql/data" --entrypoint bash "$IMG" -ceu "run-pgbackrest-restore --set=$ETIQUETA --type=immediate --target-action=promote" || exit 1
paso "Arrancar Postgres sobre la copia restaurada" docker run -d --name "$REST" --memory 512m "${RED[@]}" \
    -e POSTGRES_USER=swap -e POSTGRES_PASSWORD=prueba -e POSTGRES_DB=swap_prueba "${ENV_PGB[@]}" \
    -v "$VOL_REST:/var/lib/postgresql/data" "$IMG" postgres -c archive_mode=off || exit 1
for _ in $(seq 1 60); do docker exec "$REST" pg_isready -U swap -d swap_prueba >/dev/null 2>&1 && break; sleep 1; done
FILAS_REST="$(psql_rest 'select count(*) from datos_reales' 2>/dev/null || echo error)"; HUELLA_REST="$(psql_rest "$HUELLA" 2>/dev/null || echo error)"
EN_RECUPERACION="$(psql_rest 'select pg_is_in_recovery()' 2>/dev/null || echo error)"

echo; echo "================ RESULTADO ================"
printf '%s\n' "${PASOS[@]}"
echo "Filas      original: $FILAS_ORIG | restaurada: $FILAS_REST"
echo "Huella md5 original: $HUELLA_ORIG"
echo "           restaurada: $HUELLA_REST"
if [ "$FILAS_ORIG" = "$FILAS_REST" ] && [ "$HUELLA_ORIG" = "$HUELLA_REST" ] && [ "$EN_RECUPERACION" = f ] && [ "$FALLAS" -eq 0 ]; then
    echo "TODO CORRECTO: los respaldos en R2 funcionan y la restauración devuelve los mismos datos."
    echo "Ahora borra el bucket de prueba y crea el de producción (deploy/README.md → Backups)."
    exit 0
fi
echo "HAY FALLAS: no actives los respaldos en producción hasta resolverlo." >&2
exit 1
