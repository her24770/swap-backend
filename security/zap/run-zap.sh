#!/usr/bin/env bash
# Orquesta las pruebas dinámicas con OWASP ZAP contra la copia aislada de Swap.
#
#   ./run-zap.sh up          levanta la copia aislada y carga los datos de prueba
#   ./run-zap.sh scan [fases] ejecuta las fases (por defecto: anonimo usuario moderador superadmin produccion)
#   ./run-zap.sh ci-baseline ejecuta el escaneo rápido baseline para CI y valida alertas altas
#   ./run-zap.sh down        apaga la copia y borra sus datos
#
# Variables opcionales: ZAP_PORT, ZAP_API_IMAGE, ZAP_EMBEDDINGS_IMAGE, ZAP_MAX_MINS_ANON,
# ZAP_MAX_MINS_AUTH, ZAP_DELAY_MS, ZAP_SCANNER_MEM, ZAP_SCANNER_HEAP, ZAP_PROD_URL,
# ZAP_MIN_FREE_MB, ZAP_IMAGE

set -euo pipefail
export MSYS_NO_PATHCONV=1


DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

HOST_DIR="$DIR"
if (pwd -W) >/dev/null 2>&1; then
    HOST_DIR="$(pwd -W)"
fi

COMPOSE="docker compose"
docker compose version >/dev/null 2>&1 || COMPOSE="docker-compose"
COMPOSE="$COMPOSE -f docker-compose.zap.yml"

export ZAP_PORT="${ZAP_PORT:-3220}"
ZAP_IMAGE="${ZAP_IMAGE:-zaproxy/zap-stable}"
ZAP_MAX_MINS_ANON="${ZAP_MAX_MINS_ANON:-20}"
ZAP_MAX_MINS_AUTH="${ZAP_MAX_MINS_AUTH:-40}"
# El rate limit global de la API es 120 req/min por IP: con 1 hilo y 700 ms
# de espera ZAP se queda por debajo (~85 req/min) y el escaneo no se llena de 429.
ZAP_DELAY_MS="${ZAP_DELAY_MS:-700}"
ZAP_SCANNER_MEM="${ZAP_SCANNER_MEM:-1280m}"
ZAP_SCANNER_HEAP="${ZAP_SCANNER_HEAP:-900m}"
ZAP_PROD_URL="${ZAP_PROD_URL:-https://swap.jhgo.online}"
ZAP_MIN_FREE_MB="${ZAP_MIN_FREE_MB:-2500}"
BASE="http://127.0.0.1:${ZAP_PORT}/api/v1"
TARGET_INTERNO="http://swap-zap-nginx"
REPORTS="$HOST_DIR/reports"
RUN_DIR="${ZAP_RUN_DIR:-$REPORTS/$(date +%Y%m%d-%H%M%S)}"


log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }

memoria_libre_mb() {
    if command -v free >/dev/null 2>&1; then free -m | awk '/^Mem:/ {print $7}'; else echo 999999; fi
}

verificar_memoria() {
    local libre; libre="$(memoria_libre_mb)"
    if [ "$libre" -lt "$ZAP_MIN_FREE_MB" ]; then
        log "ABORTADO: solo hay ${libre} MB libres (mínimo ${ZAP_MIN_FREE_MB} MB) — protegiendo al resto de servicios"
        exit 1
    fi
    log "Memoria disponible: ${libre} MB"
}

esperar_api() {
    local code=000
    for _ in $(seq 1 80); do
        code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/auth/me" || true)"
        if [ "$code" != "000" ] && [ "$code" != "502" ] && [ "$code" != "503" ]; then
            log "API de la copia responde (HTTP $code)"; return 0
        fi
        sleep 3
    done
    log "La API de la copia no respondió a tiempo"; exit 1
}

asegurar_zap_image() {
    if ! docker image inspect "$ZAP_IMAGE" >/dev/null 2>&1; then
        log "Descargando imagen oficial de ZAP ($ZAP_IMAGE)..."
        docker pull "$ZAP_IMAGE"
    fi
}

asegurar_embeddings_image() {

    if ! docker image inspect "${ZAP_EMBEDDINGS_IMAGE:-swap-backend-embeddings:latest}" >/dev/null 2>&1; then
        log "Imagen de embeddings no encontrada; construyendo mock liviano para pruebas dinámicas"
        docker build -t swap-backend-embeddings-mock:latest "$DIR/mock-embeddings"
        export ZAP_EMBEDDINGS_IMAGE="swap-backend-embeddings-mock:latest"
    fi
}

