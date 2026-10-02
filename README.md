# Nostos

A live map of East Village and Lower East Side bars: vibe, line and cover, reported by the people who are there.

| Folder | What | Tooling |
|---|---|---|
| [`backend/`](backend/README.md) | Next.js 15 web app and API, Prisma, Postgres (Docker locally; Vercel + Neon + R2 in production) | pnpm |
| [`mobile/`](mobile/README.md) | Native iPhone app, Expo SDK 57 with Expo Router; runs in Expo Go | npm |

The two folders are independent: no root workspace, each installs its own dependencies. The app's API contract is a
verbatim copy of `backend/src/contracts/api.ts` (`cd mobile && npm run sync:contracts`; a test fails if it drifts).

## Run both locally

1. Backend (Postgres in Docker, then the dev server on port 3000):

   ```bash
   cd backend && pnpm install && docker compose up -d && pnpm dev
   ```

   First time only, create and seed the database: `pnpm db:reset` (see `backend/README.md`).

2. App, in a second terminal (scan the QR code with your iPhone's Camera app to open it in Expo Go):

   ```bash
   cd mobile && npm install && npx expo start
   ```

   In development the app talks to the backend on the same Mac automatically. Demo sign-in: `appreview@lastcall.dev`,
   password `lastcall-dev`.

## Docs

- Backend: [README](backend/README.md), [API](backend/API.md), [Deploy](backend/DEPLOY.md), [Review](backend/REVIEW.md)
- App: [README](mobile/README.md), [Store listing](mobile/STORE.md), [Review](mobile/REVIEW.md)
- Deploying: Vercel's **Root Directory is `backend/`**; the app builds with EAS from `mobile/`.
