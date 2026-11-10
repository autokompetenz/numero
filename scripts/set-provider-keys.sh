#!/usr/bin/env bash
# Saisie masquée des clés fournisseur pour la mise en live.
# Écrit `.env.providers.local` (chmod 600), jamais affiché ni ajouté à Git.
#
# Usage : bash scripts/set-provider-keys.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/.env.providers.local"

ask_secret() {
  local label="$1" value
  printf '  %s : ' "$label" >&2
  IFS= read -rs value || true
  printf '\n' >&2
  printf '%s' "$value"
}

require() {
  if [ -z "${2:-}" ]; then
    echo "Erreur : $1 est requis." >&2
    exit 1
  fi
}

echo "Clés fournisseur LIVE — saisie masquée" >&2
echo "Sortie : .env.providers.local (chmod 600)" >&2
echo >&2

FEDAPAY_PUBLIC_KEY="$(ask_secret 'FedaPay — clé publique')"
FEDAPAY_SECRET_KEY="$(ask_secret 'FedaPay — clé secrète')"
FEDAPAY_WEBHOOK_SECRET="$(ask_secret 'FedaPay — secret webhook')"
ULTRASMS_API_KEY="$(ask_secret 'Ultra SMS — clé API')"
ULTRASMS_WEBHOOK_SECRET="$(ask_secret 'Ultra SMS — secret callback')"

require FEDAPAY_PUBLIC_KEY "$FEDAPAY_PUBLIC_KEY"
require FEDAPAY_SECRET_KEY "$FEDAPAY_SECRET_KEY"
require FEDAPAY_WEBHOOK_SECRET "$FEDAPAY_WEBHOOK_SECRET"
require ULTRASMS_API_KEY "$ULTRASMS_API_KEY"
require ULTRASMS_WEBHOOK_SECRET "$ULTRASMS_WEBHOOK_SECRET"

umask 077
: > "$OUT"
{
  printf 'FEDAPAY_PUBLIC_KEY=%s\n' "$FEDAPAY_PUBLIC_KEY"
  printf 'FEDAPAY_SECRET_KEY=%s\n' "$FEDAPAY_SECRET_KEY"
  printf 'FEDAPAY_WEBHOOK_SECRET=%s\n' "$FEDAPAY_WEBHOOK_SECRET"
  printf 'ULTRASMS_API_KEY=%s\n' "$ULTRASMS_API_KEY"
  printf 'ULTRASMS_WEBHOOK_SECRET=%s\n' "$ULTRASMS_WEBHOOK_SECRET"
  printf 'ULTRASMS_CALLBACK_URL=https://numero-pearl.vercel.app/api/webhooks/ultrasms\n'
} >> "$OUT"
chmod 600 "$OUT"

echo >&2
echo "✅ .env.providers.local créé (600), valeurs jamais affichées." >&2
echo "   FedaPay publique : ${#FEDAPAY_PUBLIC_KEY} caractères" >&2
echo "   FedaPay secrète  : ${#FEDAPAY_SECRET_KEY} caractères" >&2
echo "   FedaPay webhook  : ${#FEDAPAY_WEBHOOK_SECRET} caractères" >&2
echo "   Ultra SMS API    : ${#ULTRASMS_API_KEY} caractères" >&2
echo "   Ultra SMS callback: ${#ULTRASMS_WEBHOOK_SECRET} caractères" >&2
