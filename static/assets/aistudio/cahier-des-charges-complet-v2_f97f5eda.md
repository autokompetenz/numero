# Cahier des charges fonctionnel et technique
## Plateforme internationale de vente de numéros virtuels

**Version :** 2.0 — mise à jour avec Mobile Money, cartes bancaires et marge commerciale  
**Nom du projet :** à définir (nom de travail : Numivo)  
**Langue initiale :** français  
**Devise de référence commerciale :** XOF  
**Devises proposées :** XOF, EUR, USD

---

## 1. Présentation du projet

Créer une plateforme web permettant aux clients d’acheter des numéros virtuels temporaires ou permanents, selon les pays, services et types de numéros disponibles chez les fournisseurs autorisés.

La plateforme fonctionne comme un revendeur sous sa propre marque. Le fournisseur initial envisagé est **Ultra SMS**, sous réserve de validation du compte revendeur, des tarifs, des usages autorisés et de l’accès à une API officielle.

Le site doit permettre :
- de consulter les numéros disponibles par pays et service ;
- de créer un compte client ;
- de payer par Mobile Money ou carte bancaire ;
- de gérer un portefeuille client multi-devises ;
- de recevoir les numéros et SMS dans un espace sécurisé ;
- de suivre les commandes et remboursements ;
- à l’administrateur de gérer le catalogue, les tarifs, les fournisseurs, les paiements et les revenus.

La plateforme doit respecter les lois applicables, les conditions des fournisseurs et les règles des services destinataires. Elle ne doit pas être présentée comme un outil de contournement des vérifications d’identité, des limites anti-abus ou des restrictions des plateformes.

---

## 2. Objectifs commerciaux

### 2.1 Objectif principal
Vendre des numéros virtuels avec un parcours simple, sécurisé et automatisé.

### 2.2 Objectif de rentabilité
Le propriétaire vise **2 000 XOF de marge nette par numéro vendu**, après déduction :
- du coût du numéro fournisseur ;
- des commissions du prestataire de paiement prises en charge par la plateforme ;
- des frais fixes éventuels ;
- des frais de conversion de devise ;
- des autres coûts directement imputables à la commande.

Cette marge est un objectif de tarification. Le bénéfice réel doit être calculé après réception des coûts exacts fournisseur et paiement.

### 2.3 Marchés et devises
- Bénin et Afrique de l’Ouest au lancement, puis clients internationaux selon disponibilité.
- XOF pour le marché régional.
- EUR et USD pour les clients internationaux, sous réserve que le prestataire de paiement et le compte marchand acceptent ces devises.

---

## 3. Utilisateurs et rôles

### 3.1 Visiteur
- Consulter la présentation et les fonctionnalités.
- Voir les pays/services proposés, si le catalogue public le permet.
- Consulter les tarifs et les moyens de paiement.
- Créer un compte ou se connecter.
- Lire les conditions d’utilisation, la politique de confidentialité et les FAQ.

### 3.2 Client
- Gérer son profil.
- Choisir une devise d’affichage parmi XOF, EUR et USD.
- Acheter un numéro.
- Payer par Mobile Money, carte bancaire ou portefeuille.
- Consulter le numéro, le statut et les SMS reçus lorsque le service fournisseur le permet.
- Consulter l’historique des commandes et transactions.
- Ajouter des fonds au portefeuille, si cette fonctionnalité est activée.
- Demander un remboursement ou contacter le support.
- Consulter ses reçus et factures.

### 3.3 Administrateur
- Gérer les clients et les rôles.
- Gérer pays, services, catégories et catalogue.
- Configurer les fournisseurs et leurs clés API côté serveur.
- Définir les marges et règles de prix.
- Consulter commandes, paiements, remboursements et transactions.
- Gérer les erreurs fournisseur et les commandes bloquées.
- Voir les statistiques financières et la rentabilité.
- Gérer les contenus du site et le support.
- Consulter les logs d’audit et les alertes de sécurité.

### 3.4 Support
- Voir les commandes et leurs statuts.
- Répondre aux demandes client.
- Initier une demande de remboursement selon les permissions.
- Ne pas pouvoir modifier les soldes directement sans procédure contrôlée.

---

## 4. Fonctionnalités du site

