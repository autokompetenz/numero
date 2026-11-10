#!/usr/bin/env bash
# Renseigne les clés fournisseur dans `.env` sans les afficher ni les laisser
# dans l'historique du shell. Chaque valeur saisie est masquée ; laisser vide
# conserve la valeur déjà présente.
#
# Usage :
#   bash scripts/set-keys.sh                  # saisie guidée, modes inchangés
#   bash scripts/set-keys.sh --ultrasms-live  # Ultra SMS en live uniquement
#   bash scripts/set-keys.sh --payments-live  # FedaPay en live uniquement
#   bash scripts/set-keys.sh --sandbox        # FedaPay sandbox, Ultra SMS live
#   bash scripts/set-keys.sh --live           # les deux en live
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"
MODE="keep"

for arg in "$@"; do
  case "$arg" in
    --live) MODE="live" ;;
    --sandbox) MODE="sandbox" ;;
    --ultrasms-live) MODE="ultrasms" ;;
    --payments-live) MODE="payments" ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "Option inconnue : $arg" >&2; exit 1 ;;
  esac
done

if [ ! -f "$ENV_FILE" ]; then
  echo "Fichier .env introuvable. Exécutez d'abord : cp .env.example .env" >&2
  exit 1
fi

current_value() {
  grep -E "^${1}=" "$ENV_FILE" | head -1 | cut -d= -f2- || true
}

# Met à jour une clé. La valeur transite par un tube (jamais par argv/ps).
update_line() {
  printf '%s\n%s\n' "$1" "$2" | python3 -c '
import sys
from pathlib import Path
key, value = sys.stdin.read().split("\n", 1)
value = value.rstrip("\n")
path = Path(sys.argv[1])
lines = path.read_text(encoding="utf-8").splitlines()
prefix = key + "="
for index, line in enumerate(lines):
    if line.startswith(prefix):
        lines[index] = prefix + value
        break
else:
    lines.append(prefix + value)
path.write_text("\n".join(lines) + "\n", encoding="utf-8")
' "$ENV_FILE"
}

ask_secret() {
  local key="$1" label="$2" current value
  current="$(current_value "$key")"
  printf '  %s' "$label" >&2
  if [ -n "$current" ]; then
    printf ' [déjà défini — Entrée pour conserver]' >&2
  fi
  printf ' : ' >&2
  IFS= read -rs value || true
  printf '\n' >&2
  if [ -z "$value" ]; then
    value="$current"
  fi
  printf '%s' "$value"
}

echo "Saisie des clés (les caractères restent invisibles)." >&2
echo "Les valeurs ne sont jamais affichées ni ajoutées à l'historique." >&2
echo >&2

echo "— FedaPay —" >&2
PUBLIC_KEY="$(ask_secret FEDAPAY_PUBLIC_KEY 'Clé publique')"
SECRET_KEY="$(ask_secret FEDAPAY_SECRET_KEY 'Clé secrète')"
WEBHOOK_SECRET="$(ask_secret FEDAPAY_WEBHOOK_SECRET 'Secret de signature webhook')"

echo >&2
echo "— Ultra SMS —" >&2
ULTRASMS_KEY="$(ask_secret ULTRASMS_API_KEY 'Clé API')"
ULTRASMS_WEBHOOK="$(ask_secret ULTRASMS_WEBHOOK_SECRET 'Secret de callback')"

if [ -n "$PUBLIC_KEY" ]; then update_line FEDAPAY_PUBLIC_KEY "$PUBLIC_KEY"; fi
if [ -n "$SECRET_KEY" ]; then update_line FEDAPAY_SECRET_KEY "$SECRET_KEY"; fi
if [ -n "$WEBHOOK_SECRET" ]; then update_line FEDAPAY_WEBHOOK_SECRET "$WEBHOOK_SECRET"; fi
if [ -n "$ULTRASMS_KEY" ]; then update_line ULTRASMS_API_KEY "$ULTRASMS_KEY"; fi
if [ -n "$ULTRASMS_WEBHOOK" ]; then update_line ULTRASMS_WEBHOOK_SECRET "$ULTRASMS_WEBHOOK"; fi

case "$MODE" in
  live)
    update_line PAYMENTS_MODE live
    update_line ULTRASMS_MODE live
    ;;
  sandbox)
    update_line PAYMENTS_MODE sandbox
    update_line ULTRASMS_MODE live
    ;;
  ultrasms)
    update_line ULTRASMS_MODE live
    ;;
  payments)
    update_line PAYMENTS_MODE live
    ;;
esac

echo >&2
echo "Mise à jour terminée. État des clés (longueur uniquement) :" >&2
for key in FEDAPAY_PUBLIC_KEY FEDAPAY_SECRET_KEY FEDAPAY_WEBHOOK_SECRET ULTRASMS_API_KEY ULTRASMS_WEBHOOK_SECRET; do
  value="$(current_value "$key")"
  printf '  %-26s %s\n' "$key" "${#value} caractère(s)" >&2
done
printf '  %-26s %s\n' PAYMENTS_MODE "$(current_value PAYMENTS_MODE)" >&2
printf '  %-26s %s\n' ULTRASMS_MODE "$(current_value ULTRASMS_MODE)" >&2
echo >&2
echo "Redémarrez l'API pour appliquer (.env n'est pas rechargé à chaud)." >&2