asegurar_api_image() {
    if ! docker image inspect "${ZAP_API_IMAGE:-swap-backend-api:latest}" >/dev/null 2>&1; then
        log "Imagen de API no encontrada; construyendo imagen de producción"
        docker build --target production -t swap-backend-api:latest "$DIR/../.."
        export ZAP_API_IMAGE="swap-backend-api:latest"
    fi
}

cmd_up() {
    asegurar_embeddings_image
    verificar_memoria
    log "Levantando copia aislada en 127.0.0.1:${ZAP_PORT}"
    $COMPOSE up -d
    esperar_api
    log "Cargando catálogos (seed.ts)"
    docker exec swap-zap-api ./node_modules/.bin/tsx prisma/seed.ts | tail -1
    log "Cargando datos de prueba (seedPruebas.ts)"
    docker exec swap-zap-api ./node_modules/.bin/tsx prisma/seedPruebas.ts | tail -1
}

cmd_down() {
    log "Apagando copia aislada y borrando sus datos"
    $COMPOSE down -v
}


exportar_openapi() {
    # En producción /api/openapi.json no se sirve (BG-20), así que se exporta
    # desde el código compilado de la misma imagen. Se ajusta el servidor al
    # destino interno y la versión a 3.1.0 porque el importador de ZAP no
    # reconoce todavía "3.2.0" (el contenido es compatible).
    docker exec -e T="$TARGET_INTERNO" swap-zap-api node -e '
        const d = JSON.parse(JSON.stringify(require("./dist/openapi/openapi.js").openApiDocument));
        d.openapi = "3.1.0";
        d.servers = [{ url: process.env.T + "/api/v1" }];
        process.stdout.write(JSON.stringify(d, null, 2));
    ' > "$RUN_DIR/openapi.json"
    log "OpenAPI exportado: $(grep -c '"operationId"' "$RUN_DIR/openapi.json") operaciones"
}

extraer_token() {
    # $1 = ruta de login, $2 = cuerpo JSON. El token viaja en la cookie swap-token.
    curl -s -D - -o /dev/null -X POST "$BASE$1" -H 'Content-Type: application/json' -d "$2" \
        | tr -d '\r' | sed -n 's/^[Ss]et-[Cc]ookie: swap-token=\([^;]*\).*/\1/p' | head -1
}

token_de() {
    local token=""
    case "$1" in
        usuario)
            token="$(extraer_token /auth/login '{"email_institucional":"vendedor@uvg.edu.gt","password":"Vendedor123!"}' 2>/dev/null || true)"
            if [ -z "$token" ]; then
                token="$(docker exec swap-zap-api node -e "const { ServicioJWT } = require('./dist/autenticacion/ServicioJWT.js'); process.stdout.write(ServicioJWT.generarToken({ sub: '1', email: 'vendedor@uvg.edu.gt', rol: 'usuario', ver: 1 }));" 2>/dev/null || true)"
            fi
            ;;
        moderador)
            token="$(extraer_token /moderador/login '{"usuario":"moderador1","password":"Moderador123!"}' 2>/dev/null || true)"
            if [ -z "$token" ]; then
                token="$(docker exec swap-zap-api node -e "const { ServicioJWT } = require('./dist/autenticacion/ServicioJWT.js'); process.stdout.write(ServicioJWT.generarToken({ sub: '1', email: 'moderador1@swap.test', rol: 'moderador', ver: 1 }));" 2>/dev/null || true)"
            fi
            ;;
        superadmin)
            token="$(extraer_token /moderador/login '{"usuario":"superadmin1","password":"SuperAdmin123!"}' 2>/dev/null || true)"
            if [ -z "$token" ]; then
                token="$(docker exec swap-zap-api node -e "const { ServicioJWT } = require('./dist/autenticacion/ServicioJWT.js'); process.stdout.write(ServicioJWT.generarToken({ sub: '2', email: 'superadmin1@swap.test', rol: 'superadmin', ver: 1 }));" 2>/dev/null || true)"
            fi
            ;;
    esac
    printf '%s' "$token"
}


ruta_salud() {
    case "$1" in
        usuario) echo /auth/me ;;
        moderador|superadmin) echo /moderador/me ;;
    esac
}

lineas_nginx() { docker logs swap-zap-nginx 2>/dev/null | wc -l | tr -d ' '; }

resumen_estados() {
    # $1 = línea inicial del log de nginx, $2 = archivo destino
    docker logs swap-zap-nginx 2>/dev/null | tail -n +"$(( $1 + 1 ))" \
        | awk '$9 ~ /^[0-9]+$/ {print $9}' | sort | uniq -c | sort -rn > "$2"
}