### 4.1 Pages publiques
- Accueil.
- Catalogue de numéros.
- Détail d’un pays/service.
- Tarifs et moyens de paiement.
- FAQ.
- Contact/support.
- Connexion et inscription.
- Conditions générales.
- Politique de confidentialité.
- Politique de remboursement.
- Politique d’utilisation acceptable.

### 4.2 Espace client
- Tableau de bord.
- Acheter un numéro.
- Mes numéros / commandes.
- Détail de commande.
- SMS reçus, si disponibles.
- Portefeuille.
- Dépôt de fonds.
- Historique financier.
- Profil et sécurité.
- Support et tickets.

### 4.3 Espace administrateur
- Vue d’ensemble.
- Gestion des utilisateurs.
- Gestion du catalogue.
- Gestion fournisseurs.
- Gestion des commandes.
- Gestion paiements.
- Gestion remboursements.
- Gestion des prix et marges.
- Gestion des devises et taux de change.
- Rapports financiers.
- Journal d’audit.
- Paramètres et contenus.

---

## 5. Parcours d’achat d’un numéro

1. Le client se connecte.
2. Il choisit le pays, le service et la catégorie du numéro.
3. Le backend récupère les disponibilités et le coût réel depuis l’API fournisseur officielle, si disponible.
4. Le backend calcule le prix de vente selon la règle de marge.
5. Le client voit le prix total, la devise, la durée, les limites et les conditions avant validation.
6. Le client choisit le mode de paiement.
7. Le backend crée une commande avec statut `PENDING_PAYMENT`.
8. Le paiement est confirmé côté serveur.
9. Le backend vérifie l’idempotence et évite tout double traitement.
10. Si paiement confirmé, la commande passe à `PAID`.
11. Le backend achète le numéro chez le fournisseur.
12. La commande passe à `PROCESSING`, puis `COMPLETED` si le fournisseur confirme.
13. Le client voit le numéro dans son espace.
14. Le système vérifie les SMS selon les capacités et limites de l’API fournisseur.
15. Si le fournisseur échoue après paiement, appliquer la procédure de remboursement ou de recrédit définie.

Ne jamais faire confiance uniquement à la page de retour frontend pour déclarer un paiement réussi.

---

## 6. Moyens de paiement

### 6.1 Mobile Money

Moyens à étudier selon le pays :
- MTN MoMo ;
- Moov Money ;
- Celtiis Money ;
- autres opérateurs disponibles via le prestataire.

Au Bénin, évaluer les agrégateurs tels que **FedaPay** et **KKiaPay**. Les opérateurs, pays, devises, tarifs et conditions doivent être confirmés auprès de chaque prestataire avant de choisir.

### 6.2 Carte bancaire

Prévoir :
- Visa ;
- Mastercard ;
- cartes internationales lorsque le prestataire et le compte marchand les autorisent.

Pour les cartes :
- utiliser une page de paiement hébergée ou des composants sécurisés du prestataire ;
- ne jamais stocker le numéro de carte, le CVV ou les données sensibles de carte ;
- prendre en charge 3D Secure lorsque demandé ;
- vérifier le paiement côté backend ;
- gérer refus, annulation, expiration, contestation et remboursement.

### 6.3 Portefeuille

Le client peut disposer d’un portefeuille interne, si cette fonction est activée.

Le portefeuille doit :
- être séparé par devise ;
- enregistrer chaque opération dans un journal financier immuable ;
- ne jamais autoriser un solde négatif ;
- créditer uniquement après confirmation réelle du paiement ;
- débiter dans une transaction atomique lors d’un achat ;
- ne pas permettre au client de transférer librement des fonds vers d’autres clients au lancement, sauf décision réglementaire et technique spécifique.

**Important :** les fonds du portefeuille client sont une obligation envers le client, pas du chiffre d’affaires disponible de l’entreprise.

### 6.4 Architecture d’intégration

Créer une interface commune de paiement :
- `createPayment()`
- `verifyPayment()`
- `refundPayment()`
- `handleWebhook()`

Créer un adaptateur séparé par fournisseur :
- `fedapay.provider.js`
- `kkiapay.provider.js`

Les secrets API et les clés de webhook restent dans le backend et les variables d’environnement.

