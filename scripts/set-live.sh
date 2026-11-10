#!/usr/bin/env bash
# Prépare la configuration LIVE de Numivo dans `.env.live.local`.
# Toutes les valeurs sensibles sont saisies en mode masqué : rien n'apparaît
# à l'écran, dans l'historique du shell ou dans les arguments des processus.
#
# Usage : bash scripts/set-live.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/.env.live.local"

ask_secret() {
  local label="$1" value
  printf '  %s : ' "$label" >&2
  IFS= read -rs value || true
  printf '\n' >&2
  printf '%s' "$value"
}

ask_text() {
  local label="$1" default="$2" value
  printf '  %s [%s] : ' "$label" "$default" >&2
  IFS= read -r value || true
  printf '%s' "${value:-$default}"
}

require() {
  if [ -z "${2:-}" ]; then
    echo "Erreur : $1 est requis." >&2
    exit 1
  fi
}

echo "Configuration LIVE Numivo" >&2
echo "Les secrets restent invisibles. Sortie : .env.live.local (chmod 600)." >&2
echo >&2

echo "— Neon —" >&2
DATABASE_URL="$(ask_secret 'URL pooled (DATABASE_URL)')"
require DATABASE_URL "$DATABASE_URL"
DIRECT_URL="$(ask_secret 'URL directe (Entrée = déduire sans -pooler)')"
if [ -z "$DIRECT_URL" ]; then
  DIRECT_URL="$(printf '%s' "$DATABASE_URL" | sed 's/-pooler//g')"
fi
require DIRECT_URL "$DIRECT_URL"

echo >&2
echo "— FedaPay —" >&2
FEDAPAY_PUBLIC_KEY="$(ask_secret 'Clé publique')"
FEDAPAY_SECRET_KEY="$(ask_secret 'Clé secrète')"
FEDAPAY_WEBHOOK_SECRET="$(ask_secret 'Secret webhook')"
require FEDAPAY_PUBLIC_KEY "$FEDAPAY_PUBLIC_KEY"
require FEDAPAY_SECRET_KEY "$FEDAPAY_SECRET_KEY"
require FEDAPAY_WEBHOOK_SECRET "$FEDAPAY_WEBHOOK_SECRET"

echo >&2
echo "— Ultra SMS —" >&2
ULTRASMS_API_KEY="$(ask_secret 'Clé API')"
ULTRASMS_WEBHOOK_SECRET="$(ask_secret 'Secret callback')"
require ULTRASMS_API_KEY "$ULTRASMS_API_KEY"
require ULTRASMS_WEBHOOK_SECRET "$ULTRASMS_WEBHOOK_SECRET"

echo >&2
echo "— Administrateur —" >&2
ADMIN_EMAIL="$(ask_text 'Email admin' 'admin@numivo.local')"
ADMIN_PASSWORD="$(ask_secret 'Mot de passe admin (12 caractères minimum)')"
require ADMIN_PASSWORD "$ADMIN_PASSWORD"
if [ "${#ADMIN_PASSWORD}" -lt 12 ]; then
  echo "Erreur : le mot de passe admin doit contenir au moins 12 caractères." >&2
  exit 1
fi
ADMIN_CONFIRM="$(ask_secret 'Confirmer le mot de passe admin')"
if [ "$ADMIN_PASSWORD" != "$ADMIN_CONFIRM" ]; then
  echo "Erreur : les deux mots de passe ne correspondent pas." >&2
  exit 1
fi

echo >&2
echo "— Domaines —" >&2
APP_URL="$(ask_text 'URL publique (front + API)' 'https://numero-pearl.vercel.app')"
FRONTEND_URL="$(ask_text 'URL front publique' 'https://numero-pearl.vercel.app')"

JWT_ACCESS_SECRET="$(openssl rand -hex 64)"
CRON_SECRET="$(openssl rand -hex 32)"

umask 077
: > "$OUT"
write() { printf '%s=%s\n' "$1" "$2" >> "$OUT"; }

write NODE_ENV production
write APP_ENV production
write PORT 4000
write APP_URL "$APP_URL"
write FRONTEND_URL "$FRONTEND_URL"
write CORS_ORIGINS "$FRONTEND_URL"
write TRUST_PROXY 1

write DATABASE_URL "$DATABASE_URL"
write DIRECT_URL "$DIRECT_URL"

write JWT_ACCESS_SECRET "$JWT_ACCESS_SECRET"
write ACCESS_TOKEN_TTL 15m
write REFRESH_TOKEN_TTL_DAYS 7
write COOKIE_SECURE true

write ADMIN_EMAIL "$ADMIN_EMAIL"
write ADMIN_PASSWORD "$ADMIN_PASSWORD"
write ADMIN_NAME "Administrateur Numivo"
write ADMIN_COUNTRY "Bénin"

write CRON_SECRET "$CRON_SECRET"

write ULTRASMS_MODE live
write ULTRASMS_API_KEY "$ULTRASMS_API_KEY"
write ULTRASMS_BASE_URL "https://ultrasmsin.com/api/v1"
write ULTRASMS_WEBHOOK_SECRET "$ULTRASMS_WEBHOOK_SECRET"
write ULTRASMS_CALLBACK_URL "${APP_URL%/}/api/webhooks/ultrasms"
write ULTRASMS_MOCK_SMS_DELAY_MS 12000
write ULTRASMS_POLL_INTERVAL_MS 10000

write PAYMENTS_MODE live
write FEDAPAY_PUBLIC_KEY "$FEDAPAY_PUBLIC_KEY"
write FEDAPAY_SECRET_KEY "$FEDAPAY_SECRET_KEY"
write FEDAPAY_WEBHOOK_SECRET "$FEDAPAY_WEBHOOK_SECRET"

write EUR_XOF_RATE 655.957
write USD_XOF_RATE 615
write TARGET_MARGIN_XOF 2000
write PAYMENT_RATE_MOBILE_MONEY 0.018
write PAYMENT_RATE_CARD 0.036
write PAYMENT_RATE_WALLET 0
write ROUNDING_STEP_XOF 100

write RATE_LIMIT_WINDOW_MS 60000
write RATE_LIMIT_MAX 120
write AUTH_RATE_LIMIT_MAX 10
write LOG_LEVEL info
write SMS_RETENTION_DAYS 30

chmod 600 "$OUT"

echo >&2
echo "✅ .env.live.local créé (600), aucun secret affiché." >&2
echo "   APP_ENV=production | PAYMENTS_MODE=live | ULTRASMS_MODE=live" >&2
echo "   Admin : $ADMIN_EMAIL" >&2
echo "   Callback Ultra SMS : ${APP_URL%/}/api/webhooks/ultrasms" >&2
echo "   Webhook FedaPay    : ${APP_URL%/}/api/webhooks/fedapay" >&2
