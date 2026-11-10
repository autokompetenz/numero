#!/usr/bin/env bash
# Copie les variables d'environnement applicatives du projet numero-api vers
# le projet numero (front + API fusionnés). Les valeurs ne sont jamais affichées.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SOURCE="${1:-/tmp/opencode/numero-api.production.env}"
SCOPE="autokompetenz-s-projects"
ENVIRONMENTS=(production preview development)

count=0
while IFS= read -r line; do
  case "$line" in ''|'#'*) continue ;; esac
  key=${line%%=*}
  value=${line#*=}
  case "$key" in VERCEL*|TURBO*|NX_*) continue ;; esac
  if [[ $value == \"*\" ]]; then
    value=${value:1:${#value}-2}
  fi
  if [ "$key" = APP_URL ]; then
    value="https://numero-pearl.vercel.app"
  fi
  for environment in "${ENVIRONMENTS[@]}"; do
    if ! printf '%s' "$value" | vercel env add "$key" "$environment" \
      --force --no-sensitive --yes --scope "$SCOPE" >/dev/null 2>&1; then
      echo "Échec : $key ($environment)" >&2
      exit 1
    fi
  done
  count=$((count + 1))
  echo "  $key"
done < "$SOURCE"

echo "Terminé : $count variables × ${#ENVIRONMENTS[@]} environnements."