### 6.5 Sécurité des paiements
- Vérifier la signature des webhooks.
- Interroger l’API du prestataire si nécessaire pour confirmer le statut.
- Vérifier montant, devise, identifiant de commande et référence transaction.
- Utiliser une clé d’idempotence.
- Journaliser les événements.
- Ne pas créditer deux fois une transaction.
- Ne pas considérer une capture d’écran ou une confirmation frontend comme une preuve.
- Prévoir une procédure de rapprochement des paiements et de règlement marchand.

### 6.6 Validation commerciale préalable
Avant de lancer les paiements réels, demander aux prestataires une validation écrite de :
- l’activité de revente de numéros virtuels ;
- la nature des services proposés ;
- les pays ciblés ;
- les devises acceptées ;
- les moyens de paiement activables ;
- les frais de transaction ;
- les frais de remboursement et de contestation ;
- les délais de règlement ;
- les exigences KYC/KYB et documents d’entreprise.

Les offres et tarifs des prestataires peuvent changer. Les liens officiels doivent être consultés avant intégration :
- FedaPay : https://www.fedapay.com/
- Documentation FedaPay : https://docs-v1.fedapay.com/
- KKiaPay : https://kkiapay.me/

---

## 7. Règle de prix et marge de 2 000 XOF

### 7.1 Principe

Pour chaque numéro vendu, viser au minimum 2 000 XOF de marge nette estimée après les coûts directement liés à la vente.

Variables :
- `C` : coût fournisseur converti en XOF ;
- `r` : taux de commission de paiement ;
- `F` : frais fixes de paiement ;
- `FX` : frais de conversion éventuels ;
- `M` : marge cible, soit 2 000 XOF ;
- `P` : prix payé par le client.

Si les frais de paiement sont calculés en pourcentage du montant payé :

`P = (C + F + FX + M) / (1 - r)`

Le prix doit être arrondi vers le haut à un palier commercial configurable. La marge estimée doit être recalculée après arrondi.

### 7.2 Exemple indicatif en XOF

Hypothèses fictives :
- coût fournisseur : 1 500 XOF ;
- marge cible : 2 000 XOF ;
- frais fixes : 0 XOF ;
- commission carte : 3,6 %.

Prix minimum théorique :

`P = (1 500 + 2 000) / (1 - 0,036) = 3 630,71 XOF`

Prix commercial arrondi : **3 700 XOF**.

Commission estimée : `3 700 × 3,6 % = 133,2 XOF`.

Marge estimée : `3 700 - 1 500 - 133,2 = 2 066,8 XOF`.

Les taux ci-dessus sont illustratifs. Les frais réels doivent provenir du contrat et du prestataire de paiement. Les frais de Mobile Money et de carte peuvent être différents.

### 7.3 Prix dynamique
Le backend doit :
- récupérer le coût fournisseur actuel ;
- convertir le coût en XOF avec un taux de change enregistré et daté ;
- ajouter les frais de paiement applicables ;
- ajouter la marge cible ;
- arrondir le prix ;
- afficher le prix final avant paiement ;
- enregistrer le détail du calcul dans la commande ;
- bloquer la vente si la marge minimum ne peut pas être respectée, sauf autorisation admin ;
- recalculer la marge réelle après confirmation du coût fournisseur.

### 7.4 Exemple de calcul JavaScript (prototype)

```js
export function calculateSellingPrice({
  supplierCostXof,
  targetMarginXof = 2000,
  paymentRate = 0.036,
  fixedPaymentFeeXof = 0,
  fxFeeXof = 0,
  roundingStepXof = 100,
}) {
  if (supplierCostXof < 0 || targetMarginXof < 0) {
    throw new Error("Amounts must be non-negative");
  }

  if (paymentRate < 0 || paymentRate >= 1) {
    throw new Error("Invalid payment rate");
  }

  const rawPrice =
    (supplierCostXof + targetMarginXof + fixedPaymentFeeXof + fxFeeXof) /
    (1 - paymentRate);

  const sellingPrice =
    Math.ceil(rawPrice / roundingStepXof) * roundingStepXof;

  const paymentFee = sellingPrice * paymentRate + fixedPaymentFeeXof;
  const estimatedNetMargin =
    sellingPrice - supplierCostXof - paymentFee - fxFeeXof;

  return {
    sellingPriceXof: sellingPrice,
    estimatedPaymentFeeXof: paymentFee,
    estimatedNetMarginXof: estimatedNetMargin,
  };
}
```

