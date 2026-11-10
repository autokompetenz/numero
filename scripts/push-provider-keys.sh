#!/usr/bin/env bash
# Pousse les clés fournisseur de `.env.providers.local` vers le projet Vercel
# `numero` (Production, Preview, Development), puis bascule les modes en live.
#
# Aucune valeur n'est affichée : seules les longueurs sont imprimées.
# Usage : bash scripts/push-provider-keys.sh [fichier]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FILE="${1:-.env.providers.local}"
SCOPE="autokompetenz-s-projects"
ENVIRONMENTS=(production preview development)
REQUIRED=(
  FEDAPAY_PUBLIC_KEY
  FEDAPAY_SECRET_KEY
  FEDAPAY_WEBHOOK_SECRET
  ULTRASMS_API_KEY
  ULTRASMS_WEBHOOK_SECRET
  ULTRASMS_CALLBACK_URL
)

if [ ! -f "$FILE" ]; then
  echo "Erreur : $FILE introuvable." >&2
  echo "Lance d'abord : bash scripts/set-provider-keys.sh" >&2
  exit 1
fi

chmod 600 "$FILE" 2>/dev/null || true

# shellcheck disable=SC1090
set -a
. "$FILE"
set +a

for name in "${REQUIRED[@]}"; do
  if [ -z "${!name:-}" ]; then
    echo "Erreur : $name est vide dans $FILE." >&2
    exit 1
  fi
done

# Refus des anciennes clés compromises (celles du .env local historique).
old_value() {
  grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || true
}
for pair in "FEDAPAY_SECRET_KEY:FEDAPAY_SECRET_KEY" "ULTRASMS_API_KEY:ULTRASMS_API_KEY"; do
  new_name=${pair%%:*}
  old_name=${pair##*:}
  old=$(old_value "$old_name")
  if [ -n "$old" ] && [ "${!new_name}" = "$old" ]; then
    echo "Erreur : $new_name est identique à l'ancienne clé compromise." >&2
    echo "Génère une nouvelle clé chez le fournisseur avant de continuer." >&2
    exit 1
  fi
done

push_var() {
  local name="$1" value="$2" secret="$3" environment
  for environment in "${ENVIRONMENTS[@]}"; do
    if [ "$secret" = "secret" ]; then
      if ! printf '%s' "$value" | vercel env add "$name" "$environment" \
        --force --sensitive --yes --scope "$SCOPE" >/dev/null 2>&1; then
        echo "Échec : $name ($environment)" >&2
        exit 1
      fi
    else
      if ! printf '%s' "$value" | vercel env add "$name" "$environment" \
        --force --no-sensitive --yes --scope "$SCOPE" >/dev/null 2>&1; then
        echo "Échec : $name ($environment)" >&2
        exit 1
      fi
    fi
  done
  if [ "$secret" = "secret" ]; then
    echo "  $name (${#value} car., secret)"
  else
    echo "  $name = $value"
  fi
}

echo "Envoi des clés fournisseur (valeurs masquées) :"
push_var FEDAPAY_PUBLIC_KEY "$FEDAPAY_PUBLIC_KEY" secret
push_var FEDAPAY_SECRET_KEY "$FEDAPAY_SECRET_KEY" secret
push_var FEDAPAY_WEBHOOK_SECRET "$FEDAPAY_WEBHOOK_SECRET" secret
push_var ULTRASMS_API_KEY "$ULTRASMS_API_KEY" secret
push_var ULTRASMS_WEBHOOK_SECRET "$ULTRASMS_WEBHOOK_SECRET" secret
push_var ULTRASMS_CALLBACK_URL "$ULTRASMS_CALLBACK_URL" config

echo "Bascule des modes en live :"
push_var APP_ENV "production" config
push_var PAYMENTS_MODE "live" config
push_var ULTRASMS_MODE "live" config

echo
echo "✅ Variables poussées sur $SCOPE/numero (production, preview, development)."
echo "   Prochaine étape : redéployer puis vérifier /api/health."
