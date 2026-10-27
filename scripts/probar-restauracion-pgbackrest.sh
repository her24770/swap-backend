#!/usr/bin/env bash

set -Eeuo pipefail

compose_file=${COMPOSE_FILE:-docker-compose.prod.yml}
compose=(docker compose -f "$compose_file")
suffix="$$-$(date +%s)"
data_volume="swap_restore_test_data_$suffix"
socket_volume="swap_restore_test_socket_$suffix"
container="swap-restore-test-$suffix"

cleanup() {
    docker rm -f "$container" >/dev/null 2>&1 || true
    docker volume rm "$data_volume" "$socket_volume" >/dev/null 2>&1 || true
}
trap cleanup EXIT

backup_label=${1:-}
if [[ -z "$backup_label" ]]; then
    backup_label=$(
        "${compose[@]}" exec -T postgres-backup pgbackrest --stanza=swap --output=json info |
            jq -er '.[0].backup | map(select(.error == null)) | last.label'
    )
fi

docker volume create "$data_volume" >/dev/null
docker volume create "$socket_volume" >/dev/null

echo "[restore-test] restaurando $backup_label en $data_volume"
"${compose[@]}" run --rm --no-deps --user postgres \
    -e RESTORE_LABEL="$backup_label" \
    -v "$data_volume:/var/lib/postgresql/data" \
    postgres-backup bash -ceu \
    'find /var/lib/postgresql/data -mindepth 1 -delete; run-pgbackrest-restore --set="$RESTORE_LABEL" --type=immediate --target-action=promote'

"${compose[@]}" run -d --name "$container" --no-deps \
    -v "$data_volume:/var/lib/postgresql/data" \
    -v "$socket_volume:/var/run/postgresql" \
    postgres -c archive_mode=off >/dev/null

for _ in {1..60}; do
    if docker exec "$container" pg_isready -U "${POSTGRES_USER:?Falta POSTGRES_USER}" -d "${POSTGRES_DB:?Falta POSTGRES_DB}" >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

docker exec "$container" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
recovery=$(docker exec "$container" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc 'select pg_is_in_recovery();')
[[ "$recovery" == f ]] || { echo "La copia restaurada continúa en recovery: $recovery" >&2; exit 1; }

echo "[restore-test] OK: $backup_label inició y aceptó consultas en un volumen temporal"