**Production :** ne pas utiliser les flottants JavaScript pour les montants financiers. Utiliser des entiers en unités mineures ou une bibliothèque Decimal. XOF se stocke sans décimales ; EUR et USD se stockent en centimes. Les devises doivent avoir leur propre précision.

---

## 8. Devises et conversion

Devises :
- XOF ;
- EUR ;
- USD.

Règles :
- afficher les prix dans la devise choisie par le client ;
- ne pas mélanger les soldes de devises ;
- ne pas convertir automatiquement un portefeuille d’une devise à une autre sans consentement et taux explicite ;
- conserver le taux de change et la date utilisés pour chaque commande ;
- enregistrer la devise réellement débitée par le prestataire ;
- définir une devise de référence comptable, par exemple XOF ;
- utiliser une API de taux de change fiable ou une valeur administrateur horodatée ;
- inclure les frais de conversion dans le calcul de rentabilité.

---

## 9. Fournisseur de numéros : Ultra SMS

Ultra SMS est le fournisseur initial envisagé, sous réserve de validation.

Le module fournisseur doit permettre, selon les fonctionnalités de son API :
- authentification API ;
- récupération des pays ;
- récupération des services ;
- disponibilité et tarifs ;
- achat d’un numéro ;
- récupération du SMS ;
- annulation ou libération si autorisée ;
- vérification du solde ;
- gestion des erreurs et limites API.

Le backend doit :
- protéger la clé API ;
- enregistrer les références de commandes fournisseur ;
- éviter les achats en double ;
- gérer les timeouts et erreurs ;
- prévoir une file de tâches pour les opérations longues ;
- vérifier les statuts avant de présenter le numéro comme livré.

**Ne pas coder des URL ou réponses API supposées.** Utiliser la documentation officielle Ultra SMS et les accès fournis au compte revendeur. Ne pas simuler de disponibilité, de SMS ou de commande réelle.

---

## 10. Portefeuille et journal financier

Chaque client possède un portefeuille séparé pour chaque devise, si cette fonctionnalité est activée.

Transactions possibles :
- dépôt confirmé ;
- achat ;
- remboursement ;
- ajustement administratif documenté ;
- frais éventuels.

Principes :
- journal comptable append-only ;
- pas de suppression ou modification d’une transaction validée ;
- corrections via une transaction inverse ;
- solde jamais négatif ;
- transactions DB atomiques ;
- verrouillage ou mise à jour conditionnelle du solde ;
- idempotence des paiements ;
- audit des opérations administratives.

---

## 11. Modèle de données (proposition)

### User
- id
- email
- passwordHash
- role
- status
- createdAt
- updatedAt

### Wallet
- id
- userId
- currency
- balanceMinor
- createdAt
- updatedAt

### WalletTransaction
- id
- walletId
- type
- amountMinor
- currency
- status
- reference
- idempotencyKey
- metadata
- createdAt

### Order
- id
- userId
- provider
- providerOrderId
- country
- service
- phoneNumber
- currency
- supplierCostMinor
- supplierCostCurrency
- exchangeRate
- sellingPriceMinor
- paymentFeeMinor
- targetMarginXof
- actualMarginXof
- status
- createdAt
- completedAt

### Payment
- id
- orderId
- provider
- providerTransactionId
- paymentMethod (`MOBILE_MONEY`, `CARD`, `WALLET`)
- amountMinor
- currency
- status
- idempotencyKey
- paidAt
- createdAt

### Refund
- id
- paymentId
- orderId
- amountMinor
- currency
- reason
- providerRefundId
- status
- createdAt

### Provider
- id
- name
- status
- configuration reference (secret kept in environment/secret manager)
- createdAt

### Product/ServiceCatalog
- id
- country
- service
- provider
- supplierPrice
- supplierCurrency
- enabled
- createdAt
- updatedAt

### ExchangeRate
- id
- baseCurrency
- quoteCurrency
- rate
- source
- validAt
- createdAt

### AuditLog
- id
- actorId
- action
- entityType
- entityId
- metadata
- ipAddress (si collecte légalement nécessaire)
- createdAt

