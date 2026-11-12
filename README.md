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
(`go-staging.theresto.fr` quand l'environnement choisi à la connexion, cookie `theresto_env`, est
staging). Contrat côté serveur : `docs/features/short-links.md` du dépôt theresto_app.

- **Liens** : création, modification, désactivation / réactivation, jamais de suppression (un lien
  imprimé se désactive, ses scans restent comptés). Server Actions `lib/actions/shortLinks.ts`, sous
  `requireAdmin()`, clé service. Saisie validée par `lib/links/shortLinkRules.ts`, mêmes règles que la
  base (slug, mots réservés, cibles autorisées) ; la base fait foi et ses refus (`22023`, `23505`,
  `23514`) sont traduits. Contrôle de concurrence par `updated_at`.
- **Liens des stores** (`short_link_settings`) : App Store, Google Play, provider token App Store.
- **Journal** : chaque écriture écrit une ligne de `platform_logs` avec `target_type = 'link'`
  (`create_short_link`, `update_short_link`, `deactivate_short_link`, `reactivate_short_link`,
  `update_short_link_settings` avec `target_id = 'short_link_settings'`), `details` = slug et noms des
  champs modifiés seulement (jamais le libellé ni une URL). Si le journal ne s'écrit pas, l'écriture est
  annulée (valeurs d'avant remises, lien tout juste créé retiré) et l'action refusée (`audit-log-failed`).
- **QR** : généré dans le navigateur, sans service tiers (`qrcode` et `pdf-lib`, MIT) ; il encode
  toujours `https://<domaine>/<slug>`. Correction H avec le logo (`public/qr-logo.svg`, au plus 20 % de
  la surface, fond blanc), zone de silence de 4 modules, contraste d'au moins 4:1 (fond plus sombre
  refusé). Exports SVG, PNG 2000 px et PDF A5 (titre saisi, jamais le libellé interne, et URL courte).
  La CSP existante suffit (`img-src data: blob:`, téléchargements par URL `blob:`).
- **Statistiques** : scans par jour (30 / 90 jours), plateformes, pays, part de robots exclus, vue
  d'ensemble par persona, ville et campagne, export CSV. Ce sont des scans, pas des installations
  (App Store Connect, Play Console). Lecture d'agrégats sans donnée personnelle : non journalisée.

## Versions de l'app mobile (P10)

Section « Versions de l'app mobile » de `/config` : version et build minimaux (blocage) et recommandés
(proposition), message et lien du store, par plateforme. Edge Function `app-version-settings`
(`lib/actions/appVersionSettings.ts`), qui exige un code TOTP de moins de 5 minutes, refuse un conflit
(409) et journalise elle-même (`update_app_version_policy`, refus 503 si le journal échoue). Contrat :
`docs/features/app-version-policy.md` du dépôt theresto_app.

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
