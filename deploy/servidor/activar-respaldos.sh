#!/usr/bin/env bash
# SWAP-664: activa (o desactiva) los respaldos con pgBackRest en producción. Se ejecuta en
# el servidor como nandez, sin sudo. Los respaldos son OPCIONALES: sin el marcador
# /home/nandez/deploy/respaldos.activos el deploy no usa pgBackRest ni exige BACKUP_*.
#
#   activar-respaldos.sh preparar      valida el .env y crea el marcador (antes del deploy)
#   activar-respaldos.sh inicializar   crea la stanza, comprueba y hace el primer respaldo (después del deploy)
#   activar-respaldos.sh estado        muestra el estado de los respaldos
#   activar-respaldos.sh desactivar    quita el marcador (el próximo deploy vuelve al Postgres normal)
#
# Orden: 1) bucket y token propios en Cloudflare  2) variables BACKUP_* en el .env del backend
#        3) preparar  4) deploy (workflow o deploy-swap.sh backend)  5) inicializar
# Tras el paso 4 y hasta el 5, Postgres archiva sin repositorio: los WAL se acumulan en disco
# (no se pierden). Haz el 5 enseguida.
set -euo pipefail

ENV_FILE="${ENV_FILE:-/home/nandez/projects/software/swap/swap-backend/.env}"
RAIZ="${RAIZ:-/home/nandez/deploy}"
MARCADOR="$RAIZ/respaldos.activos"
DIR_BACKEND="${DIR_BACKEND:-/home/nandez/projects/software/swap/swap-backend}"
CONTENEDOR=swap-postgres-backup

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
falla() { log "ERROR: $*"; exit 1; }
valor() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true; }

preparar() {
    [ -f "$ENV_FILE" ] || falla "no existe $ENV_FILE"
    local faltan=() v
    for v in BACKUP_R2_ACCOUNT_ID BACKUP_R2_ACCESS_KEY_ID BACKUP_R2_SECRET_ACCESS_KEY BACKUP_R2_BUCKET_NAME BACKUP_ENCRYPTION_KEY; do
        [ -n "$(valor $v)" ] || faltan+=("$v")
    done
    [ "${#faltan[@]}" -eq 0 ] || falla "faltan en el .env del backend: ${faltan[*]}"

    local clave bucket
    clave="$(valor BACKUP_ENCRYPTION_KEY)"; bucket="$(valor BACKUP_R2_BUCKET_NAME)"
    case "$clave" in
        *change_me*|*cambiar*|*changeme*|*example*|*ejemplo*)
            falla "BACKUP_ENCRYPTION_KEY es un valor de relleno. Genera una real: openssl rand -base64 48" ;;
    esac
    [ "${#clave}" -ge 32 ] || falla "BACKUP_ENCRYPTION_KEY es demasiado corta (${#clave}); usa: openssl rand -base64 48"
    if [ "$bucket" = swap-backup ] && [ "${1:-}" != --forzar ]; then
        falla "el bucket 'swap-backup' es el de la OTRA cuenta de Cloudflare. Usa tu propio bucket (o --forzar si de verdad es el tuyo)."
    fi
    [ -f "$DIR_BACKEND/docker-compose.respaldos.yml" ] || log "AVISO: el servidor todavía no tiene docker-compose.respaldos.yml (falta el release a main); el deploy fallará hasta entonces."

    : > "$MARCADOR"
    log "OK: variables válidas (clave de ${#clave} caracteres, bucket '$bucket'). Marcador creado: $MARCADOR"
    log "Guarda BACKUP_ENCRYPTION_KEY FUERA del servidor (gestor de contraseñas): sin ella no se puede restaurar, y no se cambia después."
    log "Siguiente: haz el deploy del backend y, apenas termine, ejecuta: $0 inicializar"
}

en_contenedor() { docker exec -u postgres "$CONTENEDOR" "$@"; }

inicializar() {
    [ -f "$MARCADOR" ] || falla "no existe el marcador; ejecuta primero: $0 preparar (y haz el deploy)"
    docker ps --format '{{.Names}}' | grep -qx "$CONTENEDOR" || falla "no corre $CONTENEDOR: el deploy con la capa de respaldos aún no se hizo"
    [ "$(docker inspect -f '{{.Config.Image}}' swap-postgres)" = swap-postgres:16 ] || falla "swap-postgres todavía no usa la imagen swap-postgres:16"
    [ "$(docker exec swap-postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "show archive_mode"')" = on ] || falla "archive_mode no está en 'on'"

    log "1/4 Creando la stanza"
    en_contenedor pgbackrest --stanza=swap stanza-create
    log "2/4 Comprobando conexión a Postgres, al bucket y al archivado de WAL"
    en_contenedor pgbackrest --stanza=swap check
    log "3/4 Primer respaldo completo (con reporte)"
    en_contenedor run-pgbackrest-backup full manual
    log "4/4 Estado"
    en_contenedor pgbackrest --stanza=swap info
    log "Listo. Siguiente: probar una restauración que compare datos (scripts/probar-respaldos-r2.sh o simulacro-rollback.sh restauracion)."
}

estado() {
    log "marcador: $([ -f "$MARCADOR" ] && echo ACTIVO || echo 'no hay (respaldos desactivados)')"
    if docker ps --format '{{.Names}}' | grep -qx "$CONTENEDOR"; then
        en_contenedor pgbackrest --stanza=swap info || true
        log "WAL esperando archivarse: $(docker exec swap-postgres sh -c 'ls /var/lib/postgresql/data/pg_wal/archive_status 2>/dev/null | grep -c ready' || true)"
    else
        log "el contenedor $CONTENEDOR no está corriendo"
    fi
    log "disco: $(df -h / | tail -1 | tr -s ' ' | cut -d' ' -f3,5)"
}

desactivar() {
    rm -f "$MARCADOR"
    log "Marcador eliminado. El próximo deploy del backend vuelve al Postgres normal (sin archivado)."
    log "Los respaldos ya subidos al bucket NO se borran."
}

case "${1:-}" in
    preparar) shift; preparar "$@" ;;
    inicializar) inicializar ;;
    estado) estado ;;
    desactivar) desactivar ;;
    *) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
