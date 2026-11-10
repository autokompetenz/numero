#!/usr/bin/env bash
# Test bout-en-bout de l'API Numivo (local, modes mock).
# Usage : bash scripts/e2e-api.sh [base_url_api]
# Pré-requis : API démarrée, PostgreSQL up, seed exécuté.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API="${1:-http://localhost:4000/api}"
JAR="$(mktemp -t numivo-cookies.XXXXXX)"
trap 'rm -f "$JAR"' EXIT

pass=0
fail=0
check() {
  if [ "$2" = "$3" ]; then
    echo "PASS  $1 ($2)"
    pass=$((pass + 1))
  else
    echo "FAIL  $1 (attendu=$3 obtenu=$2)"
    fail=$((fail + 1))
  fi
}

ADMIN_PASSWORD_VALUE="${ADMIN_PASSWORD:-}"
if [ -z "$ADMIN_PASSWORD_VALUE" ] && [ -f "$ROOT/.env" ]; then
  ADMIN_PASSWORD_VALUE="$(grep '^ADMIN_PASSWORD=' "$ROOT/.env" | cut -d= -f2-)"
fi
if [ -z "$ADMIN_PASSWORD_VALUE" ]; then
  echo "ADMIN_PASSWORD introuvable — les contrôles admin seront ignorés." >&2
fi

echo "--- Santé ---"
check "health" "$(curl -s -o /dev/null -w '%{http_code}' "$API/health")" "200"

echo "--- Création de compte ---"
NEW_EMAIL="e2e.compte.$(date +%s%N)@numivo.local"
REGISTER=$(curl -s -w '\n%{http_code}' -H 'Content-Type: application/json' \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"MotDePasseTest123\",\"name\":\"Compte E2E\",\"country\":\"Bénin\",\"preferredCurrency\":\"XOF\"}" \
  "$API/auth/register")
REGISTER_CODE=$(echo "$REGISTER" | tail -1)
REGISTER_BODY=$(echo "$REGISTER" | sed '$d')
REGISTER_TOKEN=$(echo "$REGISTER_BODY" | jq -r '.accessToken // empty')
NEW_ID=$(echo "$REGISTER_BODY" | jq -r '.user.id // empty')
check "inscription client" "$REGISTER_CODE" "201"
check "rôle du nouveau compte" "$(echo "$REGISTER_BODY" | jq -r '.user.role')" "CLIENT"
check "mot de passe jamais renvoyé" "$(echo "$REGISTER_BODY" | jq -r '.user.passwordHash == null')" "true"
WALLETS=$(curl -s -H "Authorization: Bearer $REGISTER_TOKEN" "$API/wallet")
check "trois portefeuilles créés" "$(echo "$WALLETS" | jq '.wallets | length')" "3"
check "soldes initiaux à zéro" "$(echo "$WALLETS" | jq '[.wallets[].balance] | add')" "0"
DUPLICATE=$(curl -s -w '\n%{http_code}' -H 'Content-Type: application/json' \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"MotDePasseTest123\",\"name\":\"Doublon\"}" \
  "$API/auth/register")
check "e-mail déjà utilisé" "$(echo "$DUPLICATE" | tail -1)" "409"
check "code CONFLICT" "$(echo "$DUPLICATE" | sed '$d' | jq -r '.error.code')" "CONFLICT"
check "connexion du nouveau compte" "$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"MotDePasseTest123\"}" "$API/auth/login")" "200"

echo "--- Connexion client ---"
LOGIN=$(curl -s -c "$JAR" -H 'Content-Type: application/json' \
  -d '{"email":"client@numivo.local","password":"demo123456"}' "$API/auth/login")
CTOKEN=$(echo "$LOGIN" | jq -r '.accessToken // empty')
check "login client" "$([ -n "$CTOKEN" ] && echo ok || echo ko)" "ok"
check "rôle client" "$(echo "$LOGIN" | jq -r '.user.role')" "CLIENT"
AUTH="Authorization: Bearer $CTOKEN"

echo "--- Catalogue ---"
CAT=$(curl -s -H "$AUTH" "$API/catalog?currency=XOF&paymentMethod=MOBILE_MONEY")
COUNT=$(echo "$CAT" | jq '.items | length')
check "catalogue non vide" "$([ "$COUNT" -gt 0 ] && echo ok || echo ko)" "ok"
ITEM=$(echo "$CAT" | jq -r 'first(.items[] | select(.type=="TEMPORARY" and .sellingPriceXof <= 20000) | .id) // empty')
PRICE=$(echo "$CAT" | jq -r --arg id "$ITEM" 'first(.items[] | select(.id==$id) | .sellingPriceXof)')
echo "Item=$ITEM prix=$PRICE XOF"
Q=$(curl -s -H "$AUTH" "$API/catalog/quote?itemId=$ITEM&currency=XOF&paymentMethod=MOBILE_MONEY")
check "devis serveur" "$(echo "$Q" | jq -r '.price.sellingPriceXof')" "$PRICE"
check "marge >= 2000" "$(echo "$Q" | jq -r '.price.estimatedNetMarginXof >= 2000')" "true"