---

## 12. API backend (proposition)

### Authentification
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`

### Catalogue
- `GET /api/catalog/countries`
- `GET /api/catalog/services`
- `GET /api/catalog/availability`

### Commandes
- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders/:id/cancel` (si autorisé)
- `GET /api/orders/:id/sms` (si le fournisseur le permet)

### Paiements
- `POST /api/payments/create`
- `GET /api/payments/:id`
- `POST /api/payments/webhooks/:provider`
- `POST /api/payments/:id/refund` (permissions admin ou règles autorisées)

### Portefeuille
- `GET /api/wallets`
- `GET /api/wallets/:currency`
- `GET /api/wallets/:currency/transactions`
- `POST /api/wallets/deposit`

### Admin
- `GET /api/admin/dashboard`
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id/status`
- `GET /api/admin/orders`
- `GET /api/admin/payments`
- `GET /api/admin/financial-reports`
- `PATCH /api/admin/catalog/:id`
- `PATCH /api/admin/pricing`
- `GET /api/admin/audit-logs`

Toutes les routes doivent avoir validation des entrées, authentification et autorisation adaptée.

---

## 13. Architecture technique

### Frontend
- React
- Vite
- JSX (pas TypeScript)
- React Router
- Axios ou fetch
- Tailwind CSS ou CSS Modules
- Lucide React
- contexte global pour auth, thème et devise

### Backend
- Node.js
- Express
- Prisma
- PostgreSQL
- Zod pour validation
- Argon2 ou bcrypt pour les mots de passe
- Helmet
- CORS configuré
- Rate limiting
- logs structurés

### Infrastructure
- Frontend : Vercel ou autre hébergement compatible.
- Backend : hébergement Node.js sécurisé.
- Base : PostgreSQL managé.
- Secrets : variables d’environnement ou gestionnaire de secrets.
- HTTPS obligatoire en production.
- Sauvegardes automatiques de base de données.

---

## 14. Interface et expérience utilisateur

### Design
- mode clair ;
- mode sombre ;
- choix sauvegardé dans les préférences utilisateur/locales ;
- responsive mobile, tablette et desktop ;
- interface moderne et simple ;
- devise affichée clairement ;
- états de chargement, erreur, succès et commande en attente ;
- confirmation avant paiement et achat ;
- historique accessible.

### Écrans principaux
- Accueil.
- Catalogue.
- Détail service.
- Connexion/inscription.
- Paiement.
- Confirmation commande.
- Dashboard client.
- Portefeuille.
- Historique.
- Administration.
- Rapports financiers.

---

## 15. Sécurité, conformité et protection des données

- HTTPS obligatoire.
- Mots de passe hachés.
- Sessions sécurisées ou access/refresh tokens correctement gérés.
- Cookies HttpOnly/Secure/SameSite si sessions cookie.
- Protection contre brute force, CSRF selon le mode d’authentification, XSS et injection SQL.
- Validation de toutes les données côté serveur.
- Autorisation par rôle.
- Clés fournisseur et paiement uniquement côté serveur.
- Webhooks vérifiés et idempotents.
- Journal d’audit.
- Politique de rétention des SMS et données personnelles.
- Chiffrement des données sensibles au repos si nécessaire.
- Minimisation des données collectées.
- Procédures de suppression/export de données selon la loi applicable.
- Respect des conditions Ultra SMS et des services destinataires.
- Vérifier les obligations légales et réglementaires au Bénin et dans les pays ciblés, notamment concernant paiements, portefeuille, données personnelles et activité de télécommunications.

---

## 16. Tableau de bord financier administrateur

Indicateurs :
- chiffre d’affaires brut ;
- coût total fournisseur ;
- frais Mobile Money ;
- frais cartes bancaires ;
- frais de change ;
- remboursements ;
- bénéfice estimé et bénéfice réalisé ;
- marge par numéro ;
- marge par service/pays ;
- volume de commandes ;
- panier moyen ;
- paiements en attente/échoués ;
- solde fournisseur ;
- fonds clients en portefeuille (distincts du revenu).

Les chiffres doivent être calculés à partir des transactions et coûts enregistrés, et non de simples statuts frontend.

---

## 17. Tests et critères d’acceptation

### Authentification
- Inscription, connexion, déconnexion et récupération de mot de passe.
- Accès admin interdit aux clients.

### Paiement
- Paiement réussi.
- Paiement refusé.
- Paiement en attente.
- Webhook reçu plusieurs fois.
- Montant ou devise incorrects.
- Paiement sans commande correspondante.
- Remboursement total ou partiel selon le prestataire.

### Wallet
- Crédit uniquement après confirmation.
- Débit atomique.
- Aucun solde négatif.
- Transaction répétée ne double pas le solde.
- Devises isolées.

### Achat fournisseur
- Achat réussi.
- Fournisseur indisponible.
- Timeout.
- Achat déjà traité.
- SMS non reçu.
- Remboursement ou recrédit selon les règles.

### Rentabilité
- Le calcul du prix respecte la marge cible.
- Le prix est arrondi vers le haut.
- Les frais carte et Mobile Money sont distincts.
- Les frais FX sont inclus.
- Le bénéfice réalisé correspond au coût final enregistré.

### Interface
- Mobile, tablette et desktop.
- Mode clair/sombre.
- EUR/USD/XOF.
- Erreurs lisibles.
- Accessibilité de base.

---

## 18. Plan de développement conseillé

### Phase 1 — Fondations
- Initialiser React/Vite et Express.
- Configurer PostgreSQL et Prisma.
- Créer structure, variables d’environnement et migrations.
- Construire le design system clair/sombre.

### Phase 2 — Authentification
- Inscription, connexion, rôles, profil.
- Sécurisation des routes.

### Phase 3 — Catalogue et devises
- Catalogue mocké pour le développement frontend uniquement.
- Modèle de pays/services.
- Sélecteur EUR/USD/XOF.
- Calcul de prix de test clairement séparé de la production.

### Phase 4 — Wallet et ledger
- Portefeuille multi-devises.
- Transactions immuables.
- Tests de concurrence et d’idempotence.

### Phase 5 — Paiements en environnement sandbox
- Choisir et faire valider le prestataire.
- Intégrer Mobile Money.
- Intégrer Visa/Mastercard.
- Vérifier les webhooks.
- Tester remboursements et rapprochement.

### Phase 6 — Ultra SMS
- Obtenir l’accès revendeur et documentation officielle.
- Implémenter l’adaptateur fournisseur.
- Tester disponibilité, achat et réception SMS.

### Phase 7 — Administration et finance
- Gestion catalogue et marges.
- Tableau de bord revenus/coûts.
- Journal d’audit.
- Alertes et support.

### Phase 8 — Production
- Tests de sécurité.
- Sauvegardes.
- Monitoring.
- Validation légale et commerciale.
- Déploiement progressif.

---

## 19. Décisions à confirmer avant production

- Nom définitif de la marque.
- Pays de lancement.
- Statut juridique et documents marchands.
- Confirmation Ultra SMS de l’activité de revente.
- Prestataire paiement retenu.
- Acceptation officielle des cartes internationales.
- Devises de paiement et de règlement autorisées.
- Taux de frais contractuels.
- Politique de remboursement.
- Conditions de portefeuille et éventuelles obligations réglementaires.
- Politique de conservation des SMS.
- Durée de disponibilité des numéros.
- Marge minimale et exceptions administrateur.

---

## 20. Résumé des règles métier essentielles

1. Le prix est calculé côté backend.
2. La cible est 2 000 XOF de marge nette par numéro.
3. Les frais carte, Mobile Money et change sont calculés selon le prestataire réel.
4. Le client voit le montant final avant paiement.
5. Une commande n’est payée qu’après confirmation serveur.
6. Un paiement ne peut être traité qu’une fois.
7. Le numéro n’est commandé chez le fournisseur qu’après paiement confirmé, sauf mécanisme de réservation explicitement maîtrisé.
8. Le portefeuille est séparé par devise et son ledger est immuable.
9. Le bénéfice n’est pas le chiffre d’affaires ni le solde du wallet client.
10. Aucun SMS, numéro, paiement ou solde ne doit être simulé en production.
11. Toute intégration fournisseur doit utiliser la documentation et les autorisations officielles.
12. La plateforme doit respecter les lois, les conditions fournisseur et les règles des services destinataires.
