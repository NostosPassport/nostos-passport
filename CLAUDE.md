# Nostos

Read CLAUDE.md, ENGINE.md, NOSTOS-BUILD-PROMPT.md and DESIGN.md first, every session.

## What it is
A native iPhone app (Expo, iOS only) with a passport model. You go to a place in NYC and get a stamp. Your profile is
your passport, a collection of stamps. A stamp can carry a photo, a caption, a song, or any mix (at least one). You can
only stamp a place when your phone is inside its geofence (checked on the server). Accounts are private by default.
Nostos is a fork of the Last Call project (the archive at /Users/charlesjinn/lastcall, never edited from here). Nostos
is Greek for the longing to return home.

## Repo layout
- `backend/` Next.js 15 + Prisma + Postgres. API route handlers in `src/app/api`, services in `src/server/services`,
  the API contract in `src/contracts/api.ts`, tests in `tests/unit` and `tests/integration`.
- `mobile/` Expo (iOS only). Routes in `src/app`, features in `src/features`, API client and contract copy in `src/api`.
- `scripts/gate.sh` the only definition of green. `LEDGER.md` is written only by the gate.
- `reviews/` one review file per session. `DEPENDENCIES.md` one line per dependency. `OPEN-QUESTIONS.md` for the user.
- Per-folder `DECISIONS.md` and `AI-LOG.md` in `backend/` and `mobile/`.

## Glossary
- **stamp**: a row in the `photo` table. The table name is kept to avoid migration churn. API, contract and UI say "stamp".
- **place**: a row in the `venue` table (name, location, geofence). Same rule: table kept, API and UI say "place".
- **full access**: viewer is the author, staff, the author is public, or the viewer is an accepted follower, and no block
  exists in either direction (staff excepted). A pending follow request is not full access.
- **exempt account**: the App Review account that may stamp from anywhere. Its stamps are visible only to itself.

## Rules that must never break
Each has a test in `backend/tests/integration/invariants.test.ts`. The gate fails if that file is missing, skipped or red.
1. A stamp is created only inside the place's geofence, checked server-side. Exempt (App Review) accounts are the only
   exception and are visible only to themselves.
2. Stamps and places of a private account never reach anyone without full access, in any payload.
3. Blocks (either direction) override everything except staff.
4. Hidden content is hidden, never deleted. The moderation log is append-only. No hard deletes of stamps.
5. EXIF and GPS are stripped from every upload.
6. No user coordinates, raw storage keys or user ids in any payload a viewer should not get.
7. Reputation is visible only to the user and moderators.
8. Under-21s are blocked at signup and nothing about them is stored.
9. The feed is chronological from people you follow, with no ranking or personalization.
10. Likes and badges never affect anything else.

## Team rules
- Branch `build` only. Never push, never force-push, never open a PR, never commit .env.
- Check `df -h /System/Volumes/Data` (not `/`, which misreports on macOS) before large installs. Never install Xcode.
- Never run two backend test processes at once (they share one test database).
- Use `npx expo install` for native packages and check the Expo SDK docs (see mobile/AGENTS.md).
- No em dashes in any text you write.
- Legal questions go to OPEN-QUESTIONS.md. Decide nothing legal.
- Never copy a real app's logo, icons, exact palette, name or proprietary assets.
- Schema changes: write a forward migration (`prisma migrate diff`, create the directory after generating, then
  `migrate deploy` and `prisma generate`). Never `migrate reset`. Hand-written triggers stay valid.

## Commands
- Gate (the only green): `scripts/gate.sh`
- Database: `cd backend && docker compose up -d db` (Postgres on port 5435, databases `nostos` and `nostos_test`)
- Backend: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm dev`, `pnpm db:seed`, `pnpm bundle`
- Mobile: `npm run check` (typecheck, lint, tests), `npx expo start`, `node scripts/make-review-bundle.mjs`
- Contract sync: `cd mobile && node scripts/sync-contracts.mjs`
