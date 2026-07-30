# The OpenOrgan Project

A fresh Next.js application for discovering pipe organs, requesting practice access, promoting events, and building two-way community trust.

This repository is the complete application—not a patch and not a legacy Vite wrapper. The Next.js App Router is in `src/app`.

## Included

- Server-rendered organ and event landing pages with route metadata, Open Graph, JSON-LD, sitemap, and robots configuration
- Greater Boston list/map search with Google Places, Maps, and route-distance ranking
- Bold unclaimed reference listings and a verified claim process
- Organization-domain email verification followed by manual administrator approval
- Public organ data separated from private internal-access notes
- Free, suggested-donation, and required-fee practice terms
- Reservation decisions, notes, collapsing, completion, and two-sided modification requests
- Verified organ reviews and simplified organist trust reviews
- User and administrator photos, biographies, experience fields, and optional visible contact emails
- User-associated Q&A with dashboard answer notifications
- Event signup policies and oldest/newest ordering
- Automatic Pipe Organ Database Greater Boston import tooling

## Local start

```powershell
Copy-Item .env.example .env.local
npm install
npm run check
npm run dev
```

Open `http://localhost:3000`.

Before production use, complete [CONFIGURATION.md](./CONFIGURATION.md), deploy the rules, run the data migration, test all roles, and deploy through Firebase App Hosting.

## Validation commands

```powershell
npm run check
npm run build
npm run dev
npm run test:smoke
```

## Data migration

Back up Firestore first, then:

```powershell
npm run migrate:data
```

This moves `internalAccessNotes` into `organPrivate`, removes old reservation email snapshots, normalizes existing listing ownership, unpublishes content owned by unverified organizations, and rebuilds completed-session counters.

## Greater Boston import

The importer is dry-run by default:

```powershell
npx playwright install chromium
npm run import:boston
```

Review `import-output/accepted.json`, then commit:

```powershell
npm run import:boston -- --commit
```

See [IMPORT_BOSTON.md](./IMPORT_BOSTON.md).

## Validation record

See [VALIDATION.md](./VALIDATION.md) for the completed static checks and the required destination-machine build check.