renderizar_plan() {
    # ZAP valida los parámetros numéricos antes de sustituir variables, así que
    # el plan se genera ya con los valores. $1 = plantilla, $2 = destino, resto = VAR=valor
    local origen="$1" destino="$2"; shift 2
    cp "$DIR/plans/$origen" "$destino"
    local par clave valor
    for par in "$@"; do
        clave="${par%%=*}"; valor="${par#*=}"
        sed -i.bak "s|\${$clave}|$valor|g" "$destino" && rm -f "$destino.bak"
    done
}

ejecutar_zap() {
    # $1 = fase, $2 = plan, $3 = red, resto = VAR=valor para el plan
    local fase="$1" plan="$2" red="$3"; shift 3
    mkdir -p "$RUN_DIR/$fase"; chmod 777 "$RUN_DIR" "$RUN_DIR/$fase"
    renderizar_plan "$plan" "$RUN_DIR/$fase/plan.yaml" ZAP_OUT="$fase" "$@"
    verificar_memoria
    log "== Fase $fase =="
    local inicio; inicio="$(date +%s)"
    if [ "$fase" = "baseline" ]; then
        docker run --rm --name "swap-zap-scanner-$fase" --network "$red" \
            -m "$ZAP_SCANNER_MEM" --cpus 1 \
            -v "$RUN_DIR:/zap/wrk:rw" \
            "$ZAP_IMAGE" sh -c "mkdir -p /home/zap/.ZAP && echo '-Xmx${ZAP_SCANNER_HEAP}' > /home/zap/.ZAP/.ZAP_JVM.properties && zap.sh -cmd -autorun /zap/wrk/$fase/plan.yaml" \
            2>&1 | tee "$RUN_DIR/$fase/zap.log" || log "ZAP terminó con código $? (ver $fase/zap.log)"
    else
        docker run --rm --name "swap-zap-scanner-$fase" --network "$red" \
            -m "$ZAP_SCANNER_MEM" --cpus 1 \
            -v "$RUN_DIR:/zap/wrk:rw" \
            "$ZAP_IMAGE" sh -c "mkdir -p /home/zap/.ZAP && echo '-Xmx${ZAP_SCANNER_HEAP}' > /home/zap/.ZAP/.ZAP_JVM.properties && zap.sh -cmd -autorun /zap/wrk/$fase/plan.yaml" \
            > "$RUN_DIR/$fase/zap.log" 2>&1 || log "ZAP terminó con código $? (ver $fase/zap.log)"
    fi

    # El plan guardado como evidencia no debe conservar el token de sesión.
    sed -i.bak 's|Bearer [A-Za-z0-9._-]*|Bearer <token-redactado>|' "$RUN_DIR/$fase/plan.yaml" && rm -f "$RUN_DIR/$fase/plan.yaml.bak"
    echo "$(( $(date +%s) - inicio ))" > "$RUN_DIR/$fase/duracion-segundos.txt"
    log "Fase $fase terminada en $(( ($(date +%s) - inicio) / 60 )) min"
}

fase_api() {
    local fase="$1" antes; antes="$(lineas_nginx)"
    if [ "$fase" = "anonimo" ]; then
        ejecutar_zap anonimo api-anonimo.yaml swap_zap_net \
            ZAP_TARGET="$TARGET_INTERNO" ZAP_MAX_MINS="$ZAP_MAX_MINS_ANON" ZAP_DELAY_MS="$ZAP_DELAY_MS"
    else
        local token; token="$(token_de "$fase")"
        if [ -z "$token" ]; then log "No se obtuvo token para $fase — fase omitida"; return; fi
        ejecutar_zap "$fase" api-autenticado.yaml swap_zap_net \
            ZAP_TARGET="$TARGET_INTERNO" ZAP_TOKEN="$token" ZAP_ROL="$fase" \
            ZAP_MAX_MINS="$ZAP_MAX_MINS_AUTH" ZAP_DELAY_MS="$ZAP_DELAY_MS"
        local salud; salud="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $token" "$BASE$(ruta_salud "$fase")")"
        echo "HTTP $salud en $(ruta_salud "$fase") al terminar la fase" > "$RUN_DIR/$fase/sesion-al-final.txt"
        log "Sesión de $fase al terminar: HTTP $salud"
    fi
    resumen_estados "$antes" "$RUN_DIR/$fase/codigos-http.txt"
}

fase_produccion() {
    ejecutar_zap produccion produccion-pasivo.yaml bridge ZAP_PROD_URL="$ZAP_PROD_URL"
}

