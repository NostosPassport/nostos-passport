# Nostos backend

The backend is the Next.js/Prisma/Postgres API and web shell for Nostos.

Current product mode is personal and owner-only. Social implementation may remain behind `SOCIAL_ENABLED`, but social behavior is not part of the current mobile product.

## Core responsibilities

- authentication and sessions
- server-side stamp geofence verification
- stamp creation with up to six photos, caption, and/or song metadata
- image processing and EXIF/GPS stripping
- personal passport/stamp/place data
- neighborhoods, pins, place history, moderation/data-retention behavior
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
| `pnpm user:role` | update a development/operational account role |

## Contracts

`src/contracts/api.ts` is the backend contract source. The mobile copy must be synchronized after contract changes.

## Privacy

In personal mode, another user's passport data must not be exposed. Stamp coordinates used for geofence verification are not normal viewer-facing fields. Uploaded photos are re-encoded so EXIF/GPS does not survive.

Open policy questions, including coordinate retention and legal copy, are tracked in `../OPEN-QUESTIONS.md`.

See `API.md`, `DEPLOY.md`, `DECISIONS.md`, and `REVIEW.md` for details. Dated reviews and AI logs describe historical sessions and should not be read as current runtime status.