echo "--- Recharge portefeuille (mock FedaPay) ---"
TOP=$(curl -s -b "$JAR" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"amountMinor":20000,"paymentMethod":"MOBILE_MONEY"}' "$API/wallet/topups")
PID=$(echo "$TOP" | jq -r '.payment.id // empty')
CHECKOUT=$(echo "$TOP" | jq -r '.checkoutUrl // empty')
check "topup créé" "$([ -n "$PID" ] && echo ok || echo ko)" "ok"
check "checkout mock" "$(echo "$CHECKOUT" | grep -c 'mock_payment=' || true)" "1"
curl -s -X POST "$API/dev/payments/$PID/approve" >/dev/null
PAY=$(curl -s -b "$JAR" -H "$AUTH" "$API/wallet/payments/$PID")
check "paiement topup approuvé" "$(echo "$PAY" | jq -r '.payment.status')" "APPROVED"
BAL=$(curl -s -b "$JAR" -H "$AUTH" "$API/wallet" | jq -r 'first(.wallets[] | select(.currency=="XOF") | .balance)')
check "solde crédité" "$([ "$BAL" -ge 20000 ] && echo ok || echo ko)" "ok"

echo "--- Achat portefeuille + SMS ---"
KEY1="e2e-wallet-$(date +%s%N)"
ORD=$(curl -s -b "$JAR" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"catalogItemId\":\"$ITEM\",\"paymentMethod\":\"WALLET\",\"currency\":\"XOF\",\"idempotencyKey\":\"$KEY1\"}" "$API/orders")
OID=$(echo "$ORD" | jq -r '.order.id // empty')
OSTATUS=$(echo "$ORD" | jq -r '.order.status // empty')
check "commande wallet créée" "$([ -n "$OID" ] && echo ok || echo ko)" "ok"
check "commande wallet engagée" "$([ "$OSTATUS" = "PROCESSING" ] || [ "$OSTATUS" = "PAID" ] && echo ok || echo ko)" "ok"
SMS=$(curl -s -X POST "$API/dev/orders/$OID/sms")
check "simulation SMS" "$(echo "$SMS" | jq -r '.ok')" "true"
ORD2=$(curl -s -b "$JAR" -H "$AUTH" "$API/orders/$OID")
check "commande terminée" "$(echo "$ORD2" | jq -r '.order.status')" "COMPLETED"
check "SMS présent" "$(echo "$ORD2" | jq '.order.smsMessages | length')" "1"

echo "--- Achat + annulation/remboursement wallet ---"
BAL_BEFORE=$(curl -s -b "$JAR" -H "$AUTH" "$API/wallet" | jq -r 'first(.wallets[] | select(.currency=="XOF") | .balance)')
KEY2="e2e-cancel-$(date +%s%N)"
ORD3=$(curl -s -b "$JAR" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"catalogItemId\":\"$ITEM\",\"paymentMethod\":\"WALLET\",\"currency\":\"XOF\",\"idempotencyKey\":\"$KEY2\"}" "$API/orders")
OID3=$(echo "$ORD3" | jq -r '.order.id')
CAN=$(curl -s -b "$JAR" -H "$AUTH" -X POST "$API/orders/$OID3/cancel")
check "annulation fournisseur" "$(echo "$CAN" | jq -r '.order.status')" "CANCELLED"
check "motif d'annulation" "$(echo "$CAN" | jq -r '.order.cancellationReason != null')" "true"
BAL_AFTER=$(curl -s -b "$JAR" -H "$AUTH" "$API/wallet" | jq -r 'first(.wallets[] | select(.currency=="XOF") | .balance)')
check "solde restauré" "$BAL_AFTER" "$BAL_BEFORE"

echo "--- Achat FedaPay mock ---"
KEY3="e2e-fedapay-$(date +%s%N)"
ORD4=$(curl -s -b "$JAR" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"catalogItemId\":\"$ITEM\",\"paymentMethod\":\"MOBILE_MONEY\",\"currency\":\"XOF\",\"mobileMoneyOperator\":\"MTN\",\"idempotencyKey\":\"$KEY3\"}" "$API/orders")
OID4=$(echo "$ORD4" | jq -r '.order.id')
PID4=$(echo "$ORD4" | jq -r '.payment.id')
PREF4=$(echo "$ORD4" | jq -r '.payment.reference')
check "commande FedaPay en attente" "$(echo "$ORD4" | jq -r '.order.status')" "PENDING_PAYMENT"
curl -s -X POST "$API/dev/payments/$PID4/approve" >/dev/null
VER=$(curl -s -b "$JAR" -H "$AUTH" -X POST "$API/orders/$OID4/verify-payment")
check "paiement FedaPay confirmé" "$(echo "$VER" | jq -r '.payment.status')" "APPROVED"
check "commande FedaPay engagée" "$(echo "$VER" | jq -r '.order.status')" "PROCESSING"
BYREF=$(curl -s -b "$JAR" -H "$AUTH" "$API/payments/by-reference/$PREF4")
check "retour paiement par référence" "$(echo "$BYREF" | jq -r '.orderId')" "$OID4"

