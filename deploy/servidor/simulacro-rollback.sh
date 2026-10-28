#!/usr/bin/env bash
# SWAP-665: simulacro de rollback y de restauración, con mediciones para la bitácora.
# Se ejecuta en el servidor como nandez, sin sudo.
#
#   simulacro-rollback.sh restauracion   restaura el respaldo previo al deploy más reciente en un
#                                        contenedor temporal y lo compara con la base real.
#                                        NO afecta a producción.
#   simulacro-rollback.sh rollback [--si]  vuelve a la versión anterior y regresa a la actual,
#                                        midiendo la caída de la API. Provoca unos segundos de
#                                        caída DOS veces: hazlo en un horario de poco uso.
#   simulacro-rollback.sh todo [--si]    las dos cosas
#
# Guarda el informe en /home/nandez/deploy/mediciones/ para pegarlo en Jira.
set -uo pipefail

RAIZ="${RAIZ:-/home/nandez/deploy}"
DEPLOY="${DEPLOY:-$RAIZ/deploy-swap.sh}"
ESTADO="${ESTADO:-$RAIZ/estado}"
MEDICIONES="${MEDICIONES:-$RAIZ/mediciones}"
URL_LOCAL="${URL_LOCAL:-http://127.0.0.1:3001/api/health}"
URL_PUBLICA="${URL_PUBLICA:-https://swap.jhgo.online/api/health}"
RESPALDOS="${RESPALDOS:-$RAIZ/respaldos-bd}"
IMG_PG="${IMG_PG:-pgvector/pgvector:pg16@sha256:7b822b0aac60967beb1ea5e576b8602c94c300a157d187f385ae3e0da199b90a}"
INFORME="$MEDICIONES/simulacro-$(date +%Y%m%d-%H%M%S).txt"
mkdir -p "$MEDICIONES"

salida() { printf '%s\n' "$*" | tee -a "$INFORME"; }
log() { salida "[$(date +%H:%M:%S)] $*"; }

# ── Sondeo de disponibilidad en segundo plano ───────────────────────────────
sondear() { # $1 url, $2 archivo
    local parar="$2.parar"; rm -f "$parar" "$2"
    ( while [ ! -f "$parar" ]; do
          c="$(curl -sk -m 2 -o /dev/null -w '%{http_code}' "$1" 2>/dev/null || true)"; [ -n "$c" ] || c=000
          echo "$(date +%s.%N) $c" >> "$2"; sleep 0.2
      done ) &
    PID_SONDEO=$!
}
detener_sondeo() { touch "$1.parar"; wait "$PID_SONDEO" 2>/dev/null || true; }
caida() { # $1 archivo -> "<total_s> <sondeos_fallidos> <detalle>"; cada interrupción se mide por separado
    python3 - "$1" <<'PY'
import sys
filas=[(float(l.split()[0]), l.split()[1].startswith(("2","3"))) for l in open(sys.argv[1]) if len(l.split())==2]
cortes=[]; ini=None; fallos=0
for t,ok in filas:
    if not ok:
        fallos+=1
        if ini is None: ini=t
    elif ini is not None:
        cortes.append(t-ini); ini=None
if ini is not None and filas: cortes.append(filas[-1][0]-ini)
det=" + ".join(f"{c:.1f}s" for c in cortes) or "ninguna"
print(f"{sum(cortes):.1f} {fallos} {len(cortes)} interrupción(es): {det}")
PY
}

