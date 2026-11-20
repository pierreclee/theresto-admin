# TheResto Admin Web Platform

Admin panel pour la gestion centralisée de la plateforme TheResto (restaurants, utilisateurs, monitoring).

## Quick Start

### Prerequisites
- Node.js 18+
- Firebase project (`theresto-28747`)
- `.env.local` with Firebase credentials

### Installation

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local with your Firebase credentials
```

### Development

```bash
npm run dev
# Open http://localhost:3000
```

### Build for Production

```bash
npm run build
npm start
```

### Testing & Quality

```bash
npm test              # Unit tests
npm run type-check    # TypeScript check
npm run lint          # ESLint
```

## Project Structure

```
app/                  # Next.js App Router pages
├── auth/             # Login, MFA enrollment, MFA challenge
├── restaurants/      # List + detail pages
├── monitoring/       # Audit logs
├── users/            # Admin users (MVP)
├── links/            # Liens & QR (go.theresto.fr) : liste, fiche, QR, statistiques
└── config/           # Configuration (tarifs, versions de l'app mobile…)

lib/
├── auth/             # AuthContext, hooks, types
├── api/              # Cloud Functions callers
├── hooks/            # TanStack Query hooks
├── types/            # TypeScript definitions
└── utils/            # Error handling, validators

components/
├── shared/           # Card, Table, Modal, Loading, Badge
├── restaurants/      # Restaurant-specific components
└── monitoring/       # AuditLogsViewer