echo "--- Console admin ---"
check "accès admin refusé au client" "$(curl -s -o /dev/null -w '%{http_code}' -H "$AUTH" "$API/admin/stats")" "403"
if [ -n "$ADMIN_PASSWORD_VALUE" ]; then
  ALOGIN=$(curl -s -H 'Content-Type: application/json' \
    -d "$(jq -n --arg p "$ADMIN_PASSWORD_VALUE" '{email:"admin@numivo.local",password:$p}')" "$API/auth/login")
  ATOKEN=$(echo "$ALOGIN" | jq -r '.accessToken // empty')
  AAUTH="Authorization: Bearer $ATOKEN"
  check "login admin" "$([ -n "$ATOKEN" ] && echo ok || echo ko)" "ok"
  check "stats admin" "$(curl -s -H "$AAUTH" "$API/admin/stats" | jq -r '.totals.orders > 0')" "true"
  check "fonds clients" "$(curl -s -H "$AAUTH" "$API/admin/stats" | jq -r '.walletLiabilitiesXof >= 0')" "true"
  AORD=$(curl -s -H "$AAUTH" "$API/admin/orders?page=1&limit=5")
  check "liste commandes admin" "$(echo "$AORD" | jq -r '.orders | length > 0')" "true"
  check "email client dans commande" "$(echo "$AORD" | jq -r '.orders[0].userEmail')" "client@numivo.local"
  AUSERS=$(curl -s -H "$AAUTH" "$API/admin/users?page=1&limit=100")
  check "liste utilisateurs" "$(echo "$AUSERS" | jq -r '.users | length > 0')" "true"
  ACAT=$(curl -s -H "$AAUTH" "$API/admin/catalog")
  check "catalogue admin" "$(echo "$ACAT" | jq -r '.items | length > 0')" "true"
  AID=$(echo "$ACAT" | jq -r '.items[0].id')
  ACOST=$(echo "$ACAT" | jq -r '.items[0].supplierCostXof')
  PATCH=$(curl -s -H "$AAUTH" -H 'Content-Type: application/json' -X PATCH \
    -d "{\"supplierCostXofMinor\":$ACOST}" "$API/admin/catalog/$AID")
  check "patch coût catalogue" "$(echo "$PATCH" | jq -r '.ok')" "true"
  PRICING=$(curl -s -H "$AAUTH" "$API/admin/pricing")
  TARGET=$(echo "$PRICING" | jq -r '.pricing.targetMarginXof')
  PPATCH=$(curl -s -H "$AAUTH" -H 'Content-Type: application/json' -X PATCH \
    -d "{\"targetMarginXof\":$TARGET}" "$API/admin/pricing")
  check "patch tarification" "$(echo "$PPATCH" | jq -r '.pricing.targetMarginXof')" "$TARGET"
  PB=$(curl -s -H "$AAUTH" "$API/admin/provider/balance")
  check "solde fournisseur" "$(echo "$PB" | jq -r '.balance.balanceCents != null')" "true"
  check "journal audit" "$(curl -s -H "$AAUTH" "$API/admin/audit?page=1&limit=5" | jq -r '.logs | length > 0')" "true"
  CID=$(echo "$AUSERS" | jq -r 'first(.users[] | select(.email=="client@numivo.local") | .id) // empty')
  UP=$(curl -s -H "$AAUTH" -H 'Content-Type: application/json' -X PATCH -d '{"status":"ACTIVE"}' "$API/admin/users/$CID")
  check "mise à jour utilisateur" "$(echo "$UP" | jq -r '.user.status')" "ACTIVE"

  RESET=$(curl -s -H "$AAUTH" -X POST "$API/admin/users/$NEW_ID/reset-password")
  TEMP_PASSWORD=$(echo "$RESET" | jq -r '.temporaryPassword // empty')
  check "réinitialisation par admin" "$([ -n "$TEMP_PASSWORD" ] && echo ok || echo ko)" "ok"
  check "mot de passe temporaire assez long" "$([ "${#TEMP_PASSWORD}" -ge 12 ] && echo ok || echo ko)" "ok"
  check "connexion avec mot de passe temporaire" "$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json'     -d "$(jq -n --arg p "$TEMP_PASSWORD" --arg e "$NEW_EMAIL" '{email:$e,password:$p}')" "$API/auth/login")" "200"
  check "ancien mot de passe refusé" "$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json'     -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"MotDePasseTest123\"}" "$API/auth/login")" "401"
  ADMIN_ID=$(echo "$ALOGIN" | jq -r '.user.id')
  check "auto-réinitialisation refusée" "$(curl -s -o /dev/null -w '%{http_code}' -H "$AAUTH" -X POST "$API/admin/users/$ADMIN_ID/reset-password")" "403"
else
  echo "SKIP  contrôles admin (ADMIN_PASSWORD absent)"
fi

echo "======================================"
echo "Résultat : $pass réussis, $fail échoués"
[ "$fail" -eq 0 ]
