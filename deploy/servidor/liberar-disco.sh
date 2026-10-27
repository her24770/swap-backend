#!/usr/bin/env bash
# SWAP-668: libera espacio de Docker sin tocar nada que esté en uso.
# Se ejecuta como el usuario nandez (no necesita sudo).
#
# Borra SOLO:
#   - la caché de builds (el siguiente build de cualquier proyecto tardará un poco más)
#   - las imágenes colgantes (<none>:<none>) que ningún contenedor usa
# NO borra contenedores, volúmenes ni imágenes con nombre, por lo que las versiones
# guardadas para rollback (swap-backend-api:<commit>, swap-frontend-frontend:<commit>) se conservan.
set -euo pipefail

echo "== Antes"
df -h / | tail -1
docker system df

echo
echo "== Borrando caché de builds"
docker builder prune -f | tail -1
echo "== Borrando imágenes colgantes sin uso"
docker image prune -f | tail -1

echo
echo "== Después"
df -h / | tail -1
docker system df

echo
echo "== Imágenes con nombre pero sin etiqueta (no se borran; revisar a mano con 'docker rmi <ID>')"
docker image ls --format '{{.ID}}\t{{.Repository}}:{{.Tag}}\t{{.Size}}' | awk -F'\t' '$2 ~ /:<none>$/' || true
