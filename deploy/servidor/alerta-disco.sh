#!/usr/bin/env bash
# SWAP-668: avisa cuando el disco supera el umbral (por defecto 85 %).
# Instalar como /home/nandez/deploy/alerta-disco.sh y programar cada hora:
#   crontab -e  →  0 * * * * /home/nandez/deploy/alerta-disco.sh
# Configuración opcional en /home/nandez/deploy/alertas.env (chmod 600):
#   DISK_ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/...   (Discord o Slack)
#   DISK_ALERT_THRESHOLD=85
# Sin webhook, solo deja la alerta en el journal (journalctl -t swap-alerta-disco).
# Avisa como máximo una vez cada 24 horas mientras el disco siga lleno.
set -euo pipefail

CONFIG=/home/nandez/deploy/alertas.env
ULTIMA=/home/nandez/deploy/estado/alerta-disco.ultima
DISK_ALERT_THRESHOLD=85
DISK_ALERT_WEBHOOK_URL=
# shellcheck disable=SC1090
[ -f "$CONFIG" ] && . "$CONFIG"

uso="$(df --output=pcent / | tail -1 | tr -dc '0-9')"
[ "$uso" -lt "$DISK_ALERT_THRESHOLD" ] && exit 0

# Evita repetir el aviso más de una vez al día.
if [ -f "$ULTIMA" ] && [ "$(( $(date +%s) - $(stat -c %Y "$ULTIMA") ))" -lt 86400 ]; then
    exit 0
fi

mensaje="Swap: el disco del servidor está al ${uso}% (umbral ${DISK_ALERT_THRESHOLD}%). Ejecutar deploy/servidor/liberar-disco.sh."
logger -t swap-alerta-disco -p user.warning "$mensaje"
if [ -n "$DISK_ALERT_WEBHOOK_URL" ]; then
    # "content" lo lee Discord y "text" lo lee Slack.
    curl -fsS -m 10 -H 'Content-Type: application/json' \
        -d "{\"content\":\"$mensaje\",\"text\":\"$mensaje\"}" "$DISK_ALERT_WEBHOOK_URL" >/dev/null || \
        logger -t swap-alerta-disco -p user.err "No se pudo enviar la alerta al webhook"
fi
mkdir -p "$(dirname "$ULTIMA")"
touch "$ULTIMA"
