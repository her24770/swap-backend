#!/usr/bin/env bash
# Imprime la siguiente versión semántica (vMAYOR.MENOR.PARCHE) según los commits
# hechos desde la última versión publicada:
#   - un commit con "!" antes de los dos puntos o "BREAKING CHANGE" -> sube MAYOR
#   - algún commit "feat:"                                           -> sube MENOR
#   - cualquier otro caso (fix, docs, chore, sin formato...)         -> sube PARCHE
# Sin versiones previas, la primera es v1.0.0.
set -euo pipefail

ultima="$(git tag -l 'v[0-9]*.[0-9]*.[0-9]*' --merged HEAD | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1 || true)"
if [ -z "$ultima" ]; then
    echo "v1.0.0"
    exit 0
fi

mensajes="$(git log "$ultima..HEAD" --no-merges --format='%s%n%b')"
IFS=. read -r mayor menor parche <<< "${ultima#v}"

if grep -qE '^[[:space:]]*[a-zA-Z]+(\([^)]*\))?!:|BREAKING CHANGE' <<< "$mensajes"; then
    mayor=$((mayor + 1)); menor=0; parche=0
elif grep -qE '^[[:space:]]*feat(\([^)]*\))?:' <<< "$mensajes"; then
    menor=$((menor + 1)); parche=0
else
    parche=$((parche + 1))
fi

echo "v$mayor.$menor.$parche"
