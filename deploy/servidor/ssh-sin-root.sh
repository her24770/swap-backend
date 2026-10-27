#!/usr/bin/env bash
# SWAP-670: prohíbe iniciar sesión por SSH como root (hoy PermitRootLogin yes).
# El login con contraseña ya está desactivado (60-cloudimg-settings.conf).
#
# ANTES de ejecutarlo: abre otra terminal con tu sesión de nandez y NO la cierres.
# Si algo saliera mal, esa sesión sigue activa para revertir.
# Ejecutar con sudo. Después probar en una terminal NUEVA: ssh nandez@164.68.125.233
set -euo pipefail
[ "$(id -u)" -eq 0 ] || exec sudo "$0" "$@"

CONF=/etc/ssh/sshd_config.d/10-sin-root.conf
# Include está al inicio de sshd_config y el primer valor leído gana: este archivo
# prevalece sobre el "PermitRootLogin yes" del archivo principal.
echo "PermitRootLogin no" > "$CONF"
chmod 644 "$CONF"

if ! sshd -t; then
    echo "La configuración de SSH no es válida; se deshace el cambio."
    rm -f "$CONF"
    exit 1
fi
systemctl reload ssh

echo "Valor efectivo: $(sshd -T | grep -i '^permitrootlogin')"
echo "Listo. Comprueba en otra terminal que sigues entrando como nandez y que 'ssh root@164.68.125.233' es rechazado."
echo "Para revertir: sudo rm $CONF && sudo systemctl reload ssh"
