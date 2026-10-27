#!/usr/bin/env bash
# SWAP-669: las actualizaciones de seguridad ya se instalan solas; esto agrega el
# reinicio automático (cuando hace falta) en una hora sin tráfico, en vez de
# depender de que alguien lo haga a mano o del proveedor (pasó el 18/10/2026).
#
# Uso: sudo reinicios-nocturnos.sh [HH:MM]
# Sin argumento, usa las 04:00 de Guatemala convertidas a la hora local del servidor.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || exec sudo "$0" "$@"

HORA="${1:-$(date -d "@$(TZ=America/Guatemala date -d 'tomorrow 04:00' +%s)" +%H:%M)}"
CONF=/etc/apt/apt.conf.d/52reinicio-swap

cat > "$CONF" <<CONF2
// SWAP-669: reinicio automático tras actualizaciones que lo requieran.
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-WithUsers "false";
Unattended-Upgrade::Automatic-Reboot-Time "$HORA";
CONF2

echo "Configuración efectiva:"
apt-config dump | grep -E 'Automatic-Reboot'
echo
unattended-upgrade --dry-run 2>&1 | tail -3 || true
echo
if ! systemctl is-enabled --quiet docker; then
    echo "ATENCIÓN: docker no está habilitado al arranque; los contenedores no volverían tras un reinicio."
    exit 1
fi
echo "Docker arranca solo con el sistema. Reinicio automático configurado a las $HORA (hora local del servidor: $(timedatectl show -p Timezone --value))."
echo "Prueba opcional: un 'sudo reboot' en un horario sin uso, y revisar que los 5 contenedores de Swap vuelven."
echo "Para revertir: sudo rm $CONF"
