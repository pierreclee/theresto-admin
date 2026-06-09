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
└── config/           # Configuration (MVP)

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
