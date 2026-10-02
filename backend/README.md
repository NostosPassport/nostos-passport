# Nostos backend

The API and web shell for Nostos, a passport for New York. Next.js 15 (App Router), Prisma, Postgres.

- **A stamp** is one visit to a place: a photo, a caption, a song, or any mix (at least one). It is a row in the `photo`
  table (the name is kept to avoid migration churn; the API and the app say "stamp").
- **A place** is a row in the `venue` table: name, location, geofence. No live data of any kind.
- **Stamping** works only inside the place's geofence (default 100 m), checked here from the submitted coordinates.
- **Accounts are private by default.** The stamps and places of a private account reach only the author, approved
  followers and staff, in every payload. See `src/server/privacy.ts`.
- **The feed** is the people you follow, newest first. No ranking, no personalization.
- The web side is only the legal pages, sign-in, moderation tools (`/mod`) and the admin badge tool (`/admin`).

## Run it

Prerequisites: Node 20.11 or newer, pnpm, and Docker (Docker Desktop, or Colima: `colima start`).

```bash
cd backend && pnpm install && docker compose up -d && pnpm db:reset && pnpm dev
```

- `pnpm install` creates `.env` from `.env.example` if missing and generates the Prisma client.
- `docker compose up -d` starts Postgres 16 on **localhost:5435** (databases `nostos` and, for tests, `nostos_test`).
- `pnpm db:reset` applies migrations (including the hand-written triggers) and runs the deterministic seed.

### Sign in

Open **http://localhost:3000/dev/login** (development only). Every seeded account uses the password `lastcall-dev`
(or `DEV_SEED_PASSWORD`).

| Account | What to look at |
|---|---|
| `@avaa` | Private. Four follow requests waiting. A good test of the limited view for strangers |
| `@maya_r` | Public and verified. The busiest passport |
| `@moth_hopeful` | Private, follows no one: sees an empty feed and limited profiles |
| `@blocker_blake`, `@blocked_bea` | A blocked pair: neither can see the other anywhere |
| `@mod_morgan` | Moderator: one open report in the queue, one hidden stamp |
| `@admin` | Admin: verified badge tools at `/admin` |
| `@appreview` | The geofence-exempt App Review account: can stamp from anywhere, and only it sees those stamps |

The seed is deterministic (fixed-seed PRNG, explicit ids) and anchored to "now", so the data is recent whenever you run
it. Pin the clock with `SEED_NOW=2026-10-02T16:00:00Z pnpm db:seed`.

### Trying a stamp from a laptop or at home

The app's composer lists places near the phone's position. In development builds it also shows a short "pretend to be
at" list that sets a simulated location. The server still checks the geofence against whatever it receives.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js dev / production build / production server |
| `pnpm db:reset` | Drop, migrate, and seed the dev database |
| `pnpm db:seed` | Re-seed without migrating (truncates first) |
| `pnpm typecheck` / `pnpm lint` | `tsc --noEmit` (strict) / ESLint |
| `pnpm test` | All tests: unit + DB-backed integration, one process |
| `pnpm bundle` | Regenerate `REVIEW-BUNDLE-backend.txt` |
| `pnpm venues:import` | Import places from OpenStreetMap (see DEPLOY.md) |
| `pnpm user:role <email> <USER\|MODERATOR\|ADMIN>` | Promote an account |

Integration tests use a separate database, `nostos_test`, in the same container, and refuse to run against any database
whose name does not contain `nostos_test`. Never run two test processes at once.

## Layout

```
prisma/                    schema, migrations (incl. hand-written triggers), deterministic seed
src/lib/                   geo, time, age (21+ check), storage, content filter, auth helpers
src/server/privacy.ts      who can see what (every payload goes through it)
src/server/services/       stamps, places, likes, songs, people, blocks, moderation, activity, account, auth
src/app/api/               thin route handlers (same-origin check, then service, then JSON)
src/contracts/api.ts       the API contract (copied into the app)
tests/unit, tests/integration (invariants.test.ts holds one test per rule)
```

Other docs: [API.md](API.md), [DEPLOY.md](DEPLOY.md), [DECISIONS.md](DECISIONS.md), [AI-LOG.md](AI-LOG.md), [REVIEW.md](REVIEW.md).
