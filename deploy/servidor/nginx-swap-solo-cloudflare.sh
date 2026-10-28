#!/usr/bin/env bash
# SWAP-666: el sitio de Swap solo acepta conexiones que vengan de Cloudflare.
# Hoy, quien conecte directo a la IP del servidor con el dominio de Swap llega a la
# API sin pasar por el WAF ni la protección DDoS de Cloudflare.
#
# Solo modifica el sitio "swap" de nginx; los demás proyectos del servidor no se tocan.
# Ejecutar con sudo. Es idempotente y se revierte solo si algo falla.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || exec sudo "$0" "$@"

SITIO="$(readlink -f /etc/nginx/sites-enabled/swap)"
SNIPPET=/etc/nginx/snippets/cloudflare-solo.conf
RESPALDOS=/etc/nginx/respaldos-swap
MARCA="include snippets/cloudflare-solo.conf;"
DOMINIO=swap.jhgo.online

[ -f "$SITIO" ] || { echo "No existe /etc/nginx/sites-enabled/swap"; exit 1; }
mkdir -p "$RESPALDOS"
ts="$(date +%Y%m%d-%H%M%S)"
cp -a "$SITIO" "$RESPALDOS/swap.$ts"
[ -f "$SNIPPET" ] && cp -a "$SNIPPET" "$RESPALDOS/cloudflare-solo.conf.$ts"

revertir() {
    echo "REVERTIENDO a la configuración anterior"
    cp -a "$RESPALDOS/swap.$ts" "$SITIO"
    if [ -f "$RESPALDOS/cloudflare-solo.conf.$ts" ]; then
        cp -a "$RESPALDOS/cloudflare-solo.conf.$ts" "$SNIPPET"
    else
        rm -f "$SNIPPET"
    fi
    nginx -t && systemctl reload nginx
}

# 1. Rangos oficiales de Cloudflare (se validan antes de usarlos).
rangos="$( { curl -fsS -m 15 https://www.cloudflare.com/ips-v4; echo; curl -fsS -m 15 https://www.cloudflare.com/ips-v6; } | grep -E '^[0-9a-fA-F:.]+/[0-9]+$' || true)"
if [ "$(printf '%s\n' "$rangos" | grep -c .)" -lt 10 ]; then
    echo "ABORTADO: no se pudo obtener la lista de IPs de Cloudflare (menos de 10 rangos)."
    exit 1
fi
{
    echo "# Generado por deploy/servidor/nginx-swap-solo-cloudflare.sh el $(date -I). Solo Cloudflare puede conectarse."
    echo "# Fuente: https://www.cloudflare.com/ips (revisar cada mes; SWAP-681 lo automatiza)."
    printf '%s\n' "$rangos" | sed 's/^/allow /; s/$/;/'
    echo "deny all;"
} > "$SNIPPET"

# 2. Incluir el filtro en el bloque 443 del sitio (una sola vez).
if ! grep -qF "$MARCA" "$SITIO"; then
    awk -v marca="    $MARCA" '{print} /listen 443 ssl;/ && !hecho {print marca; hecho=1}' "$SITIO" > "$SITIO.nuevo"
    mv "$SITIO.nuevo" "$SITIO"
fi

# 3. Validar y recargar.
if ! nginx -t; then revertir; exit 1; fi
systemctl reload nginx

# 4. Comprobar: directo debe rechazarse (403) y por Cloudflare debe seguir funcionando (200).
# Tras recargar, nginx tarda un instante en pasar a los procesos nuevos: se espera hasta
# 15 s a que lo directo dé 403 en vez de probar una sola vez.
directo=""
for _ in $(seq 1 15); do
    directo="$(curl -sk -m 10 -o /dev/null -w '%{http_code}' --resolve "$DOMINIO:443:127.0.0.1" "https://$DOMINIO/api/health" || true)"
    [ "$directo" = 403 ] && break
    sleep 1
done
por_cf="$(curl -s -m 15 -o /dev/null -w '%{http_code}' "https://$DOMINIO/api/health" || true)"
echo "Directo al servidor: HTTP $directo (esperado 403)"
echo "Por Cloudflare:      HTTP $por_cf (esperado 200)"
if [ "$directo" != 403 ] || [ "$por_cf" != 200 ]; then
    echo "Resultado inesperado. Diagnóstico:"
    echo "--- reglas activas en nginx:"
    nginx -T 2>/dev/null | grep -nE "cloudflare-solo|deny all|server_name $DOMINIO" | head -8 || true
    echo "--- respuesta directa:"
    curl -skI -m 10 --resolve "$DOMINIO:443:127.0.0.1" "https://$DOMINIO/api/health" | head -5 || true
    revertir
    exit 1
fi
echo "Listo. Respaldo de la configuración anterior en $RESPALDOS (*.$ts)."
