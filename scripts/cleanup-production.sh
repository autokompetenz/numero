#!/usr/bin/env bash
# Nettoyage de la base de production avant le passage en live.
#
# Supprime :
#   - le client de démonstration client@numivo.local ;
#   - les paiements, commandes et transactions de portefeuille de test (mock) ;
#   - le catalogue d'offres simulées (ressynchronisé ensuite depuis Ultra SMS) ;
#   - toutes les sessions (refresh tokens).
# Remet tous les soldes de portefeuille à zéro.
#
# Conserve : pays, services, tarification, taux de change, administrateur,
# comptes clients réels.
#
# Usage :
#   bash scripts/cleanup-production.sh --dry-run   # défaut, lecture seule
#   bash scripts/cleanup-production.sh --apply     # exécute (avec sauvegarde)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="${1:---dry-run}"
case "$MODE" in
  --dry-run|--apply) ;;
  *) echo "Usage : bash scripts/cleanup-production.sh [--dry-run|--apply]" >&2; exit 2 ;;
esac

DB="$(grep -E '^DATABASE_URL=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || true)"
if [ -z "$DB" ]; then
  echo "Erreur : DATABASE_URL introuvable dans .env." >&2
  exit 1
fi

counts() {
  psql "$DB" -X -A -F' | ' -c "
    SELECT 'utilisateurs' AS metrique, count(*)::text AS valeur FROM \"User\"
    UNION ALL SELECT 'dont client@numivo.local', count(*)::text FROM \"User\" WHERE email='client@numivo.local'
    UNION ALL SELECT 'catalogue', count(*)::text FROM \"CatalogItem\"
    UNION ALL SELECT 'commandes', count(*)::text FROM \"Order\"
    UNION ALL SELECT 'paiements', count(*)::text FROM \"Payment\"
    UNION ALL SELECT 'transactions portefeuille', count(*)::text FROM \"WalletTransaction\"
    UNION ALL SELECT 'sessions (refresh tokens)', count(*)::text FROM \"RefreshToken\"
    UNION ALL SELECT 'soldes non nuls', count(*)::text FROM \"Wallet\" WHERE \"balanceMinor\" <> 0;
  "
}

echo "Base : $(printf '%s' "$DB" | sha256sum | cut -c1-12)… (Neon)"
echo
echo "État actuel :"
counts
echo

if [ "$MODE" = "--dry-run" ]; then
  cat <<'PLAN'
Actions prévues (--apply) :
  1. sauvegarde JSON des tables concernées dans .backups/ (chmod 600) ;
  2. suppression des remboursements, paiements, transactions, commandes ;
  3. suppression du client de démonstration client@numivo.local ;
  4. suppression de toutes les sessions (refresh tokens) ;
  5. remise à zéro de tous les soldes de portefeuille ;
  6. suppression du catalogue d'offres simulées (ressynchronisation live ensuite).
Aucune modification n'a été faite.
PLAN
  exit 0
fi

# --- Sauvegarde préalable -----------------------------------------------------
BACKUP_DIR="$ROOT/.backups"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$BACKUP_DIR/prod-cleanup-$STAMP.jsonl"
umask 077
: > "$BACKUP"
for table in User Wallet WalletTransaction Payment Order OrderSms Refund CatalogItem; do
  printf '### %s\n' "$table" >> "$BACKUP"
  psql "$DB" -X -A -t -c "SELECT row_to_json(x) FROM \"$table\" x" >> "$BACKUP"
done
chmod 600 "$BACKUP"
echo "Sauvegarde : $BACKUP"
echo

# --- Nettoyage ----------------------------------------------------------------
psql "$DB" -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

DO $$
DECLARE
  n bigint;
BEGIN
  SELECT count(*) INTO n
    FROM "Order" o JOIN "User" u ON u.id = o."userId"
   WHERE u.email = 'client@numivo.local';
  IF n > 0 THEN
    RAISE EXCEPTION 'Le client de démonstration possède % commande(s) : arrêt.', n;
  END IF;

  SELECT count(*) INTO n
    FROM "Payment" p
    JOIN "Wallet" w ON w.id = p."walletId"
    JOIN "User" u ON u.id = w."userId"
   WHERE u.email = 'client@numivo.local';
  IF n > 0 THEN
    RAISE EXCEPTION 'Le client de démonstration possède % paiement(s) : arrêt.', n;
  END IF;
END $$;

DELETE FROM "Refund";
DELETE FROM "Payment";
DELETE FROM "WalletTransaction";
DELETE FROM "Order";
DELETE FROM "User" WHERE email = 'client@numivo.local';
DELETE FROM "RefreshToken";
UPDATE "Wallet" SET "balanceMinor" = 0, "version" = "version" + 1 WHERE "balanceMinor" <> 0;
DELETE FROM "CatalogItem";

COMMIT;
SQL

echo
echo "Après nettoyage :"
counts
echo
echo "✅ Nettoyage terminé. Le catalogue est vide : lancer une synchronisation"
echo "   Ultra SMS depuis la console admin une fois ULTRASMS_MODE=live."
