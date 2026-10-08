# Nostos backend

The backend is the Next.js/Prisma/Postgres API and web shell for Nostos.

The current product is personal and owner-only. Feed, follows, likes, public/private profiles, reporting, moderation, verification, staff roles, and the old social feature flag are not part of the active backend architecture.

## Core responsibilities

- passwordless authentication and sessions
- server-side stamp geofence verification
- stamp creation with up to six photos, caption, and/or song metadata
- image processing and EXIF/GPS stripping
- owner-only passport, stamp, pin, profile, and place-history data
- neighborhoods and completion progress
- account deletion and retained-content rules
- legal/support web pages and operational endpoints

The database keeps historical table names such as `photo` and `venue`; API/UI terminology is stamp and place.

## Local run

```bash
pnpm install
docker compose up -d db
pnpm dev
```

Current committed defaults:

- Next.js dev server: port **3001**
- Docker Postgres host port: **5438**
- local compose database: `nostos_codex`

Seed intentionally when needed:

```bash
pnpm db:seed
```

`pnpm db:reset` is destructive and is only for a disposable local development database. Never use it against shared, preview, or production data.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Next.js dev server on 3001 |
| `pnpm build` | production build |
| `pnpm start` | production server |
| `pnpm typecheck` | TypeScript |
| `pnpm lint` | ESLint |
| `pnpm test` | unit + integration tests |
| `pnpm db:seed` | deterministic development seed |
| `pnpm db:reset` | destructive local reset + seed |
| `pnpm bundle` | regenerate backend review bundle |
| `pnpm venues:import` | import places |
| `pnpm neighborhoods:import` | import neighborhood boundaries |
| `pnpm user:geofence-exempt` | set or clear the App Review/QA geofence exemption for an account |

## Contracts

`src/contracts/api.ts` is the backend contract source. The mobile copy must remain byte-for-byte synchronized after contract changes.

## Privacy

Another account's passport, stamp, pin, place-history, and profile data must not be exposed. Stamp coordinates used for geofence verification are not normal response fields. Uploaded photos are re-encoded so EXIF/GPS does not survive.

Open policy questions, including coordinate retention and legal copy, are tracked in `../OPEN-QUESTIONS.md`.

See `API.md`, `DEPLOY.md`, `DECISIONS.md`, and `REVIEW.md` for details. Dated reviews and AI logs describe historical sessions and should not be read as current runtime status.
