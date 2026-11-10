# Numivo — Audit de mise en production

Date : 6 novembre 2026
Périmètre : API Express, base PostgreSQL, front React/Vite, FedaPay, Ultra SMS, déploiement Docker/Nginx.

Statut actuel : **non prêt pour la production**. Les corrections ci-dessous sont classées par
criticité. Les points « Bloquant » doivent être traités avant toute ouverture au public.

---

## 1. Bloquants

### 1.1 Recharge FedaPay non atomique (argent encaissé, wallet non crédité)

**Fichier :** `server/src/services/payments.ts:203-247`

`confirmPayment()` fait d'abord `payment.update({ status: 'APPROVED' })` (ligne 219),
puis `creditWallet()` (ligne 223) dans une opération séparée. Si le process crashe entre les
deux (redéploiement, coupure DB, timeout), le paiement est marqué payé et le client n'est
jamais crédité. Le prochain appel retombe sur le early-return `status === 'APPROVED'` et ne
crédite toujours pas.

**Correction :** envelopper la mise à jour du paiement, le crédit du wallet et la ligne
`WalletTransaction` dans une seule transaction interactive (`prisma.$transaction(async (tx) => ...)`),
avec la clé d'idempotence existante `topup:${payment.id}`.

### 1.2 Achat par wallet non atomique (wallet débité, commande non payée)

**Fichier :** `server/src/services/orders.ts:192-299`

La commande et le paiement sont créés dans une transaction (ligne 192), puis le débit wallet
est fait **hors** de cette transaction (ligne 267), et le passage `PAID/APPROVED` dans une
troisième transaction (ligne 288). Un crash entre le débit et le passage `PAID` laisse le
client débité avec une commande `PENDING_PAYMENT`. Le `catch` (ligne 276) annule la commande
mais ne recrédite pas le wallet si le débit a réussi.

**Correction :** une seule transaction interactive couvrant création commande + paiement +
débit wallet + statuts `PAID/APPROVED`, puis déclencher le fulfillment **après** commit.

### 1.3 Aucune reprise du fulfillment après redémarrage

**Fichiers :** `server/src/services/fulfillment.ts:261-267`, `server/src/services/poller.ts:9-27`

`scheduleFulfillment()` repose uniquement sur un `setTimeout(..., 0)`. Le poller ne reprend
que les commandes `PROCESSING` (`orders.ts:428-431`). Conséquences :
- crash/redéploiement juste après le paiement → commande `PAID` sans `providerOrderId`
  bloquée indéfiniment ;
- commande bloquée en `PROCESSING` sans `providerOrderId` jamais reprise.

**Correction :** job de reprise au démarrage + tick du poller qui sélectionne aussi les
commandes `PAID` sans `providerOrderId`, avec verrou (`SELECT ... FOR UPDATE SKIP LOCKED` ou
`updateMany` conditionnel) pour éviter les doubles achats.

### 1.4 Mode `sandbox` autorisé en production

**Fichiers :** `server/src/config/env.ts:111-117`, `.env.production.example:60`

Le garde-fou ne bloque que `PAYMENTS_MODE=mock`. `sandbox` passe, et l'exemple de config
production est justement en `sandbox`. Risque : mise en ligne avec des paiements simulés.

**Correction :** refuser `mock` **et** `sandbox` dès que `NODE_ENV=production`; passer
`.env.production.example` en `PAYMENTS_MODE=live`.

### 1.5 Identifiants de démonstration exposés en production

**Fichier :** `src/components/auth/AuthPage.tsx:319-343`

Le bloc « Comptes de démonstration immédiats » et le bouton de connexion 1-clic
`client@numivo.local` / `demo123456` sont rendus sans condition, donc visibles en production.

**Correction :** conditionner tout le bloc à `import.meta.env.DEV` et ne jamais seeder ce
compte en production.

### 1.6 Secrets à considérer comme compromis

Les clés FedaPay/Ultra SMS live ont transité en clair, et `ADMIN_PASSWORD` est stocké en
clair dans `.env`.

**Correction avant mise en ligne :** régénérer la clé secrète FedaPay, la clé API Ultra SMS,
les secrets JWT, et définir un mot de passe admin unique. Stocker les secrets dans un
gestionnaire dédié (ou au minimum un fichier non versionné avec permissions 600).

### 1.7 Pas de TLS

**Fichier :** `deploy/nginx.conf:1-41`

Nginx n'écoute qu'en HTTP:80. Or `COOKIE_SECURE=true` est exigé en production : sans HTTPS,
l'authentification par cookie de refresh casse, et les données de paiement circulent en clair.

**Correction :** terminaison TLS devant le service web (Caddy/Traefik ou Nginx + certbot),
redirection 80 → 443, HSTS, et ajout de `Content-Security-Policy` et
`Permissions-Policy` (actuellement absents).

### 1.8 Webhooks non opérationnels

**Fichier :** `server/src/routes/webhooks.ts`

Sans `FEDAPAY_WEBHOOK_SECRET` / `ULTRASMS_WEBHOOK_SECRET`, les routes répondent 503. Les
secrets et une URL publique HTTPS sont donc obligatoires, sinon la confirmation dépend du
seul retour navigateur + polling, ce qui n'est pas fiable.

