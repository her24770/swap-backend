#!/usr/bin/env bash
# SWAP-672 (parte nginx), OPCIONAL: que las peticiones por IP o con un dominio que
# ningún sitio reconoce reciban una respuesta vacía, en vez de la página "Welcome to
# nginx" (puerto 80) o del primer sitio del servidor (puerto 443).
#
# OJO: toca configuración COMPARTIDA con los demás proyectos del servidor. Solo cambia lo
# que pasa con hosts desconocidos; los sitios con server_name propio no se afectan. Aun
# así, el script mide la respuesta de cada sitio antes y después y se revierte solo si
# alguna cambia. Ejecutar con sudo.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || exec sudo "$0" "$@"

DEFAULT=/etc/nginx/sites-enabled/default
RESPALDOS=/etc/nginx/respaldos-swap
ts="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESPALDOS"
[ -e "$DEFAULT" ] && cp -aL "$DEFAULT" "$RESPALDOS/default.$ts"

nombres() {
    grep -rhoE 'server_name +[^;]+' /etc/nginx/sites-enabled/ \
        | awk '{for (i = 2; i <= NF; i++) print $i}' | grep -vE '^_$|\*' | sort -u
}
codigos() {
    local n
    for n in $(nombres); do
        printf '%s %s\n' "$n" "$(curl -sk -m 10 -o /dev/null -w '%{http_code}' --resolve "$n:443:127.0.0.1" "https://$n/" || true)"
    done
}

antes="$(codigos)"
echo "Respuesta de cada sitio ANTES:"; echo "$antes"

revertir() {
    echo "REVERTIENDO"
    rm -f "$DEFAULT"
    [ -f "$RESPALDOS/default.$ts" ] && cp -a "$RESPALDOS/default.$ts" "$DEFAULT"
    nginx -t && systemctl reload nginx
}

rm -f "$DEFAULT"
cat > "$DEFAULT" <<'CONF'
# Servidor por defecto (SWAP-672): rechaza lo que no pertenece a ningún sitio.
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 444;
}
server {
    listen 443 ssl default_server;
    server_name _;
    ssl_reject_handshake on;
}
CONF

if ! nginx -t; then revertir; exit 1; fi
systemctl reload nginx

despues="$(codigos)"
echo "Respuesta de cada sitio DESPUÉS:"; echo "$despues"
if [ "$antes" != "$despues" ]; then
    echo "Cambió la respuesta de algún sitio."
    revertir
    exit 1
fi
echo "Por IP (puerto 80): HTTP $(curl -s -m 10 -o /dev/null -w '%{http_code}' http://127.0.0.1/ || true) (000 = respuesta vacía, esperado)"
echo "Listo. Respaldo en $RESPALDOS/default.$ts"