cmd_scan() {
    local fases="${*:-anonimo usuario moderador superadmin produccion}"
    mkdir -p "$RUN_DIR"
    log "Resultados en $RUN_DIR"
    {
        echo "fecha=$(date -Iseconds 2>/dev/null || date)"
        echo "host=$(hostname)"
        echo "imagen_api=$(docker inspect -f '{{.Config.Image}} {{.Image}}' swap-zap-api)"
        echo "imagen_zap=$(docker image inspect -f '{{index .RepoTags 0}} {{.Id}}' "$ZAP_IMAGE" 2>/dev/null || echo "$ZAP_IMAGE (se descarga)")"
        echo "fases=$fases delay_ms=$ZAP_DELAY_MS max_anon=$ZAP_MAX_MINS_ANON max_auth=$ZAP_MAX_MINS_AUTH"
    } > "$RUN_DIR/entorno.txt"
    exportar_openapi
    for fase in $fases; do
        case "$fase" in
            anonimo|usuario|moderador|superadmin) fase_api "$fase" ;;
            produccion) fase_produccion ;;
            *) log "Fase desconocida: $fase" ;;
        esac
    done
    docker logs swap-zap-nginx > "$RUN_DIR/nginx-access.log" 2>&1 || true
    log "Listo. Reportes en $RUN_DIR"
}

evaluar_alertas_altas() {
    local json_file="$1"
    if [ ! -f "$json_file" ]; then
        log "Error: archivo de reporte no encontrado: $json_file"
        return 1
    fi
    node -e '
        const fs = require("fs");
        const report = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
        const sites = Array.isArray(report.site) ? report.site : (report.site ? [report.site] : []);
        const highAlerts = [];
        for (const s of sites) {
            const alerts = Array.isArray(s.alerts) ? s.alerts : [];
            for (const a of alerts) {
                if (String(a.riskcode) === "3" || (a.riskdesc && a.riskdesc.toLowerCase().startsWith("high"))) {
                    highAlerts.push(a);
                }
            }
        }
        if (highAlerts.length > 0) {
            console.error(`\n❌ Se encontraron ${highAlerts.length} alerta(s) de severidad ALTA en OWASP ZAP:`);
            highAlerts.forEach((a, i) => {
                console.error(`  ${i + 1}. [${a.alert || a.name}] - ${a.desc ? a.desc.substring(0, 120) + "..." : ""}`);
            });
            process.exit(1);
        } else {
            console.log("\n✅ No se encontraron alertas de severidad ALTA en el escaneo OWASP ZAP.");
            process.exit(0);
        }
    ' "$json_file"
}

cmd_ci_baseline() {
    asegurar_zap_image
    asegurar_embeddings_image
    asegurar_api_image
    export ZAP_MIN_FREE_MB="${ZAP_MIN_FREE_MB:-1000}"
    mkdir -p "$RUN_DIR"
    log "Iniciando escaneo baseline de CI en $RUN_DIR"

    cleanup_ci() {
        local rc=$?
        cmd_down
        exit "$rc"
    }
    # Asegurar apagado del stack y preservación del código de salida al terminar o ante interrupciones
    trap cleanup_ci EXIT INT TERM

    cmd_up
    exportar_openapi

    local token; token="$(token_de usuario)"
    if [ -z "$token" ]; then
        log "Error: No se pudo obtener token de autenticación para usuario de prueba"
        exit 1
    fi

    local antes; antes="$(lineas_nginx)"
    ejecutar_zap baseline api-baseline.yaml swap_zap_net \
        ZAP_TARGET="$TARGET_INTERNO" \
        ZAP_TOKEN="$token"

    resumen_estados "$antes" "$RUN_DIR/baseline/codigos-http.txt" 2>/dev/null || true
    docker logs swap-zap-nginx > "$RUN_DIR/nginx-access.log" 2>&1 || true

    # Copiar reportes a carpeta fija security/zap/reports/ci-baseline/ para artefactos de CI
    mkdir -p "$DIR/reports/ci-baseline"
    cp -r "$RUN_DIR/baseline/"* "$DIR/reports/ci-baseline/" 2>/dev/null || true

    log "Reportes generados exitosamente en:"
    log "  - HTML : $DIR/reports/ci-baseline/reporte.html"
    log "  - JSON : $DIR/reports/ci-baseline/reporte.json"
    log "  - MD   : $DIR/reports/ci-baseline/reporte.md"

    log "Evaluando severidad de alertas en reporte JSON..."
    evaluar_alertas_altas "$RUN_DIR/baseline/reporte.json"
}


case "${1:-}" in
    up) cmd_up ;;
    down) cmd_down ;;
    scan) shift; cmd_scan "$@" ;;
    ci-baseline) cmd_ci_baseline ;;
    *) sed -n '2,13p' "$DIR/$(basename "$0")"; exit 1 ;;

esac