**Correction :** configurer les deux secrets, exposer
`https://<domaine>/api/webhooks/...`, et tester un événement réel de bout en bout.

---

## 2. Importants

### 2.1 Remboursement : risque de double remboursement

**Fichier :** `server/src/services/refunds.ts`

Le wallet est recrédité automatiquement, et le remboursement FedaPay est laissé manuel. Rien
ne trace qu'un remboursement fournisseur a déjà été effectué (pas de `providerRefundId`).
Un admin peut rembourser deux fois.

**Correction :** ajouter `providerRefundId` / `providerRefundStatus` sur `Refund`, un écran
admin de suivi, et empêcher un second remboursement pour le même paiement.

### 2.2 Rétention jamais appliquée

**Fichier :** `server/src/config/env.ts:83` (`SMS_RETENTION_DAYS` déclaré, jamais utilisé)

Les SMS/OTP, refresh tokens expirés et `WebhookEvent` s'accumulent indéfiniment.

**Correction :** job de purge quotidien (SMS > `SMS_RETENTION_DAYS`, tokens expirés,
webhooks > 90 jours) + index adaptés.

### 2.3 `TRUST_PROXY` à vérifier

**Fichier :** `server/src/config/env.ts:44` (défaut `0`), `.env.production.example:20` (`1`)

Si la valeur n'est pas correcte en production, le rate limiting et les logs d'audit
enregistrent l'IP du proxy au lieu de celle du client.

### 2.4 Rate limiting en mémoire

**Fichier :** `server/src/middleware/rateLimit.ts`

Fonctionne en mono-instance seulement. Toute montée en charge (2 réplicas) contourne les
quotas. Acceptable au lancement, à migrer vers un store Redis dès la première réplica
supplémentaire.

### 2.5 Devise non vérifiée à la confirmation

**Fichier :** `server/src/services/payments.ts:332-356`

`applyProviderTransaction()` vérifie le montant mais pas la devise de la transaction
FedaPay. Ajouter le contrôle `transaction.currency === payment.currency`.

### 2.6 Catalogue non paginé

**Fichier :** `server/src/services/catalog.ts`

636 offres / 191 pays / 1000 services renvoyés d'un bloc. Charge réseau et rendu inutiles.

**Correction :** pagination + filtres serveur (pays, service, type).

### 2.7 Aucune sauvegarde PostgreSQL

**Fichier :** `docker-compose.prod.yml`

Pas de `pg_dump` planifié, pas de stockage externe, pas de test de restauration.

**Correction :** sauvegarde chiffrée quotidienne hors serveur + procédure de restauration
testée.

### 2.8 Pas de supervision ni de rotation de logs

Pas d'alerte sur disponibilité, erreurs 5xx, échecs de fulfillment ou solde Ultra SMS bas.
Logs Pino non rotés.

**Correction :** healthcheck métier, uptime monitor, alertes (e-mail/Telegram), `logrotate`
ou driver Docker avec limite de taille.

### 2.9 Pas de CI

Aucun pipeline ne bloque un déploiement si `tsc`, les tests ou le build échouent.

**Correction :** CI minimale : install, `tsc --noEmit` (front + back), tests unitaires,
build, puis déploiement.

---

## 3. Recommandés

- **Bundle** : 744 kB de JS sans code splitting (`dist/assets/index-*.js`). Passer les écrans
  admin/dashboard en `React.lazy`.
- **Polices Google externes** (`index.html:12-14`) : à auto-héberger (perf + conformité).
- **SEO/technique** : pas de `robots.txt`, sitemap, favicon ni image Open Graph.
- **`metadata.json`** : capability Gemini obsolète, à nettoyer.
- **Mentions légales** (`src/components/public/FaqAndLegalModal.tsx`) : ajouter raison
  sociale, adresse, contact, RCCM/IFU, politique de rétention et droits APDP.
- **Variables mortes** : `ULTRASMS_CALLBACK_URL`, `FEDAPAY_PUBLIC_KEY`, `APP_ENV`,
  `SMS_RETENTION_DAYS` — à implémenter ou supprimer.
- **`npm audit` serveur** : 3 alertes high limitées au CLI Prisma (build), pas au runtime.
  Mettre à jour Prisma à l'occasion.

---

## 4. Ordre d'exécution conseillé

1. Atomicité topup + achat wallet (1.1, 1.2).
2. Reprise du fulfillment (1.3).
3. Garde-fou sandbox + masquage démo (1.4, 1.5).
4. Rotation des secrets (1.6).
5. TLS + headers + webhooks (1.7, 1.8).
6. Suivi des remboursements + purge (2.1, 2.2).
7. Sauvegardes, supervision, CI (2.7, 2.8, 2.9).
8. Finitions produit/légal/SEO (section 3).

Après corrections : relancer les recettes en mode mock (48 API / 23 UI), puis valider le
parcours live complet recharge → achat → SMS après recharge du compte Ultra SMS
(solde actuellement 0,00 USD).
