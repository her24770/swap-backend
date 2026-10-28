#!/usr/bin/env bash
# SWAP-685: exige que el CI pase antes de mergear a develop y main (rulesets protect-develop y
# protect-main). Hoy esos rulesets piden un PR con 1 aprobación pero NO exigen checks, así que
# se puede mergear con el CI en rojo. El rol de administrador conserva su bypass (--admin).
#
#   ./scripts/configurar-status-checks.sh <dueño/repo>                     MODO PRUEBA: no cambia nada
#   ./scripts/configurar-status-checks.sh <dueño/repo> --aplicar           agrega los checks
#   ./scripts/configurar-status-checks.sh <dueño/repo> --revertir <json>   restaura un respaldo
#
# Ejemplo: ./scripts/configurar-status-checks.sh her24770/swap-backend --aplicar
# Antes de aplicar valida que cada check exista en la última corrida de CI de develop: un nombre
# mal escrito dejaría TODOS los PRs esperando un check que nunca llega. Guarda el ruleset original
# en $HOME/respaldos-rulesets/ para poder revertir. Requiere gh con permisos de administrador.
set -euo pipefail

REPO="${1:-}"; MODO="${2:-prueba}"; ARCHIVO="${3:-}"
[ -n "$REPO" ] || { sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }
RESPALDOS="${RESPALDOS:-$HOME/respaldos-rulesets}"
RULESETS=(protect-develop protect-main)

case "$REPO" in
    */swap-backend)
        CHECKS=("Auditoría de dependencias" "Lint y typecheck" "Pruebas unitarias" "Pruebas de integración (Docker)" "Escaneo DAST OWASP ZAP (Baseline)") ;;
    */swap-frontend)
        CHECKS=("Auditoría de dependencias" "Lint" "Typecheck" "Pruebas" "Build" "E2E Playwright") ;;
    *) echo "Repo no reconocido: $REPO (se esperaba .../swap-backend o .../swap-frontend)" >&2; exit 2 ;;
esac
log() { printf '%s\n' "$*"; }

if [ "$MODO" = "--revertir" ]; then
    [ -f "$ARCHIVO" ] || { echo "No existe el respaldo '$ARCHIVO'" >&2; exit 1; }
    ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["id"])' "$ARCHIVO")"
    python3 - "$ARCHIVO" > /tmp/ruleset-revertir.json <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
print(json.dumps({k: d[k] for k in ("name", "target", "enforcement", "conditions", "rules", "bypass_actors") if k in d}))
PY
    gh api -X PUT "repos/$REPO/rulesets/$ID" --input /tmp/ruleset-revertir.json > /dev/null
    log "Ruleset $ID restaurado desde $ARCHIVO"; exit 0
fi

# 1) Los checks deben existir con ESE nombre en la última corrida de CI de develop.
SHA="$(gh run list -R "$REPO" --branch develop --workflow CI --status success --limit 1 --json headSha -q '.[0].headSha')"
[ -n "$SHA" ] || { echo "No hay ninguna corrida de CI exitosa en develop para validar los nombres." >&2; exit 1; }
EXISTENTES="$(gh api "repos/$REPO/commits/$SHA/check-runs?per_page=100" -q '.check_runs[].name')"
FALTAN=0
for c in "${CHECKS[@]}"; do
    if printf '%s\n' "$EXISTENTES" | grep -qxF "$c"; then log "  existe en el CI: $c"; else log "  NO EXISTE en el CI: $c"; FALTAN=1; fi
done
[ "$FALTAN" -eq 0 ] || { echo "Abortado: algún nombre no coincide con los checks reales de ${SHA:0:7}." >&2; exit 1; }

# 2) Agregar la regla a cada ruleset.
CHECKS_JSON="$(printf '%s\n' "${CHECKS[@]}" | python3 -c 'import sys,json; print(json.dumps([l.rstrip("\n") for l in sys.stdin if l.strip()]))')"
mkdir -p "$RESPALDOS"
for nombre in "${RULESETS[@]}"; do
    ID="$(gh api "repos/$REPO/rulesets" -q ".[] | select(.name==\"$nombre\") | .id")"
    [ -n "$ID" ] || { echo "No existe el ruleset $nombre en $REPO" >&2; exit 1; }
    gh api "repos/$REPO/rulesets/$ID" > "/tmp/ruleset-$ID.json"
    python3 - "/tmp/ruleset-$ID.json" "$CHECKS_JSON" > "/tmp/ruleset-$ID-nuevo.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1])); checks = json.loads(sys.argv[2])
reglas = [r for r in d["rules"] if r["type"] != "required_status_checks"]
reglas.append({"type": "required_status_checks", "parameters": {
    "strict_required_status_checks_policy": False,
    "do_not_enforce_on_create": False,
    "required_status_checks": [{"context": c} for c in checks]}})
print(json.dumps({k: (reglas if k == "rules" else d[k]) for k in ("name", "target", "enforcement", "conditions", "rules", "bypass_actors") if k in d or k == "rules"}))
PY
    ya="$(python3 -c 'import json,sys; print(sum(1 for r in json.load(open(sys.argv[1]))["rules"] if r["type"]=="required_status_checks"))' "/tmp/ruleset-$ID.json")"
    log "[$nombre #$ID] reglas actuales: $(python3 -c 'import json,sys; print(", ".join(r["type"] for r in json.load(open(sys.argv[1]))["rules"]))' "/tmp/ruleset-$ID.json") | checks ya exigidos: $ya"
    if [ "$MODO" = "--aplicar" ]; then
        COPIA="$RESPALDOS/$(basename "$REPO")-$nombre-$ID-$(date +%Y%m%d-%H%M%S).json"; cp "/tmp/ruleset-$ID.json" "$COPIA"
        gh api -X PUT "repos/$REPO/rulesets/$ID" --input "/tmp/ruleset-$ID-nuevo.json" > /dev/null
        NUEVOS="$(gh api "repos/$REPO/rulesets/$ID" -q '[.rules[] | select(.type=="required_status_checks") | .parameters.required_status_checks[].context] | length')"
        log "    APLICADO: $NUEVOS checks obligatorios. Para revertir: $0 $REPO --revertir $COPIA"
    else
        log "    (modo prueba) se agregaría la regla con ${#CHECKS[@]} checks; no se cambió nada. Usa --aplicar para aplicar."
    fi
done
