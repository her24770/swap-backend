#!/usr/bin/env bash
# SWAP-673: instala el sitio de nginx de STAGING (swap-staging.jhgo.online) con respaldo,
# validación y reversión automática. Ejecutar con sudo, DESPUÉS de:
#   - haber instalado el filtro de Cloudflare (nginx-swap-solo-cloudflare.sh), y
#   - haber clonado el repo de staging (el archivo de configuración sale de ahí).
# Además hay que crear en Cloudflare el registro DNS "swap-staging" (proxied); sin él el sitio
# se instala igual, pero no es accesible desde internet.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || exec sudo "$0" "$@"

ORIGEN="${ORIGEN:-/home/nandez/projects/software/swap-staging/swap-backend/deploy/staging/nginx-swap-staging.conf}"
DISPONIBLES="${DISPONIBLES:-/etc/nginx/sites-available}"
HABILITADOS="${HABILITADOS:-/etc/nginx/sites-enabled}"
SNIPPET="${SNIPPET:-/etc/nginx/snippets/cloudflare-solo.conf}"
CERT="${CERT:-/etc/nginx/ssl/cloudflare.crt}"
LLAVE="${LLAVE:-/etc/nginx/ssl/cloudflare.key}"
RESPALDOS="${RESPALDOS:-/etc/nginx/respaldos-swap}"
DOMINIO=swap-staging.jhgo.online
SITIO="$DISPONIBLES/swap-staging"; ENLACE="$HABILITADOS/swap-staging"

[ -f "$ORIGEN" ] || { echo "No existe $ORIGEN: clona primero el repo de staging (deploy/README.md → Staging, paso 2)." >&2; exit 1; }
[ -f "$SNIPPET" ] || { echo "Falta $SNIPPET: ejecuta antes nginx-swap-solo-cloudflare.sh." >&2; exit 1; }
[ -f "$CERT" ] && [ -f "$LLAVE" ] || { echo "Faltan el certificado de origen de Cloudflare en $CERT / $LLAVE." >&2; exit 1; }
getent hosts "$DOMINIO" >/dev/null 2>&1 || echo "AVISO: $DOMINIO todavía no resuelve; crea el registro DNS 'swap-staging' (proxied) en Cloudflare."

mkdir -p "$RESPALDOS"; ts="$(date +%Y%m%d-%H%M%S)"
[ -f "$SITIO" ] && cp -a "$SITIO" "$RESPALDOS/swap-staging.$ts"
revertir() {
    echo "REVERTIENDO"
    rm -f "$ENLACE"
    if [ -f "$RESPALDOS/swap-staging.$ts" ]; then cp -a "$RESPALDOS/swap-staging.$ts" "$SITIO"; ln -s "$SITIO" "$ENLACE"; else rm -f "$SITIO"; fi
    nginx -t && systemctl reload nginx
}

cp "$ORIGEN" "$SITIO"
ln -sfn "$SITIO" "$ENLACE"
if ! nginx -t; then revertir; exit 1; fi
systemctl reload nginx

# Por IP directa (sin pasar por Cloudflare) debe rechazarse: el filtro está incluido en el sitio.
directo=""
for _ in $(seq 1 15); do
    directo="$(curl -sk -m 10 -o /dev/null -w '%{http_code}' --resolve "$DOMINIO:443:127.0.0.1" "https://$DOMINIO/" || true)"
    [ "$directo" = 403 ] && break
    sleep 1
done
echo "Directo al servidor: HTTP $directo (esperado 403)"
if [ "$directo" != 403 ]; then revertir; exit 1; fi
por_cf="$(curl -s -m 15 -o /dev/null -w '%{http_code}' "https://$DOMINIO/" || true)"
echo "Por Cloudflare:      HTTP $por_cf (502 es normal hasta que staging esté desplegado; 000 = falta el DNS)"
echo "Listo. Sitio: $SITIO. Respaldo previo (si existía): $RESPALDOS/swap-staging.$ts"
