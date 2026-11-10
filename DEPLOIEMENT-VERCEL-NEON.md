# Déploiement Vercel + Neon

Guide pas à pas pour déployer Numivo en **deux projets Vercel** (front + API)
reliés à une base **Neon PostgreSQL**. La procédure décrite ici correspond au
déploiement de **staging** actuellement en ligne :

| Composant | URL | Projet Vercel |
| --- | --- | --- |
| Front React/Vite | <https://numero-pearl.vercel.app> | `numero` |
| API Express | <https://numero-api.vercel.app> | `numero-api` |

Le front proxifie `/api/*` vers l'API via un rewrite Vercel. Le navigateur ne
parle donc qu'au domaine du front : le cookie de refresh reste **first-party**
(`SameSite=Lax`) et aucun réglage CORS cross-origin n'est nécessaire côté
client.

```
Navigateur ──► numero-pearl.vercel.app
                    │  /api/*  (rewrite Vercel)
                    ▼
              numero-api.vercel.app ──► Neon PostgreSQL (pooled)
```

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

Exemple de variables :

```dotenv
# Connexion applicative (pooler PgBouncer de Neon)
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Connexion directe, utilisée par Prisma Migrate
DIRECT_URL=postgresql://USER:PASSWORD@ep-xxx.REGION.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

`DATABASE_URL` est utilisée par l'API à l'exécution ; `DIRECT_URL` par les
migrations. Le schéma Prisma déclare bien les deux :

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
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
> En staging, le catalogue mock est volontairement conservé pour permettre la
> recette. Avant la mise en live, purger les offres de démonstration et lancer
> une synchronisation réelle Ultra SMS.

Vérification rapide :

```bash
psql "$DIRECT_URL" -c 'select count(*) from "CatalogItem";'
```

---

## 3. Projet API (`numero-api`)

### 3.1 Créer et lier le projet

```bash
cd server
vercel link          # créer le projet « numero-api »
vercel --prod --yes
```

Paramètres du projet :

| Réglage | Valeur |
| --- | --- |
| Framework Preset | **Express** |
| Root Directory | laisser vide (déploiement lancé depuis `server/`) |
| Build Command | détectée (`npm run vercel-build`) |
| Output Directory | laisser vide |
| Node.js | 22.x |

Le fichier `server/vercel.json` force l'installation des dépendances de
développement (nécessaires à `prisma generate`) et déclare le cron :

```json
{
  "installCommand": "npm install --include=dev",
  "crons": [{ "path": "/api/cron/poller", "schedule": "0 3 * * *" }]
}
```

`server/.vercelignore` exclut `.env`, `dist`, les tests et la documentation du
paquet envoyé à Vercel. Sans cela, le fichier `.env` local part dans la
fonction serverless.

### 3.2 Variables d'environnement

À définir dans **Vercel → Project → Settings → Environment Variables**
(environnement *Production*, puisque le staging est un déploiement de
production avec `APP_ENV=staging`) :

| Variable | Staging | Live |
| --- | --- | --- |
| `NODE_ENV` | `production` | `production` |
| `APP_ENV` | `staging` | `production` |
| `DATABASE_URL` | URL Neon **pooled** | URL Neon **pooled** |
| `DIRECT_URL` | URL Neon **directe** | URL Neon **directe** |
| `JWT_ACCESS_SECRET` | `openssl rand -hex 64` | idem, secret distinct |
| `ACCESS_TOKEN_TTL` | `15m` | `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | `7` |
| `COOKIE_SECURE` | `true` | `true` |
| `TRUST_PROXY` | `1` | `1` |
| `APP_URL` | `https://numero-api.vercel.app` | URL API publique |
| `FRONTEND_URL` | `https://numero-pearl.vercel.app` | URL front publique |
| `CORS_ORIGINS` | URL exacte du front | URL exacte du front |
| `ADMIN_EMAIL` | `admin@numivo.local` | adresse réelle |
| `ADMIN_PASSWORD` | mot de passe ≥ 12 caractères | idem, distinct |
| `ADMIN_NAME` | `Administrateur Numivo` | idem |
| `ADMIN_COUNTRY` | `Bénin` | idem |
| `CRON_SECRET` | `openssl rand -hex 32` | idem |
| `ULTRASMS_MODE` | `mock` | `live` |
| `ULTRASMS_API_KEY` | vide | clé réelle |
| `ULTRASMS_WEBHOOK_SECRET` | vide | secret du callback |
| `ULTRASMS_CALLBACK_URL` | vide | `https://<api>/api/webhooks/ultrasms/inbound` |
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

En CLI, par exemple :

