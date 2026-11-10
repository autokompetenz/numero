# Déploiement Vercel + Neon

Guide pas à pas pour déployer Numivo en **un seul projet Vercel** (front Vite +
API Express) relié à une base **Neon PostgreSQL**. La procédure décrit le
déploiement actuellement en ligne :

| Composant | URL | Projet Vercel |
| --- | --- | --- |
| Front React/Vite + API Express | <https://numero-pearl.vercel.app> | `numero` |

Le front et l'API partagent la même origine : le cookie de refresh reste
**first-party** (`SameSite=Lax`) et aucun CORS cross-origin n'est nécessaire.

```
Navigateur ──► numero-pearl.vercel.app
                    ├── /            → build Vite (public/)
                    ├── /assets/*    → fichiers statiques
                    └── /api/*       → Express ──► Neon PostgreSQL (pooled)
```

> L'ancien projet séparé `numero-api` n'est plus utilisé. Il peut être supprimé
> depuis le dashboard Vercel une fois le projet fusionné validé.

---

## 1. Prérequis

- Node.js 22 et npm
- Un compte [Vercel](https://vercel.com) (Hobby suffit pour le staging)
- Un compte [Neon](https://neon.tech)
- La CLI Vercel : `npm i -g vercel` puis `vercel login`
- `psql` ou `npx prisma` pour initialiser la base
- Le dépôt cloné en local

> Les commandes ci-dessous supposent que vous êtes à la racine du dépôt.

---

## 2. Base de données Neon

### 2.1 Créer le projet

1. Dans la console Neon, créer un projet (région proche des utilisateurs ;
   le déploiement actuel utilise `us-east-2`).
2. Récupérer la chaîne de connexion **pooled** (l'hôte contient `-pooler`).
3. En déduire la chaîne **directe** en retirant `-pooler` de l'hôte.

```dotenv
# Connexion applicative (pooler PgBouncer de Neon)
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Connexion directe, utilisée par Prisma Migrate
DIRECT_URL=postgresql://USER:PASSWORD@ep-xxx.REGION.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

### 2.2 Appliquer le schéma

Depuis la racine du dépôt, créer un `.env` local contenant au minimum
`DATABASE_URL` et `DIRECT_URL`, puis :

```bash
cd server
npm install
npx prisma migrate deploy
npm run db:seed
cd ..
```

Le seed est idempotent. Il crée :

- 12 pays, 12 services, la configuration tarifaire et les taux de change ;
- le catalogue de repli et les offres du fournisseur mock ;
- l'administrateur `ADMIN_EMAIL` / `ADMIN_PASSWORD` ;
- un client de démonstration `client@numivo.local` / `demo123456` lorsque
  `NODE_ENV` n'est pas `production`.

> Le seed de staging est donc lancé **en local** (avec `NODE_ENV=development`
> dans le `.env`), pas depuis une fonction Vercel où `NODE_ENV=production`.
> Avant la mise en live, purger les offres de démonstration et lancer une
> synchronisation réelle Ultra SMS.

---

## 3. Projet Vercel unique (`numero`)

### 3.1 Structure

| Fichier | Rôle |
| --- | --- |
| `app.ts` | Point d'entrée du preset Express : réexporte `server/src/app.ts`. |
| `server/` | API Express, Prisma et migrations. |
| `src/` | Front React. |
| `static/` | Fichiers copiés tels quels par Vite. |
| `public/` | **Généré** au build (front compilé), ignoré par Git. |
| `vercel.json` | Preset Express, commandes de build, rewrite SPA, cron. |

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "express",
  "installCommand": "npm install --include=dev && npm --prefix server install --include=dev",
  "buildCommand": "npm run build",
  "rewrites": [
    { "source": "/((?!api|assets/).*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/api/:path*",
      "headers": [{ "key": "Cache-Control", "value": "no-store" }]
    }
  ],
  "crons": [{ "path": "/api/cron/poller", "schedule": "0 3 * * *" }]
}
```

- `npm run build` exécute `vite build` (sortie dans `public/`) puis
  `prisma generate`.
- Le rewrite sert l'application React pour toutes les routes **sauf**
  `/api/*` et `/assets/*` (negative lookahead).
- `express.static()` est ignoré par Vercel : les fichiers de `public/**` sont
  servis par le CDN.

### 3.2 Créer et lier le projet

```bash
vercel link          # créer ou lier le projet « numero »
```

Paramètres :

| Réglage | Valeur |
| --- | --- |
| Framework Preset | **Express** (forcé dans `vercel.json`) |
| Root Directory | racine du dépôt |
| Install Command | `npm install --include=dev && npm --prefix server install --include=dev` |
| Build Command | `npm run build` |
| Output Directory | `public` |
| Node.js | 22.x |

### 3.3 Variables d'environnement

À définir dans **Vercel → Project → Settings → Environment Variables**
(Production, Preview et Development). Le staging est un déploiement de
production avec `APP_ENV=staging`.

| Variable | Staging | Live |
| --- | --- | --- |
| `NODE_ENV` | `production` (forcé) | `production` (forcé) |
| `APP_ENV` | `staging` | `production` |
| `DATABASE_URL` | URL Neon **pooled** | URL Neon **pooled** |
| `DIRECT_URL` | URL Neon **directe** | URL Neon **directe** |
| `JWT_ACCESS_SECRET` | `openssl rand -hex 64` | idem, secret distinct |
| `ACCESS_TOKEN_TTL` | `15m` | `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | `7` |
| `COOKIE_SECURE` | `true` | `true` |
| `TRUST_PROXY` | `1` | `1` |
| `APP_URL` | `https://numero-pearl.vercel.app` | URL publique |
| `FRONTEND_URL` | `https://numero-pearl.vercel.app` | URL publique |
| `CORS_ORIGINS` | URL exacte du front | URL exacte du front |
| `ADMIN_EMAIL` | `admin@numivo.local` | adresse réelle |
| `ADMIN_PASSWORD` | mot de passe ≥ 12 caractères | idem, distinct |
| `ADMIN_NAME` | `Administrateur Numivo` | idem |
| `ADMIN_COUNTRY` | `Bénin` | idem |
| `CRON_SECRET` | `openssl rand -hex 32` | idem |
| `ULTRASMS_MODE` | `mock` | `live` |
| `ULTRASMS_API_KEY` | vide | clé réelle |
| `ULTRASMS_WEBHOOK_SECRET` | vide | secret du callback |
| `ULTRASMS_CALLBACK_URL` | vide | `https://numero-pearl.vercel.app/api/webhooks/ultrasms` |
| `PAYMENTS_MODE` | `mock` | `live` |
| `FEDAPAY_PUBLIC_KEY` | vide | clé réelle |
| `FEDAPAY_SECRET_KEY` | vide | clé réelle |
| `FEDAPAY_WEBHOOK_SECRET` | vide | secret du webhook |
| `EUR_XOF_RATE` | `655.957` | taux du jour |
| `USD_XOF_RATE` | `615` | taux du jour |
| `TARGET_MARGIN_XOF` | `2000` | `2000` |
| `PAYMENT_RATE_MOBILE_MONEY` | `0.018` | taux contractuel |
| `PAYMENT_RATE_CARD` | `0.036` | taux contractuel |
| `PAYMENT_RATE_WALLET` | `0` | `0` |
| `ROUNDING_STEP_XOF` | `100` | `100` |
| `RATE_LIMIT_WINDOW_MS` | `60000` | `60000` |
| `RATE_LIMIT_MAX` | `120` | `120` |
| `AUTH_RATE_LIMIT_MAX` | `10` | `10` |
| `LOG_LEVEL` | `info` | `info` |
| `SMS_RETENTION_DAYS` | `30` | `30` |

En CLI :

```bash
printf '%s' "$VALUE" | vercel env add NOM_DE_LA_VARIABLE production
vercel --prod --yes      # redéployer après ajout/modification
```

Pour repartir d'un projet existant, `scripts/push-merged-env.sh` copie les
variables applicatives d'un export `vercel env pull` vers les trois
environnements du projet fusionné.

> `NODE_ENV` est forcé à `production` par Vercel. C'est `APP_ENV` qui distingue
> staging et live. Les garde-fous n'autorisent `mock` que hors environnement
> live.

### 3.4 Garde-fous au démarrage

L'API refuse de démarrer si :

- en live : `PAYMENTS_MODE=live` et `ULTRASMS_MODE=live` ;
- en production : `COOKIE_SECURE=true`, `JWT_ACCESS_SECRET` ≥ 64 caractères,
  `ADMIN_PASSWORD` ≥ 12 caractères, `APP_URL` en HTTPS ;
- sur Vercel : `CRON_SECRET` et `DIRECT_URL` présents ;
- en mode live : `ULTRASMS_API_KEY` et `ULTRASMS_WEBHOOK_SECRET` présents ;
- hors mode mock : `FEDAPAY_SECRET_KEY` présent (et son webhook secret en
  production).

---

## 4. Déployer

```bash
# Prévisualisation (recommandé avant la production)
vercel deploy --yes

# Vérifier l'URL de preview, puis promouvoir le build testé
vercel promote <url-de-previsualisation> --yes

# Ou directement en production
vercel --prod --yes
```

> `vercel deploy --prebuilt` échoue avec `ENOENT … readlink '.env'` à cause du
> lien symbolique `server/.env` : utiliser un déploiement normal.

---

## 5. Vérifications après déploiement

```bash
BASE=https://numero-pearl.vercel.app

# Santé (front + API + base)
curl -s "$BASE/api/health" | jq
# { "status": "ok", "database": "up", "paymentsMode": "mock", ... }

# Front et fallback SPA
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' "$BASE/"
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' "$BASE/dashboard"

# Webhooks déclarés (503 tant que le secret n'est pas configuré)
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/api/webhooks/fedapay"
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/api/webhooks/ultrasms"

# Login
curl -s -H 'Content-Type: application/json' \
  -H "Origin: $BASE" \
  -d '{"email":"client@numivo.local","password":"demo123456"}' \
  "$BASE/api/auth/login" | jq '{email: .user.email, token: (.accessToken | length)}'
```

Parcours de recette complet en staging (aucun argent réel) :

```bash
TOKEN=$(curl -s -H 'Content-Type: application/json' \
  -d '{"email":"client@numivo.local","password":"demo123456"}' \
  "$BASE/api/auth/login" | jq -r .accessToken)

# 1. Recharge simulée de 10 000 XOF
TOPUP=$(curl -s -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"amountMinor":10000,"paymentMethod":"MOBILE_MONEY"}' \
  "$BASE/api/wallet/topups")
PAYMENT_ID=$(echo "$TOPUP" | jq -r .payment.id)
curl -s -X POST "$BASE/api/dev/payments/$PAYMENT_ID/approve" | jq

# 2. Achat par portefeuille
ITEM_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/catalog?currency=XOF&paymentMethod=WALLET&limit=1" | jq -r '.items[0].id')
ORDER_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"catalogItemId\":\"$ITEM_ID\",\"paymentMethod\":\"WALLET\",\"currency\":\"XOF\"}" \
  "$BASE/api/orders" | jq -r .order.id)

# 3. Réception SMS simulée → commande COMPLETED
curl -s -X POST "$BASE/api/dev/orders/$ORDER_ID/sms" | jq
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/orders/$ORDER_ID" \
  | jq '.order | {reference, status, phoneNumber}'
```

Résultat attendu : `status: "COMPLETED"` et un SMS mock contenant un code OTP.

---

## 6. Poller et cron

Le poller interroge Ultra SMS pour faire avancer les commandes sans webhook.
Sur Vercel, il n'y a pas de processus de fond : il est déclenché par
`GET /api/cron/poller`, protégé par `CRON_SECRET`.

Vercel Cron envoie automatiquement `Authorization: Bearer $CRON_SECRET` lorsque
la variable `CRON_SECRET` existe sur le projet.

> **Limite Hobby** : un cron ne peut s'exécuter qu'une fois par jour. Le projet
> utilise `0 3 * * *` (03:00 UTC). Le workflow GitHub Actions
> `.github/workflows/poller.yml` assure un passage toutes les 5 minutes.

Le secret `NUMIVO_CRON_SECRET` du dépôt GitHub doit contenir la même valeur que
`CRON_SECRET` sur Vercel.

---

## 7. Passage en live

Checklist avant d'encaisser de l'argent réel :

- [ ] Régénérer les clés FedaPay et Ultra SMS (les clés historiques ont fuité,
      voir `AUDIT-MISE-EN-PRODUCTION.md`).
- [ ] Passer `APP_ENV=production`, `PAYMENTS_MODE=live`,
      `ULTRASMS_MODE=live`.
- [ ] Renseigner `FEDAPAY_*` et `ULTRASMS_*` (clés + secrets de webhook).
- [ ] Déclarer les webhooks :
      `https://numero-pearl.vercel.app/api/webhooks/fedapay` et
      `https://numero-pearl.vercel.app/api/webhooks/ultrasms`.
- [ ] Supprimer le client de démonstration `client@numivo.local`.
- [ ] Désactiver / purger le catalogue de repli et les offres mock, puis lancer
      une synchronisation Ultra SMS depuis la console admin.
- [ ] Vérifier que `/api/dev/*` renvoie bien `403`.
- [ ] Tester une recharge réelle de 500 XOF puis un achat réel.
- [ ] Mettre en place les sauvegardes Neon et la supervision de
      `GET /api/health`.
- [ ] Utiliser des secrets distincts entre staging et production.

Après modification des variables : `vercel --prod --yes` pour redéployer.

---

## 8. Dépannage

| Symptôme | Cause / correction |
| --- | --- |
| `Cannot find type definition file for 'vite/client'` | Le preset Express transpile `app.ts` avec le `tsconfig.json` racine. Les types Vite sont référencés dans `src/vite-env.d.ts`, pas dans `compilerOptions.types`. |
| `error TS2688: Cannot find type definition file for 'node'` | Ne pas mettre `"types": ["node"]` dans `server/tsconfig.json`. |
| `Module not found: ./components/public/...` au build Vercel | Un motif `.vercelignore` non ancré (ex. `public`) exclut aussi `src/components/public`. Utiliser `/public`. |
| Le fichier `.env` apparaît dans la fonction serverless | Vérifier `.vercelignore` (`.env`, `.env.*`). |
| `vercel deploy --prebuilt` échoue avec `ENOENT … readlink '.env'` | Utiliser `vercel deploy` / `vercel --prod` (déploiement normal). |
| Le déploiement échoue sur `crons` | Sur Hobby, planning quotidien uniquement (`0 3 * * *`). |
| `PrismaClientInitializationError` / moteur introuvable | `binaryTargets = ["native", "rhel-openssl-3.0.x"]` dans `server/prisma/schema.prisma`. |
| `Configuration refusée : DIRECT_URL est requis` | Ajouter `DIRECT_URL` au projet Vercel. |
| Le login fonctionne mais les appels suivants renvoient 401 | Envoyer l'access token dans `Authorization: Bearer …` ; le cookie ne sert qu'au refresh. |
| Le refresh cookie n'est pas envoyé | Ne pas définir `VITE_API_URL` ; le front doit appeler `/api` sur sa propre origine. |
| Erreur CORS | `CORS_ORIGINS` doit contenir l'origine exacte, sans slash final. |
| Les réponses API sont mises en cache | Vérifier `Cache-Control: no-store` (API et `vercel.json`). |
