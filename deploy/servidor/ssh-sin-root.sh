#!/usr/bin/env bash
# SWAP-670: endurece el acceso SSH al servidor:
#   - PermitRootLogin no          (nadie entra como root)
#   - PasswordAuthentication no   (solo se entra con llave)
#
# Por qué las dos: sshd_config traía "PermitRootLogin yes" y, aunque 60-cloudimg-settings.conf
# dice "PasswordAuthentication no", /etc/ssh/sshd_config.d/50-cloud-init.conf (solo legible por
# root) se procesa antes y en SSH gana el primer valor, así que el servidor seguía aceptando
# contraseñas. Este archivo se llama 10-... para ir antes que cualquiera de ellos.
#
# ANTES de ejecutarlo: abre otra terminal con tu sesión de nandez y NO la cierres.
# Si algo saliera mal, esa sesión sigue activa para revertir.
# Ejecutar con sudo. Después probar en una terminal NUEVA: ssh nandez@164.68.125.233
set -euo pipefail
[ "$(id -u)" -eq 0 ] || exec sudo "$0" "$@"

CONF="${CONF:-/etc/ssh/sshd_config.d/10-sin-root.conf}"
USUARIO="${SUDO_USER:-nandez}"
LLAVES="${LLAVES:-$(getent passwd "$USUARIO" | cut -d: -f6)/.ssh/authorized_keys}"

# Sin una llave autorizada, desactivar las contraseñas dejaría el servidor inaccesible.
if ! grep -qE '^(ssh-|ecdsa-|sk-)' "$LLAVES" 2>/dev/null; then
    echo "ABORTADO: $USUARIO no tiene ninguna llave pública en $LLAVES." >&2
    echo "Desactivar las contraseñas te dejaría sin forma de entrar." >&2
    exit 1
fi

previo=""
[ -f "$CONF" ] && previo="$(cat "$CONF")"
printf 'PermitRootLogin no\nPasswordAuthentication no\n' > "$CONF"
chmod 644 "$CONF"

revertir() {
    echo "Se deshace el cambio."
    if [ -n "$previo" ]; then printf '%s\n' "$previo" > "$CONF"; else rm -f "$CONF"; fi
}

if ! sshd -t; then
    echo "La configuración de SSH no es válida."
    revertir
    exit 1
fi
systemctl reload ssh

efectivo="$(sshd -T | grep -iE '^(permitrootlogin|passwordauthentication) ' | tr '\n' ' ')"
echo "Valor efectivo: $efectivo"
if ! printf '%s' "$efectivo" | grep -qi 'permitrootlogin no' || ! printf '%s' "$efectivo" | grep -qi 'passwordauthentication no'; then
    echo "Algún valor efectivo no quedó en 'no': otro archivo lo está anulando."
    revertir
    systemctl reload ssh
    exit 1
fi
echo "Listo. Comprueba en otra terminal que sigues entrando como $USUARIO con tu llave,"
echo "y que 'ssh root@<servidor>' y entrar con contraseña son rechazados."
echo "Para revertir: sudo rm $CONF && sudo systemctl reload ssh"