```bash
cd server
printf '%s' "$VALUE" | vercel env add NOM_DE_LA_VARIABLE production
vercel --prod --yes      # redéployer après ajout/modification
```

> `NODE_ENV` est forcé à `production` par Vercel. C'est `APP_ENV` (et
> `VERCEL_ENV=preview`) qui distingue staging et live. Les garde-fous
> n'autorisent `mock` que hors environnement live.

### 3.3 Garde-fous au démarrage

L'API refuse de démarrer si l'une des conditions suivantes n'est pas remplie :

- en live : `PAYMENTS_MODE=live` et `ULTRASMS_MODE=live` ;
- en production : `COOKIE_SECURE=true`, `JWT_ACCESS_SECRET` ≥ 64 caractères,
  `ADMIN_PASSWORD` ≥ 12 caractères, `APP_URL` en HTTPS ;
- sur Vercel : `CRON_SECRET` et `DIRECT_URL` présents ;
- en mode live : `ULTRASMS_API_KEY` et `ULTRASMS_WEBHOOK_SECRET` présents ;
- hors mode mock : `FEDAPAY_SECRET_KEY` présent (et son webhook secret en
  production).

En cas d'erreur, le build/déploiement échoue avec la liste des variables
manquantes dans les logs Vercel.

---

## 4. Projet front (`numero`)

### 4.1 Créer et lier le projet

Depuis la racine du dépôt :

```bash
vercel link          # créer le projet « numero »
vercel --prod --yes
```

Paramètres :

| Réglage | Valeur |
| --- | --- |
| Framework Preset | **Vite** |
| Root Directory | racine du dépôt |
| Build Command | `npm run build` (détectée) |
| Output Directory | `dist` (détectée) |
| Node.js | 22.x |

Aucune variable d'environnement n'est nécessaire. En particulier, **ne pas
définir `VITE_API_URL`** : le front doit appeler `/api` sur sa propre origine
pour que le rewrite et le cookie first-party fonctionnent.

### 4.2 Rewrite `/api` et fallback SPA

`vercel.json` à la racine :

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://numero-api.vercel.app/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/api/:path*",
      "headers": [
        { "key": "x-vercel-enable-rewrite-caching", "value": "0" }
      ]
    }
  ]
}
```

- Le premier rewrite envoie les appels API vers le projet `numero-api`.
- Le second sert l'application React pour toutes les routes (SPA).
- L'en-tête `x-vercel-enable-rewrite-caching: 0` empêche Vercel de mettre en
  cache les réponses d'API. L'API renvoie de toute façon `Cache-Control:
  no-store`.

Si le domaine de l'API change, mettre à jour **ce fichier** puis redéployer le
front. C'est le seul endroit où l'URL de l'API est codée en dur.

### 4.3 Cookie de session

Le flux d'authentification utilise :

- un access token JWT renvoyé dans le corps et conservé en mémoire ;
- un refresh token dans un cookie `HttpOnly`, `Secure`, `SameSite=Lax`,
  limité à `Path=/api/auth`.

Comme le navigateur reste sur le domaine du front, le cookie est first-party.
Un appel direct du front vers `numero-api.vercel.app` casserait ce mécanisme
(cookie tiers) : c'est pourquoi le proxy `/api` est obligatoire.

---

## 5. Ordre de déploiement

1. **Neon** : créer la base, appliquer `prisma migrate deploy`, lancer le seed.
2. **API** : créer le projet `numero-api`, renseigner les variables, déployer.
3. **Front** : créer le projet `numero`, déployer.
4. **Vérifier** : santé, proxy, login, cookie, catalogue.

```bash
# 1. Base
cd server && npx prisma migrate deploy && npm run db:seed && cd ..

# 2. API
cd server && vercel --prod --yes && cd ..

# 3. Front
vercel --prod --yes
```

---

## 6. Vérifications après déploiement

```bash
FRONT=https://numero-pearl.vercel.app
API=https://numero-api.vercel.app

# Santé directe de l'API
curl -s "$API/api/health" | jq
# { "status": "ok", "database": "up", "paymentsMode": "mock", ... }

# Santé via le proxy du front
curl -s "$FRONT/api/health" | jq

# Le front répond
curl -s -o /dev/null -w '%{http_code}\n' "$FRONT/"

# Login + cookie de refresh
curl -s -c /tmp/numivo.cookies \
  -H 'Content-Type: application/json' \
  -d '{"email":"client@numivo.local","password":"demo123456"}' \
  "$FRONT/api/auth/login" | jq '{email: .user.email, token: (.accessToken | length)}'

grep -i 'numivo_refresh' /tmp/numivo.cookies
# vérifier : HttpOnly, Secure, Path=/api/auth, SameSite=Lax
```

Parcours de recette complet en staging (aucun argent réel) :

```bash
BASE=https://numero-pearl.vercel.app
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