fase_rollback() {
    local actual anterior
    actual="$(cat "$ESTADO/backend.actual" 2>/dev/null || true)"; anterior="$(cat "$ESTADO/backend.anterior" 2>/dev/null || true)"
    [ -n "$actual" ] && [ -n "$anterior" ] && [ "$actual" != "$anterior" ] || { log "No hay una versión anterior guardada distinta de la actual; no se puede simular."; return 1; }
    log "== ROLLBACK: $actual -> $anterior -> $actual"
    if [ "${CONFIRMADO:-no}" != si ]; then
        read -r -p "Esto cortará la API unos segundos DOS veces. Escribe SI para continuar: " r
        [ "$r" = SI ] || { log "Cancelado."; return 1; }
    fi
    local t0 t1
    sondear "$URL_LOCAL" /tmp/sondeo-local.txt; local p1=$PID_SONDEO
    sondear "$URL_PUBLICA" /tmp/sondeo-publica.txt; local p2=$PID_SONDEO

    log "1/2 Volviendo a $anterior ($DEPLOY rollback backend)"
    t0=$(date +%s.%N); "$DEPLOY" rollback backend >> "$INFORME" 2>&1; local rc1=$?; t1=$(date +%s.%N)
    local d1; d1="$(python3 -c "print(f'{$t1-$t0:.1f}')")"
    log "    resultado del rollback: código $rc1, duración del comando: ${d1}s"
    sleep 3
    log "2/2 Regresando a $actual ($DEPLOY desplegar backend $actual)"
    t0=$(date +%s.%N); "$DEPLOY" desplegar backend "$actual" >> "$INFORME" 2>&1; local rc2=$?; t1=$(date +%s.%N)
    local d2; d2="$(python3 -c "print(f'{$t1-$t0:.1f}')")"
    log "    resultado de volver: código $rc2, duración del comando: ${d2}s"
    sleep 3
    PID_SONDEO=$p1; detener_sondeo /tmp/sondeo-local.txt; PID_SONDEO=$p2; detener_sondeo /tmp/sondeo-publica.txt
    local rl rp; rl="$(caida /tmp/sondeo-local.txt)"; rp="$(caida /tmp/sondeo-publica.txt)"
    salida ""
    salida "Caída medida (sondeo cada 0,2 s; el rollback y el regreso cuentan por separado):"
    salida "  API directa (127.0.0.1): ${rl#* * }  [total ${rl%% *}s, $(echo "$rl" | cut -d' ' -f2) sondeos fallidos]"
    salida "  Por Cloudflare:          ${rp#* * }  [total ${rp%% *}s, $(echo "$rp" | cut -d' ' -f2) sondeos fallidos]"
    salida "Versión final en uso: $(cat "$ESTADO/backend.actual")  (debe ser $actual)"
    [ "$rc1" = 0 ] && [ "$rc2" = 0 ] && [ "$(cat "$ESTADO/backend.actual")" = "$actual" ] || { log "ATENCIÓN: algo no salió como se esperaba; revisa el informe."; return 1; }
}

fase_restauracion() {
    local f; f="$(ls -1t "$RESPALDOS"/*.dump 2>/dev/null | head -1)"
    [ -n "$f" ] || { log "No hay respaldos en $RESPALDOS."; return 1; }
    log "== RESTAURACIÓN de $(basename "$f") ($(du -h "$f" | cut -f1)) en un contenedor temporal"
    docker rm -f restore-drill >/dev/null 2>&1 || true
    docker run -d --name restore-drill --memory 512m --cpus 1 -e POSTGRES_PASSWORD=simulacro -e POSTGRES_DB=simulacro "$IMG_PG" >/dev/null || return 1
    trap 'docker rm -f restore-drill >/dev/null 2>&1 || true' RETURN
    for _ in $(seq 1 30); do docker exec restore-drill pg_isready -U postgres -d simulacro >/dev/null 2>&1 && break; sleep 1; done
    local t0 t1 rc
    t0=$(date +%s.%N); docker exec -i restore-drill pg_restore -U postgres -d simulacro --no-owner --no-acl --exit-on-error < "$f" > /tmp/restore-drill.log 2>&1; rc=$?; t1=$(date +%s.%N)
    log "    pg_restore: código $rc en $(python3 -c "print(f'{$t1-$t0:.1f}')")s"
    [ "$rc" = 0 ] || { tail -5 /tmp/restore-drill.log | tee -a "$INFORME"; return 1; }
    local tablas dif=0 tot=0 t r p
    tablas="$(docker exec restore-drill psql -U postgres -d simulacro -At -c "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1")"
    for t in $tablas; do
        r="$(docker exec restore-drill psql -U postgres -d simulacro -At -c "select count(*) from \"$t\"")"
        p="$(docker exec swap-postgres sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -At -c 'select count(*) from \"$t\"'")"
        tot=$((tot+1)); [ "$r" = "$p" ] || { dif=$((dif+1)); salida "    $t: respaldo=$r producción ahora=$p"; }
    done
    salida "    tablas restauradas y comparadas: $tot | con filas distintas respecto a hoy: $dif (esperable si hubo actividad desde el respaldo)"
}

case "${1:-}" in
    restauracion) fase_restauracion ;;
    rollback) [ "${2:-}" = --si ] && CONFIRMADO=si; fase_rollback ;;
    todo) [ "${2:-}" = --si ] && CONFIRMADO=si; fase_restauracion; fase_rollback ;;
    *) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
rc=$?
salida ""; salida "Informe guardado en: $INFORME"
exit $rc