__tests__/
├── unit/             # Unit tests
└── integration/      # Integration tests
```

## Features

- **Firebase Auth** with mandatory MFA (TOTP)
- **Dashboard** with platform statistics
- **Restaurant Management** with commission control
- **Audit Logging** and monitoring
- **Session TTL** 2 hours (auto-logout)
- **Role-based Access Control** (admin custom claim required)

## Liens & QR (P10)

Page `/links` (entrée « Liens & QR » de la barre latérale) : liens courts `https://go.theresto.fr/<slug>`
(`theresto-go-staging.pierrecleepro.workers.dev`, adresse workers.dev du Worker de staging, quand
l'environnement choisi à la connexion, cookie `theresto_env`, est staging). Contrat côté serveur : `docs/features/short-links.md` du dépôt theresto_app.

- **Liens** : création, modification, désactivation / réactivation, jamais de suppression (un lien
  imprimé se désactive, ses scans restent comptés). Server Actions `lib/actions/shortLinks.ts`, sous
  `requireAdmin()`, clé service. Saisie validée par `lib/links/shortLinkRules.ts`, mêmes règles que la
  base (slug, mots réservés, cibles autorisées) ; la base fait foi et ses refus (`22023`, `23505`,
  `23514`) sont traduits. Contrôle de concurrence par `updated_at`.
- **Liens des stores** (`short_link_settings`) : App Store, Google Play, provider token App Store.
- **Journal** : chaque écriture écrit une ligne de `platform_logs` avec `target_type = 'link'`
  (`create_short_link`, `update_short_link`, `deactivate_short_link`, `reactivate_short_link`,
  `update_short_link_settings` avec `target_id = 'short_link_settings'`, `update_short_link_qr_style`,
  `upload_qr_logo` : extension, taille et nom `<uuid>` du fichier ; `discard_qr_logo` : extension), `details` = slug et noms des
  champs modifiés seulement (jamais le libellé ni une URL). Si le journal ne s'écrit pas, l'écriture est
  annulée (valeurs d'avant remises, lien tout juste créé retiré) et l'action refusée (`audit-log-failed`).
- **QR** : généré dans le navigateur, sans service tiers (`qrcode` et `pdf-lib`, MIT) ; il encode
  toujours `https://<domaine>/<slug>`. Correction H avec le logo (`public/qr-logo.svg`, au plus 20 % de
  la surface, fond blanc), zone de silence de 4 modules, contraste d'au moins 4:1 (fond plus sombre
  refusé). Exports SVG, PNG 2000 px et PDF A5 (titre saisi, jamais le libellé interne, et URL courte ;
  gardé par la page quand le style est enregistré). Logo PNG / JPEG : le SVG l'embarque en `data:` ; le
  PNG (et le PDF) le décode à part (`decode()`) et le pose sur le canvas, découpé au disque
  (`qrLogoGeometry`), Safari et Firefox pouvant dessiner un SVG avant l'image qu'il contient.
  La CSP existante suffit (`img-src data: blob:`, téléchargements par URL `blob:`).
- **Style du QR, enregistré par lien** (`short_links.qr_style`, NULL = style par défaut) : forme des
  petits modules (carrés, arrondis, points, losanges, étoiles), cadre et point des 3 repères des coins
  (carré, arrondi, rond, feuille, réglés séparément ; formes différentes : note de test à l'impression),
  couleurs, logo (aucun, TheResto, fichier importé SVG / PNG / JPEG de 512 Kio au plus). Validé par
  `parseQrStyle` (`lib/links/qrStyle.ts`, mêmes règles que la base) ; enregistré par
  `saveShortLinkQrStyleAction` (couleurs revérifiées par `checkQrColors`, concurrence par `updated_at`,
  journal, style remis si le journal échoue).
  Les exports reprennent le style affiché, enregistré ou non.
- **Logos importés** : bucket privé `qr-logos` (clé service seulement), fichier `<uuid>.(svg|png|jpg)` à la
  racine. Contrôlé dans le navigateur à l'import (aperçu) puis par le serveur avec la même fonction
  (`checkLogoBytes`, `lib/links/qrLogoFile.ts` : extension et octets concordants, SVG filtré). Le bucket
  ne contient que des SVG nettoyés : un SVG est déposé tel que le filtre l'a resérialisé (racine
  `<svg xmlns viewBox>` reconstruite, `cleanedSvgFile`), jamais l'original. Envoyé
  seulement à « Enregistrer le style » (`uploadQrLogoAction`, `upsert: false`, métadonnée `link_id` du
  lien, fichier retiré si le journal échoue) ; un style ne cite que le logo déjà enregistré pour ce lien
  ou un fichier déposé pour lui (métadonnée relue par `info()`), jamais celui d'un autre lien ; retiré si
  le style n'est pas enregistré (`discardQrLogoAction`, refusé pour un fichier cité par un lien) ;
  l'ancien logo d'un lien est supprimé quand plus aucun lien ne le cite. Lu par `readQrLogoAction`
  (contenu revérifié). On ne crée jamais d'URL signée sur `qr-logos` (ni pour le navigateur ni
  ailleurs) : aucune ouverture de la CSP. Un fichier peut rester sans lien (fenêtre fermée entre l'envoi et
  l'enregistrement) : sans conséquence, jamais servi.
- **Statistiques** : scans par jour (30 / 90 jours), plateformes, pays, part de robots exclus, vue
  d'ensemble par persona, ville et campagne, export CSV. Ce sont des scans, pas des installations
  (App Store Connect, Play Console). Lecture d'agrégats sans donnée personnelle : non journalisée.

## Versions de l'app mobile (P10)

Section « Versions de l'app mobile » de `/config` : version et build minimaux (blocage) et recommandés
(proposition), message et lien du store, par plateforme. Edge Function `app-version-settings`
(`lib/actions/appVersionSettings.ts`), qui exige un code TOTP de moins de 5 minutes, refuse un conflit
(409) et journalise elle-même (`update_app_version_policy`, refus 503 si le journal échoue). Contrat :
`docs/features/app-version-policy.md` du dépôt theresto_app.

## Alertes des restaurants (chantier B, lot B6)

Contrat : `docs/features/admin-restaurant-alerts.md` du dépôt theresto_app. Server Actions
`lib/actions/restaurantAlerts.ts` (RPC `service_role`, après `requireAdmin()`).

- **Liste des restaurants :** point rouge (sans texte) à côté du nom d'un restaurant en alerte,
  types dans l'`aria-label` et l'infobulle ; alertes lues une fois pour toute la liste.
- **Tableau de bord :** carte « Restaurants en alerte » (nombre de restaurants, liste regroupée, pastille
  par type selon la gravité, lien vers la fiche). Un type inconnu (chantier C) s'affiche « Autre alerte ».
- **Fiche d'un restaurant :** encadré « Alertes » et bloc « Demandes non confirmées » (compteur, demandes
  reçues App + widget au service passé, taux sur 30 jours, comparaison avec les 30 jours d'avant, seuils,
  évolution sur 12 semaines avec tableau, fermetures des 30 derniers jours paginées par 20, sans donnée
  de client ni identifiant ; la réponse est réduite aux champs du contrat avant d'atteindre le navigateur).
- **Journal :** `view_restaurant_alerts`, `view_restaurant_pending_lapse_stats`,
  `view_restaurant_pending_lapses` (nombres et id du restaurant seulement) ; consultation refusée si le
  journal échoue (`adminLogRefusal()`).
- **`/config`, « Seuils d'alerte » :** N (nombre) et X (saisi en %, envoyé en fraction à 4 décimales),
  début du suivi, date et auteur de la dernière modification. Écriture conditionnée à `updated_at`
  (PT409 → « modifiés entre-temps »), journalisée (`update_restaurant_alert_settings`, cible `config`,
  `previous` → `current`) ; journal impossible : anciennes valeurs remises et modification refusée. Pas de
  code TOTP de 5 minutes (seuil d'affichage).
- **`/config`, commissions Essentiel :** état et interrupteur « Commission gardée sur les déclarations
  tardives » (CGV 6.2, action `setLateDeclarationCommissionRule` de `commission-settings` : code TOTP,
  version `lateDeclarationRule.updatedAt`, journalisée par l'Edge Function).

## OnTime (chantier C, lot C5)

Contrat : `docs/features/ontime-tracking.md` du dépôt theresto_app. Server Actions `lib/actions/ontime.ts`
(RPC `admin_*`, `service_role`, après `requireAdmin()`, avec l'id et l'e-mail de l'admin de la session).

- **Journal :** chaque RPC écrit elle-même sa ligne de `platform_logs` dans sa transaction
  (`ontime_reports_viewed`, `ontime_overview_viewed`, `ontime_report_decided`, `ontime_report_voided`,
  `ontime_withdrawn`, `ontime_sanction_lifted`, `ontime_sanctions_switch`) : pas de `logAdminAction` en plus
  (entrées `EXEMPT` de `actionsLogged.test.ts`).
- **Écritures :** code TOTP de moins de 5 minutes (une décision peut suspendre un restaurant), motif de 10 à
  1 000 caractères (montré au restaurant, jamais au client), version lue : `stale` ou `invalid_state` renvoient
  la ligne à jour, reprise par la fiche (un nouvel essai part avec la bonne version) ; `not_found`.
  Interrupteur : version figée à l'ouverture de la modale.
- **Page `/ontime` :** onglets (À trancher, badge du nombre de contestations aussi dans la barre latérale),
  fiche d'un signalement (faits de la réservation, commentaire, contestation, issue), Retenir / Écarter, Annuler
  ce manquement, puis « Lever aussi » si la sanction déclenchée est encore en vigueur (Q4). `?restaurant=<id>`
  (lien de la fiche) : signalements de ce restaurant seul. Après une décision qui vide la dernière page, retour
  à la dernière page qui existe.
- **Fiche d'un restaurant :** section OnTime (état, compteur 30 jours, sanctions, Lever la suspension,
  Rétablir, Retirer l'OnTime avec case de confirmation ; retrait permis interrupteur éteint).
- **`/config` :** interrupteur des sanctions automatiques ; l'allumer exige de cocher « les CGV 1.2
  (article 7.4 bis) sont publiées et en vigueur » (refusé aussi par l'action serveur sans `confirmCgv`).

## Litiges, refacturations et incidents (chantier C, lots C1 à C3)

Contrats : `docs/features/booking-commissions.md` §13 et `docs/features/admin-restaurant-alerts.md` §3.3.
Server Actions `lib/actions/disputes.ts`, lecture seule, clé service après `requireAdmin()`.

- **Page `/disputes` :** `booking_disputes` et `platform_disputes` (ouverts ou tous ; litiges sans restaurant
  retrouvé compris), statut, montants, frais, échéance, lien vers le tableau de bord Stripe par l'id
  (`stripeDashboardUrl`, préfixes `du_`/`dp_`/`re_`/`fee_`/`in_` seulement, `test/` hors mode réel).
- **Fiche d'un restaurant :** refacturations (`restaurant_recharges` et statut de la facture), reprises
  (`commission_recharge_recoveries`) et litiges du restaurant ; à leur limite de lecture (200, 50, 100 par
  table), listes signalées « premières » / « les plus récents ».
- **Page `/incidents` :** incidents CRM dont la commission à rendre n'est pas rendue (reprise programmée ou
  abandonnée après 6 essais), liens vers l'application fee et le remboursement. Filtre
  `refund_commission_failed_at` non nul dans la requête, avant la limite de 500 (liste tronquée signalée).
- **Données :** ni `booking_id`, ni PaymentIntent, ni charge, ni client ou description d'incident.
  Consultations journalisées (`view_disputes`, `view_restaurant_recharges`,
  `view_incident_commission_refunds`) et refusées si le journal échoue.
- **Alertes :** libellés et détails des types `subscription_*`, `dispute_*`, `recharge_recovery_failed`,
  `ontime_*` ; « réservations en ligne coupées » seulement si `online_bookings_blocked`, « Litige perdu :
  refacturé » seulement si `has_recharge`.

## Key Documentation

- [Deployment Guide](./docs/DEPLOYMENT.md) — Vercel, environment setup, custom domain
- [Security Checklist](./docs/SECURITY.md) — MFA, Firestore rules, incident response
- [Cloud Functions](./docs/cloud-functions.md) — Admin API endpoints
- [Firestore Rules](./docs/firestore-rules.md) — Data access control

## Development Workflow

1. Create feature branch: `git checkout -b feat/my-feature`
2. Install dependencies: `npm install`
3. Run dev server: `npm run dev`
4. Run tests: `npm test`
5. Check types: `npm run type-check`
6. Lint code: `npm run lint`
7. Commit and push: `git push origin feat/my-feature`
8. Create pull request on GitHub

## Deployment

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for detailed steps.

**Quick deploy to production:**
1. Merge PR to `main` branch
2. GitHub Actions runs tests automatically
3. On success, Vercel deploys to `admin.theresto.fr`

## Support

For issues or questions:
- Check existing documentation in `docs/`
- Review Firebase Console logs
- Check Vercel deployment history