## 7. Poller et cron

Le poller interroge Ultra SMS pour faire avancer les commandes sans webhook.
Sur Vercel, il n'y a pas de processus de fond : il est déclenché par le cron
`GET /api/cron/poller`, protégé par `CRON_SECRET`.

Vercel Cron envoie automatiquement `Authorization: Bearer $CRON_SECRET` lorsque
la variable `CRON_SECRET` existe sur le projet.

> **Limite Hobby** : un cron ne peut s'exécuter qu'une fois par jour. Un
> planning `* * * * *` fait échouer le déploiement. Le staging utilise donc
> `0 3 * * *` (03:00 UTC).

En production réelle, deux options :

- passer le projet en **Vercel Pro** et repasser le cron à `*/5 * * * *` ;
- conserver le cron quotidien et ajouter un déclencheur externe toutes les
  5 minutes (GitHub Actions, cron-job.org, UptimeRobot…).

Exemple GitHub Actions (`.github/workflows/poller.yml`), à activer seulement si
l'option externe est retenue :

```yaml
name: Numivo poller
on:
  schedule:
    - cron: '*/5 * * * *'
  workflow_dispatch:
jobs:
  poll:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -H "Authorization: Bearer ${{ secrets.NUMIVO_CRON_SECRET }}" \
            https://numero-api.vercel.app/api/cron/poller
```

Le secret `NUMIVO_CRON_SECRET` doit contenir la même valeur que `CRON_SECRET`
sur Vercel.

---

## 8. Passage en live

Checklist avant d'encaisser de l'argent réel :

- [ ] Régénérer les clés FedaPay et Ultra SMS (les clés historiques ont fuité,
      voir `AUDIT-MISE-EN-PRODUCTION.md`).
- [ ] Passer `APP_ENV=production`, `PAYMENTS_MODE=live`,
      `ULTRASMS_MODE=live`.
- [ ] Renseigner `FEDAPAY_*` et `ULTRASMS_*` (clés + secrets de webhook).
- [ ] Déclarer les webhooks :
      `https://<api>/api/webhooks/fedapay` et
      `https://<api>/api/webhooks/ultrasms/inbound`.
- [ ] Supprimer le client de démonstration `client@numivo.local`.
- [ ] Désactiver / purger le catalogue de repli et les offres mock, puis lancer
      une synchronisation Ultra SMS depuis la console admin.
- [ ] Vérifier que `/api/dev/*` renvoie bien `403`.
- [ ] Tester une recharge réelle de 500 XOF puis un achat réel.
- [ ] Mettre en place les sauvegardes Neon et la supervision de
      `GET /api/health`.
- [ ] Utiliser des secrets distincts entre staging et production.

Après modification des variables : `vercel --prod --yes` pour redéployer l'API.

---

## 9. Dépannage

| Symptôme | Cause / correction |
| --- | --- |
| `error TS2688: Cannot find type definition file for 'node'` | Ne pas mettre `"types": ["node"]` dans `server/tsconfig.json`. Vercel installe les devDependencies via `installCommand`. |
| Le fichier `.env` apparaît dans la fonction serverless | Vérifier `server/.vercelignore` (`.env`, `.env.*`). |
| `vercel deploy --prebuilt` échoue avec `ENOENT … readlink '.env'` | Utiliser `vercel --prod --yes` (déploiement normal) au lieu de `--prebuilt`. |
| Le déploiement échoue sur `crons` | Sur Hobby, planning quotidien uniquement (`0 3 * * *`). |
| `PrismaClientInitializationError` / moteur introuvable | `binaryTargets = ["native", "rhel-openssl-3.0.x"]` dans `server/prisma/schema.prisma`. |
| `Configuration refusée : DIRECT_URL est requis` | Ajouter `DIRECT_URL` au projet Vercel. |
| Le login fonctionne mais les appels suivants renvoient 401 | Envoyer l'access token dans `Authorization: Bearer …` ; le cookie ne sert qu'au refresh. |
| Le refresh cookie n'est pas envoyé | Ne pas définir `VITE_API_URL` ; passer par le proxy `/api` du front. |
| Erreur CORS | `CORS_ORIGINS` doit contenir l'origine exacte du front, sans slash final. |
| Les réponses API sont mises en cache | Vérifier `Cache-Control: no-store` et l'en-tête `x-vercel-enable-rewrite-caching`. |

Logs utiles :

```bash
vercel logs https://numero-api.vercel.app
vercel logs https://numero-pearl.vercel.app
vercel env ls production --cwd server
```
