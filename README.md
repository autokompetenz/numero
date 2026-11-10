# Numivo — numéros virtuels, portefeuille et paiements

Application complète (frontend React/Vite + API Node/Express + PostgreSQL) pour
vendre des numéros virtuels temporaires et des locations, recevoir les SMS via
Ultra SMS, encaisser par FedaPay et gérer un portefeuille client en XOF.

> **État actuel** : parcours complet fonctionnel en local et en **staging
> Vercel + Neon** avec les fournisseurs simulés (`ULTRASMS_MODE=mock`,
> `PAYMENTS_MODE=mock`) :
> [numero-pearl.vercel.app](https://numero-pearl.vercel.app). Le passage en clés
> réelles se fait uniquement par configuration, sans modification de code.

---

## 1. Architecture

```
Navigateur ──► React/Vite (src/) ──► API Express (server/src/) ──► PostgreSQL
                                                │
                                                ├─► Ultra SMS (numéros + SMS)
                                                └─► FedaPay (encaissement)
```

- **Frontend** : React 19, Vite, Tailwind, TypeScript. Client HTTP natif
  (`src/lib/api.ts`) avec access token en mémoire et refresh par cookie
  `httpOnly`.
- **API** : Express 4, Prisma 6, Zod, Argon2, JWT, Helmet, rate limiting.
- **Données** : PostgreSQL 17. Tous les montants financiers sont stockés en
  **entiers d'unités mineures** (`BigInt`), jamais en flottants.
- **Fournisseurs** : adaptateurs interchangeables `live`/`mock` pour Ultra SMS
  et `sandbox`/`live`/`mock` pour FedaPay.

### Arborescence utile

| Chemin | Rôle |
| --- | --- |
| `src/` | Interface React (public, client, admin, auth) |
| `src/lib/api.ts` | Client HTTP centralisé, refresh automatique |
| `src/context/AppContext.tsx` | Source de vérité de l'état applicatif |
| `server/src/routes/` | Routes REST (auth, catalogue, commandes, wallet, paiements, admin, webhooks, dev) |
| `server/src/services/` | Métier : tarification, commandes, remboursements, fulfillment, audit |
| `server/src/providers/` | Clients Ultra SMS et FedaPay (live + mock) |
| `server/prisma/schema.prisma` | Modèle de données |
| `server/prisma/migrations/` | Migrations SQL versionnées |
| `scripts/e2e-api.sh` | Recette bout-en-bout de l'API |
| `scripts/ui-check.cjs` | Recette navigateur (Chrome headless + Playwright) |
| `scripts/set-keys.sh` | Saisie masquée des clés fournisseur dans `.env` |
| `vercel.json` | Projet front : rewrite `/api` et fallback SPA |
| `server/vercel.json` | Projet API : build, cron du poller |
| `DEPLOIEMENT-VERCEL-NEON.md` | Guide de déploiement front + API + Neon |

---

## 2. Prérequis

- Node.js 22+ et npm
- PostgreSQL 17 en local **ou** une base [Neon](https://neon.tech)
- `jq` et `curl` pour les scripts de recette
- Chrome/Chromium + Playwright pour `scripts/ui-check.cjs`
- Pour le déploiement : comptes Vercel et Neon, CLI `vercel`

---

## 3. Démarrage local

### 3.1 Base de données

Avec un PostgreSQL local (adapter l'utilisateur, le mot de passe et le port) :

```bash
createuser numivo --pwprompt
createdb numivo --owner numivo
psql "postgresql://numivo:numivo_dev_password@127.0.0.1:5432/numivo" -c 'select 1'
```

Avec Neon, créer un projet et utiliser sa chaîne de connexion **pooled** dans
`DATABASE_URL`, puis la même chaîne sans `-pooler` dans `DIRECT_URL`. Voir
[DEPLOIEMENT-VERCEL-NEON.md](DEPLOIEMENT-VERCEL-NEON.md#2-base-de-données-neon).

### 3.2 Configuration

```bash
cp .env.example .env
```

Renseigner au minimum :

- `JWT_ACCESS_SECRET` : `openssl rand -hex 64`
- `ADMIN_PASSWORD` : 12 caractères minimum
- `DATABASE_URL` (et `DIRECT_URL` si la base est distante)

Le serveur lit `.env` à la racine du dépôt (un lien `server/.env -> ../.env`
permet aussi de lancer les commandes Prisma depuis `server/`).

### 3.3 Schéma, données de démonstration

```bash
cd server
npm install
npx prisma migrate deploy   # ou `npx prisma db push` en développement
npm run db:seed
cd ..
```

Le seed crée :

- 12 pays et 12 services ;
- le catalogue de repli (29 entrées) synchronisé sur le fournisseur mock ;
- la configuration tarifaire et les taux de change ;
- un administrateur `admin@numivo.local` (mot de passe = `ADMIN_PASSWORD`) ;
- hors production, un client de démonstration `client@numivo.local` / `demo123456`.

### 3.4 Lancement

```bash
# Terminal 1 — API (http://localhost:4000)
cd server && npm run dev

# Terminal 2 — frontend (http://localhost:3000)
npm install && npm run dev
```

Santé de l'API : `curl http://localhost:4000/api/health`.

### 3.5 Comptes de démonstration

| Rôle | Identifiant | Mot de passe |
| --- | --- | --- |
| Client | `client@numivo.local` | `demo123456` |
| Admin | `admin@numivo.local` | valeur de `ADMIN_PASSWORD` dans `.env` |

Hors production, la page d'authentification propose un bouton de connexion
admin si `VITE_DEMO_ADMIN_PASSWORD` est défini. Ne jamais définir cette variable
en production.

---

## 4. Parcours de recette local (modes simulés)

1. **Recharge portefeuille** : espace client → « Recharger Portefeuille » →
   montant XOF → une page de paiement simulée s'ouvre. Approuver, puis le solde
   est crédité automatiquement (polling 3 s).
2. **Achat par portefeuille** : catalogue → « Acheter » → Portefeuille →
   confirmation immédiate, commande `PROCESSING`.
3. **Réception SMS** : dans l'espace client, « Simuler réception SMS (test) »
   (visible uniquement en mode mock) → commande `COMPLETED`, SMS affiché.
4. **Achat FedaPay** : catalogue → Mobile Money ou Carte → page de paiement
   simulée → approbation → commande `PROCESSING`.
5. **Annulation** : sur une commande en cours, l'annulation fournisseur
   recrédite intégralement le portefeuille.
6. **Console admin** : rentabilité, commandes, catalogue et coûts, utilisateurs,
   règles de prix, fournisseur, journal d'audit.

Les outils de simulation sont servis par `/api/dev/*` et **désactivés
automatiquement en production**.

---

## 5. Tests et contrôles

```bash
# Tests unitaires (unités mineures, conversions, tarification)
cd server && npm test

# Recette API complète (48 contrôles)
bash scripts/e2e-api.sh

# Recette navigateur (23 contrôles, Chrome headless)
node scripts/ui-check.cjs
```

La recette API suppose l'API et la base démarrées, avec le seed exécuté. Le mot
de passe admin est lu depuis `.env` (ou `ADMIN_PASSWORD`).

---

## 6. Règles métier

### Montants

- Stockage et calcul en **unités mineures entières** : XOF sans décimale,
  EUR/USD avec 2 décimales (`amountToMinor`, `minorToAmount`).
- Aucun calcul financier en flottant : `Decimal.js` + `BigInt`.

### Prix de vente

```
P = (C + F + FX + M) / (1 − r)
```

- `C` coût fournisseur, `F` frais fixes, `FX` frais de change, `M` marge nette
  cible, `r` commission du moyen de paiement.
- Arrondi supérieur au palier configuré (100 XOF par défaut).
- Marge nette minimale imposée : **2 000 XOF**. Le serveur refuse toute
  configuration ou commande qui ne la garantit pas.
- Le prix est **toujours calculé côté serveur** ; le frontend ne fait
  qu'afficher le devis de `/api/catalog/quote`.

### Devises

- FedaPay n'accepte que le **XOF** : toutes les recharges et tous les paiements
  FedaPay sont réglés en XOF.
- Les achats par portefeuille sont débités en XOF, même si l'affichage est en
  EUR/USD. La commande conserve la devise d'affichage choisie.
- Solde fournisseur Ultra SMS : en cents USD, converti pour l'affichage admin.

### Remboursements

- Remboursement **immédiat sur le portefeuille** du client (idempotent).
- FedaPay n'expose pas de remboursement par API : la régularisation vers le
  moyen de paiement d'origine est **manuelle** depuis le dashboard FedaPay et
  listée dans la console admin.
- Statuts : `CANCELLED` si la commande est annulée chez le fournisseur (numéro
  libéré), `REFUNDED` pour un remboursement simple.

### Statuts de commande

`PENDING_PAYMENT → PAID → PROCESSING → COMPLETED` (ou `CANCELLED`,
`REFUNDED`, `FAILED`). Les commandes non payées expirent après 30 minutes.

---

## 7. Passage aux clés réelles

### 7.1 Ultra SMS

1. Renseigner `ULTRASMS_MODE=live`, `ULTRASMS_API_KEY` et
   `ULTRASMS_WEBHOOK_SECRET` dans `.env` (ou `.env.production`).
2. Déclarer l'URL publique du callback :
   `https://<api>/api/webhooks/ultrasms/inbound`.
3. Vérifier la signature `X-UltraSMS-Signature` (HMAC SHA-256 de
   `timestamp + '.' + rawBody`, tolérance 300 s) — déjà implémentée.
4. Depuis la console admin, lancer une synchronisation du catalogue puis
   contrôler quelques coûts fournisseur.

En local, exposer l'API avec un tunnel HTTPS (Cloudflare Tunnel, ngrok…) et
renseigner `ULTRASMS_CALLBACK_URL`.

### 7.2 FedaPay

1. Créer les clés **sandbox** dans le dashboard FedaPay.
2. Renseigner `PAYMENTS_MODE=sandbox`, `FEDAPAY_PUBLIC_KEY`,
   `FEDAPAY_SECRET_KEY`, `FEDAPAY_WEBHOOK_SECRET`.
3. Déclarer le webhook `https://<api>/api/webhooks/fedapay`.
4. Tester une recharge et un achat avec les numéros de test FedaPay.
5. Passer en `PAYMENTS_MODE=live` uniquement après validation de la recette.

Le retour navigateur utilise `FRONTEND_URL/?payment_ref=<référence>` ; la
vérification est faite côté serveur (`GET /api/payments/by-reference/:reference`).

### 7.3 Garde-fous automatiques

Au démarrage, l'API refuse de démarrer si :

- un déploiement **live** (`APP_ENV=production`) utilise un mode `mock` ;
- en live, `PAYMENTS_MODE` n'est pas `live` ;
- `COOKIE_SECURE` n'est pas `true` en production ;
- `JWT_ACCESS_SECRET` fait moins de 64 caractères en production ;
- `ADMIN_PASSWORD` est absent ou fait moins de 12 caractères en production ;
- `APP_URL` n'est pas en HTTPS en production ;
- `ULTRASMS_WEBHOOK_SECRET` manque en production quand `ULTRASMS_MODE=live` ;
- les clés fournisseur requises sont absentes ;
- sur Vercel, `CRON_SECRET` ou `DIRECT_URL` manque.

Un déploiement **staging** (`APP_ENV=staging`, y compris une preview Vercel)
reste en `NODE_ENV=production` mais accepte les fournisseurs simulés et les
outils `/api/dev/*`.

### 7.4 Test local avec les vraies clés

Les clés se saisissent **hors du chat** et ne sont jamais affichées :

```bash
bash scripts/set-keys.sh                 # saisie masquée, modes inchangés
bash scripts/set-keys.sh --ultrasms-live # active Ultra SMS réel
bash scripts/set-keys.sh --payments-live # active FedaPay réel
```

Le script met à jour `.env` (déjà ignoré par Git) et n'affiche que la longueur
des valeurs. Redémarrer l'API après chaque changement de mode.

**Ordre recommandé** (évite d'encaisser de l'argent réel sur des numéros
simulés) :

1. Passer Ultra SMS en `live`, redémarrer l'API, puis dans la console admin
   lancer « Synchroniser le catalogue ». Contrôler quelques offres, leurs coûts
   et la marge calculée.
2. Passer FedaPay en `live`, redémarrer l'API, puis effectuer une recharge
   réelle de **500 XOF** (minimum) depuis l'espace client. Vérifier le crédit du
   portefeuille et la ligne dans le journal d'audit.
3. Acheter un numéro réel et attendre le SMS (le poller interroge Ultra SMS
   toutes les 10 s, même sans webhook).

**Webhooks en local** : ils exigent une URL publique HTTPS. Avec
`cloudflared` :

```bash
cloudflared tunnel --url http://localhost:4000
# Exemple : https://abc-def-ghi.trycloudflare.com
```

Renseigner alors `ULTRASMS_CALLBACK_URL=https://<tunnel>/api/webhooks/ultrasms/inbound`
et déclarer `https://<tunnel>/api/webhooks/fedapay` dans le dashboard FedaPay.
Sans tunnel, le parcours reste fonctionnel : le retour navigateur
(`?payment_ref=`) déclenche la vérification côté serveur et le poller récupère
les SMS.

> ⚠️ En mode `live`, chaque recharge et chaque achat débitent de l'argent réel.
> Les remboursements FedaPay vers le moyen de paiement d'origine restent
> manuels ; le portefeuille interne est recrédité automatiquement.

---

## 8. Déploiement Vercel + Neon

Le déploiement de référence utilise **deux projets Vercel** et une base **Neon** :

| Composant | URL | Projet Vercel |
| --- | --- | --- |
| Front React/Vite | <https://numero-pearl.vercel.app> | `numero` |
| API Express | <https://numero-api.vercel.app> | `numero-api` |

Le front réécrit `/api/*` vers l'API (`vercel.json`). Le navigateur reste donc
sur le domaine du front, ce qui conserve le cookie de refresh first-party.

Le staging est un déploiement de **production** avec `APP_ENV=staging`,
`PAYMENTS_MODE=mock` et `ULTRASMS_MODE=mock` : aucun argent réel n'est engagé.
Les outils `/api/dev/*` restent disponibles uniquement hors environnement live.

Le guide complet — création Neon, migrations, variables des deux projets,
cron du poller, vérifications et passage en live — est dans
[DEPLOIEMENT-VERCEL-NEON.md](DEPLOIEMENT-VERCEL-NEON.md).

Résumé des commandes :

```bash
# 1. Base Neon
cd server && npx prisma migrate deploy && npm run db:seed && cd ..

# 2. API (depuis server/, framework Express)
cd server && vercel --prod --yes && cd ..

# 3. Front (depuis la racine, framework Vite)
vercel --prod --yes
```

> Sur Vercel Hobby, le cron est limité à une exécution par jour. Le staging
> utilise `0 3 * * *` ; un déclencheur externe toutes les 5 minutes est décrit
> dans le guide pour la production.

---

## 9. Limites connues

- Les remboursements FedaPay vers le moyen de paiement d'origine restent
  manuels (limite de l'API FedaPay).
- Le catalogue dépend de la disponibilité réelle Ultra SMS : une offre peut
  disparaître entre le devis et la commande.
- La recette navigateur utilise Chrome headless ; Playwright doit être
  installé séparément (`npm i -g playwright` ou via `npx`).
- Le bundle frontend dépasse 500 kB (avertissement Vite) : un découpage par
  route est recommandé avant une audience importante.
- Les tests d'intégration API s'exécutent sur une base locale avec seed ; ils
  créent de vraies lignes (comptes, recharges, commandes) dans cette base.
