# Nostos

A passport for New York. Go to a place, get a stamp. Your profile is your passport: a collection of stamps, each with a
photo, a caption, a song, or any mix. You can only stamp a place when your phone is inside its geofence, and the server
checks that. Accounts are private by default. *Nostos* is Greek for the longing to return home.

| Folder | What | Tooling |
|---|---|---|
| [`backend/`](backend/README.md) | Next.js 15 web app and API, Prisma, Postgres (Docker locally) | pnpm |
| [`mobile/`](mobile/README.md) | Native iPhone app, Expo SDK 57 with Expo Router; runs in Expo Go | npm |

The two folders are independent: no root workspace, each installs its own dependencies. The app's API contract is a
verbatim copy of `backend/src/contracts/api.ts` (`cd mobile && npm run sync:contracts`; a test fails if it drifts).

Nostos is a fork of the Last Call project's social layer. Everything else from Last Call (live reports, venue owners,
promos, comments, featuring) was removed.

## For builders (human or AI)

Read `CLAUDE.md`, `ENGINE.md`, `NOSTOS-BUILD-PROMPT.md` and `DESIGN.md` first. `scripts/gate.sh` is the only definition of
green. `reviews/` holds one review per session, `OPEN-QUESTIONS.md` is what needs a human decision.

## Run both locally

1. Backend (Postgres in Docker on port 5435, then the dev server on port 3000):

   ```bash
   cd backend && pnpm install && docker compose up -d && pnpm db:reset && pnpm dev
   ```

2. App, in a second terminal (scan the QR code with your iPhone's Camera app to open it in Expo Go):

   ```bash
   cd mobile && npm install && npx expo start
   ```

   In development the app talks to the backend on the same Mac automatically. Demo sign-in: `avaa@lastcall.dev`
   (private, four requests waiting) or `maya_r@lastcall.dev` (public, verified), password `lastcall-dev`.

## Docs

- Backend: [README](backend/README.md), [API](backend/API.md), [Deploy](backend/DEPLOY.md), [Review](backend/REVIEW.md), [Decisions](backend/DECISIONS.md)
- App: [README](mobile/README.md), [Device checklist](mobile/DEVICE-CHECKLIST.md), [Store listing](mobile/STORE.md), [Review](mobile/REVIEW.md), [Decisions](mobile/DECISIONS.md)
